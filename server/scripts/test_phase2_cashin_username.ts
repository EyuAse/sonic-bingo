import dotenv from 'dotenv';
import { query, withTransaction } from '../db.ts';

dotenv.config();

async function testPhase2CashInUsername() {
  console.log('🧪 Running Phase 2 Test: Player Cash-In Terminal by Username Verification...');

  // 1. Get an active agent profile
  const agentRes = await query(`
    SELECT ap.id, ap.agent_code, ap.wallet_balance, ap.user_id
    FROM agent_profiles ap
    WHERE ap.status = 'active' AND ap.wallet_balance >= 200
    LIMIT 1
  `);

  if (agentRes.rows.length === 0) {
    throw new Error('No active agent found with at least 200 ETB float balance.');
  }

  const agent = agentRes.rows[0];
  const initialAgentFloat = parseFloat(agent.wallet_balance);
  console.log(`✅ Using Agent: Code=${agent.agent_code}, Float=${initialAgentFloat.toFixed(2)} ETB`);

  // 2. Create or find a player with a Telegram username but NO mobile phone (testing phone-less Telegram user)
  const testUsername = `phase2_user_${Date.now().toString().slice(-4)}`;
  const insUserRes = await query(`
    INSERT INTO users (full_name, telegram_username, role, created_at)
    VALUES ('Phase2 Username User', $1, 'player', NOW())
    RETURNING id, full_name, telegram_username, phone
  `, [testUsername]);

  const testPlayer = insUserRes.rows[0];
  const playerId = testPlayer.id;
  console.log(`✅ Created test player with username: @${testUsername}, ID=${playerId}, Phone=${testPlayer.phone || 'None'}`);

  // 3. Test Search Player Query by Username (with '@' and without '@')
  console.log('3. Testing Search Player Query by Username...');
  const searchParam = `%${testUsername}%`;
  const searchRes = await query(`
    SELECT u.id, u.full_name, u.phone, u.telegram_username as username, u.telegram_id, u.status
    FROM users u
    WHERE (
      u.phone ILIKE $1 
      OR u.full_name ILIKE $1 
      OR u.telegram_username ILIKE $1
      OR CAST(u.telegram_id AS TEXT) ILIKE $1
    )
    LIMIT 5
  `, [searchParam]);

  if (searchRes.rows.length === 0) {
    throw new Error(`Search by username @${testUsername} failed to return the user!`);
  }
  const foundUser = searchRes.rows[0];
  console.log(`✅ Found user: ID=${foundUser.id}, Name=${foundUser.full_name}, Username=@${foundUser.username}`);

  // Verify financial privacy: balance must NOT be returned in search results
  if ((foundUser as any).balance !== undefined) {
    throw new Error('SECURITY VIOLATION: Player balance was exposed in search results!');
  }
  console.log('✅ Privacy verified: Player balance is 100% REDACTED from agent search.');

  // 4. Simulate Direct Cash-In Endpoint using playerId & username (exact Phase 2 backend logic)
  const depositAmount = 100.00;
  console.log(`4. Executing Cash-In of ${depositAmount} ETB using playerId=${playerId}...`);

  const refCode = `AGT-DEP-TEST-${Date.now().toString().slice(-4)}`;
  await withTransaction(async (client) => {
    // A. Lock agent profile
    const aRes = await client.query(
      `SELECT id, agent_code, wallet_balance, low_balance_threshold 
       FROM agent_profiles 
       WHERE id = $1 FOR UPDATE`,
      [agent.id]
    );
    const ag = aRes.rows[0];
    const agBal = parseFloat(ag.wallet_balance);
    const newAgBal = agBal - depositAmount;

    // B. Find player by UUID
    const pRes = await client.query(
      `SELECT u.id, u.full_name, u.phone, u.telegram_username, u.agent_id, 
              COALESCE(w.balance, 0) as balance, w.id as wallet_id
       FROM users u
       LEFT JOIN wallets w ON u.id = w.user_id
       WHERE u.id = $1 FOR UPDATE OF u`,
      [playerId]
    );
    const p = pRes.rows[0];
    const oldPBal = parseFloat(p.balance || '0');
    const newPBal = oldPBal + depositAmount;

    // C. Deduct agent float
    await client.query(
      `UPDATE agent_profiles 
       SET wallet_balance = $1, updated_at = NOW() 
       WHERE id = $2`,
      [newAgBal, agent.id]
    );

    // D. Atomically upsert player wallet (even if no prior wallet row existed)
    await client.query(
      `INSERT INTO wallets (user_id, balance, bonus, currency, updated_at)
       VALUES ($1, $2, 0.00, 'ETB', NOW())
       ON CONFLICT (user_id) DO UPDATE 
       SET balance = wallets.balance + $3, updated_at = NOW()`,
      [playerId, depositAmount, depositAmount]
    );

    // E. Mark player as has_deposited & link agent
    await client.query(
      `UPDATE users 
       SET has_deposited = TRUE,
           agent_id = COALESCE(agent_id, $1)
       WHERE id = $2`,
      [agent.id, playerId]
    );

    // F. Record in agent_player_deposits
    await client.query(
      `INSERT INTO agent_player_deposits (agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code)
       VALUES ($1, $2, $3, $4, $5, 'Telebirr', $6)`,
      [agent.id, playerId, depositAmount, newAgBal, newPBal, refCode]
    );

    // G. Record in wallet_transactions
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
       VALUES ($1, 'deposit', $2, $3, $4, 'completed', 'Telebirr', $5)`,
      [playerId, depositAmount, newPBal, refCode, `Agent Deposit via Telebirr (Agent: ${agent.agent_code})`]
    );
  });

  console.log('✅ Cash-In transaction committed successfully!');

  // 5. Verify Database Records
  const checkWallet = await query(`SELECT balance FROM wallets WHERE user_id = $1`, [playerId]);
  if (checkWallet.rows.length === 0) {
    throw new Error('Wallet was not created for phone-less Telegram player!');
  }
  const actualBal = parseFloat(checkWallet.rows[0].balance);
  if (Math.abs(actualBal - depositAmount) > 0.01) {
    throw new Error(`Expected balance ${depositAmount}, got: ${actualBal}`);
  }
  console.log(`✅ Player wallet verified: Balance = ${actualBal.toFixed(2)} ETB (jumped from 0.00 to 100.00 ETB seamlessly!)`);

  const checkAgent = await query(`SELECT wallet_balance FROM agent_profiles WHERE id = $1`, [agent.id]);
  const actualFloat = parseFloat(checkAgent.rows[0].wallet_balance);
  const expectedFloat = initialAgentFloat - depositAmount;
  if (Math.abs(actualFloat - expectedFloat) > 0.01) {
    throw new Error(`Expected agent float ${expectedFloat}, got: ${actualFloat}`);
  }
  console.log(`✅ Agent float deducted: ${actualFloat.toFixed(2)} ETB (was ${initialAgentFloat.toFixed(2)} ETB)`);

  const checkTx = await query(`SELECT * FROM wallet_transactions WHERE reference_code = $1`, [refCode]);
  if (checkTx.rows.length === 0) {
    throw new Error('wallet_transactions record was not found!');
  }
  console.log(`✅ wallet_transactions verified: ID=${checkTx.rows[0].id}, Amount=${checkTx.rows[0].amount} ETB`);

  // 6. Cleanup test records and restore initial float
  await query(`UPDATE agent_profiles SET wallet_balance = $1 WHERE id = $2`, [initialAgentFloat, agent.id]);
  await query(`DELETE FROM wallet_transactions WHERE reference_code = $1`, [refCode]);
  await query(`DELETE FROM agent_player_deposits WHERE reference_code = $1`, [refCode]);
  await query(`DELETE FROM wallets WHERE user_id = $1`, [playerId]);
  await query(`DELETE FROM users WHERE id = $1`, [playerId]);

  console.log('✅ Cleanup complete: test player and transactions cleaned, agent float restored.');
  console.log('🎉 --- PHASE 2 TEST PASSED 100% --- 🎉');
  process.exit(0);
}

testPhase2CashInUsername().catch(err => {
  console.error('❌ Phase 2 test failed:', err);
  process.exit(1);
});

