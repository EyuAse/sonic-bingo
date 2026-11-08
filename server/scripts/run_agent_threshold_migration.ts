import { pool, query } from '../db.ts';

async function migrate() {
  console.log('🚀 [Migration] Updating Agent Low-Balance Warning Alert Threshold to 5,000 ETB...');

  try {
    // 1. Alter table column default
    await query(`
      ALTER TABLE agent_profiles 
        ALTER COLUMN low_balance_threshold SET DEFAULT 5000.00;
    `);
    console.log('✅ Altered column default constraint to 5,000.00 ETB');

    // 2. Update existing rows where low_balance_threshold is 1000.00 or null
    const res = await query(`
      UPDATE agent_profiles 
        SET low_balance_threshold = 5000.00 
        WHERE low_balance_threshold = 1000.00 OR low_balance_threshold IS NULL
      RETURNING id, agent_code, wallet_balance, low_balance_threshold;
    `);
    console.log(`✅ Updated ${res.rowCount} agent profile(s) to 5,000.00 ETB threshold:`, res.rows);

    // 3. Verify all agent profiles
    const verify = await query(`
      SELECT id, agent_code, wallet_balance, low_balance_threshold FROM agent_profiles;
    `);
    console.log('📊 Current Agent Profiles Status:', verify.rows);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
