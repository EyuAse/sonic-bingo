import { query, withTransaction } from '../db.ts';

const BASE_URL = 'http://localhost:5000';

async function main() {
  console.log('🧪 Starting Phase 3 Financial Limits & Turnover Verification Suite...\n');

  // 1. Create a clean test user
  const testPhone = '0999887766';
  await query('DELETE FROM users WHERE phone = $1', [testPhone]);

  const userRes = await query(`
    INSERT INTO users (telegram_id, telegram_username, full_name, phone, role)
    VALUES ($1, $2, $3, $4, 'player')
    RETURNING id, full_name, phone
  `, [99998888, 'test_limits_player', 'Test Limits Player', testPhone]);
  const user = userRes.rows[0];

  // Give user wallet balance
  await query(`
    INSERT INTO wallets (user_id, balance, bonus)
    VALUES ($1, 5000.00, 50.00)
    ON CONFLICT (user_id) DO UPDATE SET balance = 5000.00, bonus = 50.00
  `, [user.id]);

  // Login as test user to get JWT
  const jwt = await import('jsonwebtoken');
  const token = jwt.default.sign(
    { id: user.id, username: 'test_limits_player', role: 'player' },
    process.env.JWT_SECRET || 'fallback_secret_key_bingo_mini_app_2026',
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  try {
    // --- TEST 1: Deposit Limits (Min 50, Max 1500) ---
    console.log('--- TEST 1: Deposit Limits (50 - 1,500 ETB) ---');
    
    // Deposit 40 (under 50)
    const depUnder = await fetch(`${BASE_URL}/api/wallet/deposit`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 40, paymentMethod: 'Telebirr', playerPhone: testPhone })
    });
    const depUnderData = await depUnder.json();
    console.log('Deposit 40 ETB response:', depUnder.status, depUnderData.error);
    if (depUnder.status !== 400 || !depUnderData.error?.includes('50 and 1,500 ETB')) {
      throw new Error(`Expected rejection for deposit under 50 ETB, got: ${JSON.stringify(depUnderData)}`);
    }
    console.log('✅ Deposit < 50 ETB correctly rejected!');

    // Deposit 1600 (over 1500)
    const depOver = await fetch(`${BASE_URL}/api/wallet/deposit`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 1600, paymentMethod: 'Telebirr', playerPhone: testPhone })
    });
    const depOverData = await depOver.json();
    console.log('Deposit 1600 ETB response:', depOver.status, depOverData.error);
    if (depOver.status !== 400 || !depOverData.error?.includes('50 and 1,500 ETB')) {
      throw new Error(`Expected rejection for deposit over 1500 ETB, got: ${JSON.stringify(depOverData)}`);
    }
    console.log('✅ Deposit > 1,500 ETB correctly rejected!');

    // --- TEST 2: Withdrawal Limits (Min 50, Max 2000) ---
    console.log('\n--- TEST 2: Withdrawal Limits (50 - 2,000 ETB) ---');

    // Withdrawal 30 (under 50)
    const withUnder = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 30, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const withUnderData = await withUnder.json();
    console.log('Withdrawal 30 ETB response:', withUnder.status, withUnderData.error);
    if (withUnder.status !== 400 || !withUnderData.error?.includes('50 and 2,000 ETB')) {
      throw new Error(`Expected rejection for withdrawal under 50 ETB, got: ${JSON.stringify(withUnderData)}`);
    }
    console.log('✅ Withdrawal < 50 ETB correctly rejected!');

    // Withdrawal 2500 (over 2000)
    const withOver = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 2500, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const withOverData = await withOver.json();
    console.log('Withdrawal 2500 ETB response:', withOver.status, withOverData.error);
    if (withOver.status !== 400 || !withOverData.error?.includes('50 and 2,000 ETB')) {
      throw new Error(`Expected rejection for withdrawal over 2000 ETB, got: ${JSON.stringify(withOverData)}`);
    }
    console.log('✅ Withdrawal > 2,000 ETB correctly rejected!');

    // --- TEST 3: Minimum 5 Completed Games Rule ---
    console.log('\n--- TEST 3: Minimum 5 Completed Games Anti-Fraud Rule ---');

    // Check live eligibility for user with 0 completed games
    const elig1Res = await fetch(`${BASE_URL}/api/wallet/withdrawal-eligibility`, {
      headers: authHeaders
    });
    const elig1 = await elig1Res.json();
    console.log('Live eligibility (0 games):', elig1);
    if (elig1.eligible !== false || elig1.completedGames !== 0 || elig1.requiredGames !== 5) {
      throw new Error(`Expected ineligible with 0 completed games, got: ${JSON.stringify(elig1)}`);
    }

    // Attempt withdrawal with 0 completed games
    const withNoGames = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 100, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const withNoGamesData = await withNoGames.json();
    console.log('Withdrawal with 0 games response:', withNoGames.status, withNoGamesData.error);
    if (withNoGames.status !== 400 || !withNoGamesData.error?.includes('at least 5 games')) {
      throw new Error(`Expected rejection for < 5 completed games, got: ${JSON.stringify(withNoGamesData)}`);
    }
    console.log('✅ Withdrawal with 0 completed games correctly blocked with clear anti-fraud message!');

    // Simulate player completing 5 distinct game rounds
    console.log('\nSimulating 5 completed game rounds in DB...');
    for (let i = 1; i <= 5; i++) {
      const roundRes = await query(`
        INSERT INTO game_rounds (room_id, round_number, phase, total_pot, winner_payout)
        VALUES ('room-10', $1, 'ended', 50.00, 40.00)
        RETURNING id
      `, [90000 + i]);
      const roundId = roundRes.rows[0].id;

      await query(`
        INSERT INTO game_tickets (round_id, user_id, cartela_id, card_matrix, bet_amount, status)
        VALUES ($1, $2, $3, '[]'::jsonb, 10.00, 'won')
      `, [roundId, user.id, i]);
    }

    // Verify eligibility now says eligible = true
    const elig2Res = await fetch(`${BASE_URL}/api/wallet/withdrawal-eligibility`, {
      headers: authHeaders
    });
    const elig2 = await elig2Res.json();
    console.log('Live eligibility after 5 games:', elig2);
    if (elig2.eligible !== true || elig2.completedGames < 5) {
      throw new Error(`Expected eligible after 5 completed games, got: ${JSON.stringify(elig2)}`);
    }
    console.log('✅ Live eligibility unlocked: 5/5 completed games verified!');

    // --- TEST 4: Max 3 Withdrawals Per Day Rule ---
    console.log('\n--- TEST 4: Maximum 3 Withdrawals Per Day Rule ---');

    // Submit withdrawal 1 (50 ETB)
    const w1 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 50, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const w1Data = await w1.json();
    if (!w1Data.success) throw new Error(`Withdrawal 1 failed: ${w1Data.error}`);
    console.log('✅ Withdrawal 1/3 submitted successfully');

    // Submit withdrawal 2 (50 ETB)
    const w2 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 50, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const w2Data = await w2.json();
    if (!w2Data.success) throw new Error(`Withdrawal 2 failed: ${w2Data.error}`);
    console.log('✅ Withdrawal 2/3 submitted successfully');

    // Submit withdrawal 3 (50 ETB)
    const w3 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 50, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const w3Data = await w3.json();
    if (!w3Data.success) throw new Error(`Withdrawal 3 failed: ${w3Data.error}`);
    console.log('✅ Withdrawal 3/3 submitted successfully');

    // Check eligibility now: should be locked because todayWithdrawals = 3
    const elig3Res = await fetch(`${BASE_URL}/api/wallet/withdrawal-eligibility`, {
      headers: authHeaders
    });
    const elig3 = await elig3Res.json();
    console.log("Live eligibility after 3 withdrawals:", elig3);
    if (elig3.eligible !== false || elig3.todayWithdrawals !== 3) {
      throw new Error(`Expected ineligible when 3 withdrawals used today, got: ${JSON.stringify(elig3)}`);
    }

    // Submit withdrawal 4 (must be blocked!)
    const w4 = await fetch(`${BASE_URL}/api/wallet/withdraw`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ amount: 50, paymentMethod: 'Telebirr', accountPhone: testPhone })
    });
    const w4Data = await w4.json();
    console.log('Withdrawal 4 response:', w4.status, w4Data.error);
    if (w4.status !== 400 || !w4Data.error?.includes('Maximum 3 withdrawals allowed per day')) {
      throw new Error(`Expected daily limit rejection for 4th withdrawal, got: ${JSON.stringify(w4Data)}`);
    }
    console.log('✅ 4th withdrawal on same day successfully blocked with clear daily limit message!');

    console.log('\n🎉 ALL PHASE 3 FINANCIAL RULES & TURNOVER TESTS PASSED 100%!');
  } finally {
    // Cleanup test artifacts
    await query('DELETE FROM users WHERE id = $1', [user.id]).catch(() => {});
  }

  process.exit(0);
}

main().catch(err => {
  console.error('❌ Phase 3 Test Failed:', err);
  process.exit(1);
});
