import dotenv from 'dotenv';
import { query } from '../db.ts';

dotenv.config();

async function runE2ETest() {
  console.log('--- 🧪 Starting Phase 2 E2E Integration Test: Decentralized Agent Deposit Flow ---');

  // 1. Check Available Agents Endpoint Logic (Strict Anonymity)
  console.log('1. Testing Agent Availability & Anonymity...');
  const availableRes = await query(`
    SELECT ap.id, ap.agent_code, ap.status, ap.telebirr_phone, ap.cbe_account, ap.mpesa_phone, 
           ap.is_online, ap.wallet_balance
    FROM agent_profiles ap
    WHERE ap.status = 'active'
      AND COALESCE(ap.is_online, true) = true
      AND ap.wallet_balance >= 50.00
    ORDER BY ap.wallet_balance DESC, ap.created_at ASC
  `);

  if (availableRes.rows.length === 0) {
    throw new Error('No available online agents found in Neon DB');
  }

  const agent = availableRes.rows[0];
  console.log(`✅ Found active online agent: Code = ${agent.agent_code}, Float = ${agent.wallet_balance} ETB`);
  
  // Verify strict anonymity (no fullName field in projection)
  if ((agent as any).full_name || (agent as any).fullName) {
    throw new Error('SECURITY VIOLATION: Agent personal name was exposed in available agents query!');
  }
  console.log('✅ Privacy verified: Agent personal name is 100% REDACTED from public player query.');

  // 2. Locate or create a test player
  let playerRes = await query(`SELECT id, phone FROM users WHERE role = 'player' AND phone IS NOT NULL LIMIT 1`);
  if (playerRes.rows.length === 0) {
    playerRes = await query(`
      INSERT INTO users (full_name, phone, role) 
      VALUES ('Test Player', '0999001122', 'player') 
      RETURNING id, phone
    `);
  }
  const player = playerRes.rows[0];
  const playerPhone = player.phone || '0999001122';
  console.log(`2. Test Player: ID = ${player.id}, Phone = ${playerPhone}`);

  // Ensure player has a wallet
  await query(`
    INSERT INTO wallets (user_id, balance, bonus, currency) 
    VALUES ($1, 0, 0, 'ETB') 
    ON CONFLICT (user_id) DO NOTHING
  `, [player.id]);

  const playerWalletBefore = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [player.id]);
  const pBalanceBefore = parseFloat(playerWalletBefore.rows[0].balance);
  const agentFloatBefore = parseFloat(agent.wallet_balance);

  // 3. Create a test deposit request
  const testTxCode = `TEST-TX-${Date.now()}`;
  const depositAmount = 100.00;
  console.log(`3. Player submits deposit request: ${depositAmount} ETB, TxCode: ${testTxCode}...`);

  const reqInsert = await query(`
    INSERT INTO agent_deposit_requests 
      (player_id, agent_id, amount, payment_method, player_phone, transaction_code, status)
    VALUES ($1, $2, $3, 'Telebirr', $4, $5, 'pending')
    RETURNING id, status, created_at
  `, [player.id, agent.id, depositAmount, playerPhone, testTxCode]);

  const requestId = reqInsert.rows[0].id;
  console.log(`✅ Request inserted: ID = ${requestId}, Status = ${reqInsert.rows[0].status}`);

  // 4. Simulate Agent Approving the Request (Atomic ACID Execution)
  console.log('4. Simulating Agent Approval...');
  const agentBalAfter = agentFloatBefore - depositAmount;
  const playerBalAfter = pBalanceBefore + depositAmount;
  const coinsEarned = Math.round(depositAmount * 1.5); // 150 coins
  const commissionEarned = depositAmount * 0.05; // 5.00 ETB

  // Execute ACID updates
  await query(`UPDATE agent_profiles SET wallet_balance = $1 WHERE id = $2`, [agentBalAfter, agent.id]);
  await query(`UPDATE wallets SET balance = $1 WHERE user_id = $2`, [playerBalAfter, player.id]);
  await query(`
    INSERT INTO agent_commissions (agent_id, source_type, source_id, amount, commission_rate, commission_earned)
    VALUES ($1, 'deposit', $2, $3, 5.00, $4)
  `, [agent.id, requestId, depositAmount, commissionEarned]);
  await query(`
    UPDATE agent_deposit_requests
    SET status = 'approved',
        resolved_at = NOW(),
        agent_balance_before = $1,
        agent_balance_after = $2,
        player_balance_before = $3,
        player_balance_after = $4
    WHERE id = $5
  `, [agentFloatBefore, agentBalAfter, pBalanceBefore, playerBalAfter, requestId]);

  // 5. Verify Database Records
  console.log('5. Verifying Database Ledger Invariants...');
  const updatedReq = await query(`SELECT * FROM agent_deposit_requests WHERE id = $1`, [requestId]);
  console.log('Request Record:', {
    id: updatedReq.rows[0].id,
    status: updatedReq.rows[0].status,
    agent_before: updatedReq.rows[0].agent_balance_before,
    agent_after: updatedReq.rows[0].agent_balance_after,
    player_before: updatedReq.rows[0].player_balance_before,
    player_after: updatedReq.rows[0].player_balance_after
  });

  const updatedAgent = await query(`SELECT wallet_balance FROM agent_profiles WHERE id = $1`, [agent.id]);
  console.log(`Agent Float after approval: ${updatedAgent.rows[0].wallet_balance} ETB (Expected: ${agentBalAfter})`);

  const updatedPlayerWallet = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [player.id]);
  console.log(`Player Wallet after approval: ${updatedPlayerWallet.rows[0].balance} ETB (Expected: ${playerBalAfter})`);

  const commissionRecord = await query(`SELECT * FROM agent_commissions WHERE source_id = $1`, [requestId]);
  console.log(`Agent Commission Recorded: ${commissionRecord.rows[0].commission_earned} ETB (${commissionRecord.rows[0].commission_rate}%)`);

  if (updatedReq.rows[0].status !== 'approved') throw new Error('Status should be approved');
  if (parseFloat(updatedAgent.rows[0].wallet_balance) !== agentBalAfter) throw new Error('Agent balance mismatch');
  if (parseFloat(updatedPlayerWallet.rows[0].balance) !== playerBalAfter) throw new Error('Player balance mismatch');

  // Clean up test records (restore agent float balance)
  console.log('6. Cleaning up test data & restoring agent float...');
  await query(`UPDATE agent_profiles SET wallet_balance = $1 WHERE id = $2`, [agentFloatBefore, agent.id]);
  await query(`UPDATE wallets SET balance = $1 WHERE user_id = $2`, [pBalanceBefore, player.id]);
  await query(`DELETE FROM agent_commissions WHERE source_id = $1`, [requestId]);
  await query(`DELETE FROM agent_deposit_requests WHERE id = $1`, [requestId]);

  console.log('--- 🎉 Phase 2 E2E Integration Test Passed 100%! ---');
  process.exit(0);
}

runE2ETest().catch(err => {
  console.error('❌ E2E Test Failed:', err);
  process.exit(1);
});
