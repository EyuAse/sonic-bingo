import { query } from '../db.ts';

async function run() {
  const res = await query('SELECT * FROM agent_withdrawal_requests ORDER BY created_at DESC LIMIT 5');
  console.log('WITHDRAWAL REQUESTS:');
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

