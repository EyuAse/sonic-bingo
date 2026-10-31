import dotenv from 'dotenv';
dotenv.config();

import { query } from '../db.ts';

async function check() {
  const d = await query(
    `SELECT id, reference_code, amount, payment_method, created_at 
     FROM agent_player_deposits 
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log('agent_player_deposits:', d.rows);

  const r = await query(
    `SELECT id, transaction_code, amount, status, created_at 
     FROM agent_deposit_requests 
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log('agent_deposit_requests:', r.rows);

  const w = await query(
    `SELECT id, amount, payout_method, status, agent_tx_ref, agent_commission_earned, created_at 
     FROM agent_withdrawal_requests 
     ORDER BY created_at DESC LIMIT 5`
  );
  console.log('agent_withdrawal_requests:', w.rows);

  process.exit(0);
}

check();

