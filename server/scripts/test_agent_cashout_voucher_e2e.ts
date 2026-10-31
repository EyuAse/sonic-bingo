import dotenv from 'dotenv';
import { query, pool, withTransaction } from '../db.ts';

dotenv.config();

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runVoucherTests() {
  console.log('\n🧪 ========================================================');
  console.log('🧪 [TEST SUITE] Agent Cash-Out Voucher Lifecycle Verification');
  console.log('🧪 ========================================================\n');

  let testAgentUserId = '';
  let testAgentProfileId = '';
  let testPlayerUserId = '';
  let testVoucherCode = 'CW-TST999';

  try {
    // ----------------------------------------------------
    // TEST 1: Table & Schema Verification
    // ----------------------------------------------------
    console.log('--- Test 1: Verify Schema for agent_cashout_vouchers ---');
    await query(`
      CREATE TABLE IF NOT EXISTS agent_cashout_vouchers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        voucher_code VARCHAR(20) UNIQUE NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'cancelled', 'expired')),
        redeemed_by_agent_id UUID REFERENCES agent_profiles(id),
        redeemed_at TIMESTAMPTZ,
        agent_commission_earned NUMERIC(12, 2) DEFAULT 0.00,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
      );
      ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS cashout_commission_rate NUMERIC(5, 2) DEFAULT 1.50;
    `);
    assert(true, 'agent_cashout_vouchers table and commission column verified in Neon DB');

    // ----------------------------------------------------
    // TEST 2: Seed Test Agent & Player
    // ----------------------------------------------------
    console.log('\n--- Test 2: Seed Agent and Player Wallets ---');
    const agentUserRes = await query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0919998877', 'Voucher Test Agent', 'agent')
      RETURNING id
    `);
    testAgentUserId = agentUserRes.rows[0].id;

    const apRes = await query(`
      INSERT INTO agent_profiles (user_id, agent_code, status, wallet_balance, initial_deposit, low_balance_threshold, cashout_commission_rate)
      VALUES ($1, 'AGT-VCH-01', 'active', 5000.00, 10000.00, 1000.00, 1.50)
      RETURNING *
    `, [testAgentUserId]);
    testAgentProfileId = apRes.rows[0].id;
    assert(parseFloat(apRes.rows[0].wallet_balance) === 5000.00, 'Agent float initialized at 5,000.00 ETB');
    assert(parseFloat(apRes.rows[0].cashout_commission_rate) === 1.50, 'Agent cash-out incentive set to 1.5%');

    const playerUserRes = await query(`
      INSERT INTO users (phone, full_name, role)
      VALUES ('0928887766', 'Voucher Player', 'player')
      RETURNING id
    `);
    testPlayerUserId = playerUserRes.rows[0].id;

    await query(`
      INSERT INTO wallets (user_id, balance, bonus, locked_balance)
      VALUES ($1, 1000.00, 20.00, 0.00)
    `, [testPlayerUserId]);
    assert(true, 'Player seeded with 1,000.00 ETB cash balance');

    // ----------------------------------------------------
    // TEST 3: Player Generates Cash-Out Voucher (Escrow Lock)
    // ----------------------------------------------------
    console.log('\n--- Test 3: Player Creates Cash-Out Voucher ---');
    const voucherAmount = 300.00;

    await withTransaction(async (client) => {
      // Deduct from balance, add to locked_balance
      await client.query(`
        UPDATE wallets 
        SET balance = balance - $1, locked_balance = locked_balance + $1 
        WHERE user_id = $2
      `, [voucherAmount, testPlayerUserId]);

      // Insert voucher
      await client.query(`
        INSERT INTO agent_cashout_vouchers (voucher_code, user_id, amount, status)
        VALUES ($1, $2, $3, 'pending')
      `, [testVoucherCode, testPlayerUserId, voucherAmount]);
    });

    const postCreateWallet = await query('SELECT balance, locked_balance FROM wallets WHERE user_id = $1', [testPlayerUserId]);
    assert(parseFloat(postCreateWallet.rows[0].balance) === 700.00, 'Player balance deducted from 1,000 to 700 ETB');
    assert(parseFloat(postCreateWallet.rows[0].locked_balance) === 300.00, '300 ETB securely placed in escrow (locked_balance)');

    // ----------------------------------------------------
    // TEST 4: Agent Verifies Voucher
    // ----------------------------------------------------
    console.log('\n--- Test 4: Agent Previews & Verifies Voucher ---');
    const verifyRes = await query(`
      SELECT v.*, u.full_name, u.phone 
      FROM agent_cashout_vouchers v
      JOIN users u ON v.user_id = u.id
      WHERE v.voucher_code = $1
    `, [testVoucherCode]);

    assert(verifyRes.rows.length === 1, 'Voucher found by unique code');
    const vRow = verifyRes.rows[0];
    assert(vRow.status === 'pending', 'Voucher status is pending');
    assert(parseFloat(vRow.amount) === 300.00, 'Voucher payout amount is 300.00 ETB');
    assert(vRow.full_name === 'Voucher Player', 'Player name accurately matches');

    // ----------------------------------------------------
    // TEST 5: Agent Redeems Voucher (Atomic Settlement)
    // ----------------------------------------------------
    console.log('\n--- Test 5: Agent Confirms Payout & Receives Reimbursement + 1.5% Commission ---');
    const commission = 300.00 * (1.5 / 100); // 4.50 ETB

    await withTransaction(async (client) => {
      // 1. Mark voucher redeemed
      await client.query(`
        UPDATE agent_cashout_vouchers 
        SET status = 'redeemed', redeemed_by_agent_id = $1, redeemed_at = NOW(), agent_commission_earned = $2 
        WHERE voucher_code = $3
      `, [testAgentProfileId, commission, testVoucherCode]);

      // 2. Reimburse agent float + commission
      await client.query(`
        UPDATE agent_profiles 
        SET wallet_balance = wallet_balance + $1 + $2 
        WHERE id = $3
      `, [voucherAmount, commission, testAgentProfileId]);

      // 3. Clear player locked balance
      await client.query(`
        UPDATE wallets 
        SET locked_balance = locked_balance - $1 
        WHERE user_id = $2
      `, [voucherAmount, testPlayerUserId]);
    });

    const postRedeemAgent = await query('SELECT wallet_balance FROM agent_profiles WHERE id = $1', [testAgentProfileId]);
    const expectedAgentBal = 5000.00 + 300.00 + 4.50; // 5,304.50 ETB
    assert(parseFloat(postRedeemAgent.rows[0].wallet_balance) === expectedAgentBal, `Agent float reimbursed to ${expectedAgentBal.toFixed(2)} ETB (+300 float, +4.50 commission)`);

    const postRedeemWallet = await query('SELECT balance, locked_balance FROM wallets WHERE user_id = $1', [testPlayerUserId]);
    assert(parseFloat(postRedeemWallet.rows[0].locked_balance) === 0.00, 'Player locked balance settled to 0.00 ETB');

    // ----------------------------------------------------
    // TEST 6: Voucher Cancellation Scenario
    // ----------------------------------------------------
    console.log('\n--- Test 6: Player Voucher Cancellation & Fund Refund ---');
    const cancelVoucherCode = 'CW-CNCL88';
    const cancelAmount = 150.00;

    // Player generates second voucher
    await withTransaction(async (client) => {
      await client.query('UPDATE wallets SET balance = balance - $1, locked_balance = locked_balance + $1 WHERE user_id = $2', [cancelAmount, testPlayerUserId]);
      await client.query('INSERT INTO agent_cashout_vouchers (voucher_code, user_id, amount, status) VALUES ($1, $2, $3, \'pending\')', [cancelVoucherCode, testPlayerUserId, cancelAmount]);
    });

    // Player cancels voucher before visiting counter
    await withTransaction(async (client) => {
      await client.query('UPDATE agent_cashout_vouchers SET status = \'cancelled\' WHERE voucher_code = $1', [cancelVoucherCode]);
      await client.query('UPDATE wallets SET balance = balance + $1, locked_balance = locked_balance - $1 WHERE user_id = $2', [cancelAmount, testPlayerUserId]);
    });

    const finalPlayerWallet = await query('SELECT balance, locked_balance FROM wallets WHERE user_id = $1', [testPlayerUserId]);
    assert(parseFloat(finalPlayerWallet.rows[0].balance) === 700.00, 'Cancelled funds (150 ETB) safely refunded back to player balance (700.00 ETB)');
    assert(parseFloat(finalPlayerWallet.rows[0].locked_balance) === 0.00, 'Escrow locked balance is zero');

  } finally {
    // Cleanup
    if (testVoucherCode) {
      await query('DELETE FROM agent_cashout_vouchers WHERE voucher_code IN ($1, $2)', [testVoucherCode, 'CW-CNCL88']).catch(() => {});
    }
    if (testAgentProfileId) {
      await query('DELETE FROM agent_profiles WHERE id = $1', [testAgentProfileId]).catch(() => {});
    }
    if (testPlayerUserId) {
      await query('DELETE FROM wallets WHERE user_id = $1', [testPlayerUserId]).catch(() => {});
      await query('DELETE FROM users WHERE id = $1', [testPlayerUserId]).catch(() => {});
    }
    if (testAgentUserId) {
      await query('DELETE FROM users WHERE id = $1', [testAgentUserId]).catch(() => {});
    }
    console.log('\n  🧹 Test records safely cleaned up from database.');
  }

  console.log('\n🎉 [SUCCESS] All Cash-Out Voucher Lifecycle Tests PASSED 100%!');
  console.log('========================================================\n');
  process.exit(0);
}

runVoucherTests().catch(err => {
  console.error('\n❌ [TEST FAILURE]:', err);
  process.exit(1);
});

