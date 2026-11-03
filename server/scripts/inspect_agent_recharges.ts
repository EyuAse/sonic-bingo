import { query, pool } from '../db.ts';

async function inspectTables() {
  try {
    const rechargeCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_recharge_requests'
      ORDER BY ordinal_position
    `);
    console.log('Columns of agent_recharge_requests:', JSON.stringify(rechargeCols.rows, null, 2));

    const agentCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'agent_profiles'
      ORDER BY ordinal_position
    `);
    console.log('Columns of agent_profiles:', JSON.stringify(agentCols.rows, null, 2));

    const recharges = await query(`SELECT * FROM agent_recharge_requests ORDER BY created_at DESC LIMIT 10`);
    console.log('Current rows in agent_recharge_requests:', JSON.stringify(recharges.rows, null, 2));

    const agents = await query(`SELECT id, user_id, agent_code, business_name, phone, status, balance, city, float_balance FROM agent_profiles LIMIT 10`);
    console.log('Current agents in agent_profiles:', JSON.stringify(agents.rows, null, 2));
  } catch (err: any) {
    console.error('Error inspecting:', err.message);
  } finally {
    await pool.end();
  }
}

inspectTables();

