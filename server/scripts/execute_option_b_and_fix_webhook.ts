import { query, withTransaction } from '../db.ts';
import { coinService } from '../services/coinService.ts';

async function approveNatanDeposit() {
  console.log('========================================================');
  console.log('⚡ EXECUTING OPTION B: APPROVE PLAYER NATAN DEPOSIT');
  console.log('========================================================\n');

  const requestId = 'b3ebc91f-ccea-4c49-8634-9081ae0c4e50';

  const approvalResult = await withTransaction(async (client) => {
    // 1. Fetch and lock deposit request
    const reqRes = await client.query(
      `SELECT * FROM agent_deposit_requests WHERE id = $1 FOR UPDATE`,
      [requestId]
    );

    if (reqRes.rows.length === 0) {
      throw new Error(`Deposit request ${requestId} not found`);
    }

    const depReq = reqRes.rows[0];
    if (depReq.status !== 'pending') {
      return { success: true, alreadyProcessed: true, status: depReq.status };
    }

    const depositAmount = parseFloat(depReq.amount);
    const agentId = depReq.agent_id;
    const playerId = depReq.player_id;

    // 2. Lock and fetch Agent Profile (Eyob Asefa)
    const agentProfileRes = await client.query(
      `SELECT id, agent_code, wallet_balance, commission_rate FROM agent_profiles WHERE id = $1 FOR UPDATE`,
      [agentId]
    );
    const agentProfile = agentProfileRes.rows[0];
    const agentBalance = parseFloat(agentProfile.wallet_balance || '0');

    if (agentBalance < depositAmount) {
      throw new Error(`Insufficient agent float: Balance ${agentBalance} < ${depositAmount}`);
    }

    // 3. Lock and fetch Player Wallet (NATAN)
    let playerWalletRes = await client.query(
      `SELECT id, balance, user_id FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [playerId]
    );
    if (playerWalletRes.rows.length === 0) {
      await client.query(
        `INSERT INTO wallets (user_id, balance, bonus, currency, updated_at)
         VALUES ($1, 0.00, 0.00, 'ETB', NOW())
         ON CONFLICT (user_id) DO NOTHING`,
        [playerId]
      );
      playerWalletRes = await client.query(
        `SELECT id, balance, user_id FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [playerId]
      );
    }
    const playerWallet = playerWalletRes.rows[0];
    const playerOldBalance = parseFloat(playerWallet.balance || '0');

    const agentBalAfter = agentBalance - depositAmount;
    const playerBalAfter = playerOldBalance + depositAmount;
    const coinsEarned = Math.round(depositAmount * 1.5);

    // 4. Deduct Agent Float
    await client.query(
      `UPDATE agent_profiles SET wallet_balance = $1, updated_at = NOW() WHERE id = $2`,
      [agentBalAfter, agentId]
    );

    // 5. Credit Player Balance
    await client.query(
      `UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [playerBalAfter, playerWallet.id]
    );

    // 6. Award 1.5x Coins
    try {
      await coinService.awardCoinsForDeposit(playerId, depositAmount, depReq.transaction_code, client);
    } catch (e: any) {
      console.warn('Coin award note:', e.message);
    }

    // 7. Check if player has deposited before
    const playerUserRes = await client.query(
      `SELECT has_deposited, referred_by, agent_id FROM users WHERE id = $1 FOR UPDATE`,
      [playerId]
    );
    const isFirstDeposit = !playerUserRes.rows[0]?.has_deposited;
    const playerReferrerId = playerUserRes.rows[0]?.referred_by;

    let referralBonusEarned = 0;
    if (isFirstDeposit && playerReferrerId) {
      referralBonusEarned = Math.round(depositAmount * 0.10 * 100) / 100;
      await client.query(
        `UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE user_id = $2`,
        [referralBonusEarned, playerReferrerId]
      );
      await client.query(
        `INSERT INTO wallet_transactions 
          (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
         VALUES ($1, 'referral_bonus', $2, (SELECT balance FROM wallets WHERE user_id = $1), $3, 'completed', 'bonus', '10% Referral Bonus on friend first deposit')`,
        [playerReferrerId, referralBonusEarned, `REF-${Date.now().toString().slice(-6)}`]
      );
    }

    // 8. Mark player as has_deposited
    await client.query(
      `UPDATE users SET has_deposited = true WHERE id = $1`,
      [playerId]
    );

    // 9. Record in agent_player_deposits
    await client.query(
      `INSERT INTO agent_player_deposits 
        (agent_id, player_user_id, amount, agent_balance_after, player_balance_after, payment_method, reference_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [agentId, playerId, depositAmount, agentBalAfter, playerBalAfter, depReq.payment_method, depReq.transaction_code]
    );

    // 10. Record in player wallet_transactions
    await client.query(
      `INSERT INTO wallet_transactions 
        (user_id, type, amount, balance_after, reference_code, status, payment_method, description)
       VALUES ($1, 'deposit', $2, $3, $4, 'completed', $5, $6)`,
      [
        playerId,
        depositAmount,
        playerBalAfter,
        depReq.transaction_code,
        depReq.payment_method,
        `Deposit via Sonic Agent #${agentProfile.agent_code}`
      ]
    );

    // 11. Update agent_deposit_requests to approved
    await client.query(
      `UPDATE agent_deposit_requests
       SET status = 'approved',
           resolved_at = NOW(),
           agent_balance_before = $1,
           agent_balance_after = $2,
           player_balance_before = $3,
           player_balance_after = $4
       WHERE id = $5`,
      [agentBalance, agentBalAfter, playerOldBalance, playerBalAfter, requestId]
    );

    // 12. Insert reconciled SMS log to keep complete audit trail
    await client.query(
      `INSERT INTO telebirr_sms_logs
        (sender, message_body, transaction_ref, amount, payer_phone, recipient_name, status, matched_user_id, matched_agent_deposit_id, received_at, processed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'credited', $7, $8, NOW(), NOW())
       ON CONFLICT (transaction_ref) DO UPDATE
       SET status = 'credited', matched_user_id = $7, matched_agent_deposit_id = $8, processed_at = NOW()`,
      [
        '127',
        `Reconciled manual approval: ETB ${depositAmount} from ${depReq.player_phone} with ref ${depReq.transaction_code} to Eyob Asefa`,
        depReq.transaction_code,
        depositAmount,
        depReq.player_phone,
        'Eyob Asefa',
        playerId,
        requestId
      ]
    );

    return {
      success: true,
      depositAmount,
      playerOldBalance,
      playerBalAfter,
      agentBalanceBefore: agentBalance,
      agentBalAfter,
      txCode: depReq.transaction_code,
      coinsEarned
    };
  });

  console.log('✅ Option B Approval Succeeded!');
  console.log(JSON.stringify(approvalResult, null, 2));
}

async function fixSMSGateWebhook() {
  console.log('\n========================================================');
  console.log('🔗 UPDATING SMSGATE WEBHOOK TO LIVE PRODUCTION SERVER');
  console.log('========================================================\n');

  const creds = Buffer.from('H64BX8:xz3-xwau94k9pp').toString('base64');
  const authRes = await fetch('https://api.sms-gate.app/3rdparty/v1/auth/token', {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + creds, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ttl: 3600, scopes: ['webhooks:list', 'webhooks:write', 'webhooks:delete'] })
  });
  const data: any = await authRes.json();
  const token = data.access_token || data.token;

  if (!token) {
    console.error('Failed to authenticate with SMSGate:', data);
    return;
  }

  // 1. Fetch existing webhooks
  const listRes = await fetch('https://api.sms-gate.app/3rdparty/v1/webhooks', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const webhooks: any = await listRes.json();
  console.log('Current webhooks on SMSGate:', webhooks);

  // 2. Delete old suspended webhooks pointing to sonic-bingo-enod
  for (const hook of (Array.isArray(webhooks) ? webhooks : [])) {
    if (hook.url.includes('sonic-bingo-enod.onrender.com') || hook.url.includes('bingo-mini-app-3li9')) {
      console.log(`Deleting stale webhook [${hook.id}] -> ${hook.url}...`);
      const delRes = await fetch(`https://api.sms-gate.app/3rdparty/v1/webhooks/${hook.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      console.log(`Delete status: ${delRes.status}`);
    }
  }

  // 3. Register the new LIVE webhook URL: https://sonic-bingo.onrender.com
  const liveWebhookUrl = 'https://sonic-bingo.onrender.com/api/webhooks/telebirr-sms?secret=telebirr_secret_sonic_2026';
  console.log(`\nRegistering new LIVE webhook -> ${liveWebhookUrl}...`);

  const createRes = await fetch('https://api.sms-gate.app/3rdparty/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: liveWebhookUrl,
      event: 'sms:received'
    })
  });

  console.log(`Create webhook status: ${createRes.status}`);
  const createData = await createRes.json();
  console.log('New Webhook Response:', createData);
}

async function main() {
  await approveNatanDeposit();
  await fixSMSGateWebhook();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

