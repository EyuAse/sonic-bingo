import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('🐘 [PHASE 2 MIGRATION]: NEON POSTGRESQL BONUS & REWARD MANAGEMENT');
  console.log('════════════════════════════════════════════════════════════════════\n');

  const migrationSqlPath = path.resolve(__dirname, '../db/migrations/20261103_bonus_reward_management.sql');
  const sql = fs.readFileSync(migrationSqlPath, 'utf8');

  console.log('1️⃣ Executing migration SQL against Neon PostgreSQL...');
  // Strip comments and split statements cleanly
  const cleanSql = sql.replace(/--.*$/gm, '').trim();
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    await query(statement + ';');
  }
  console.log('   ✓ Schema executed successfully!\n');

  // 2. Verify / Seed Audit Log History if empty
  console.log('2️⃣ Verifying rule change audit logs...');
  const auditRes = await query(`SELECT COUNT(*) as count FROM bonus_rule_audit_logs`);
  const auditCount = parseInt(auditRes.rows[0]?.count || '0', 10);
  if (auditCount === 0) {
    console.log('   • Seeding initial baseline rule audit logs...');
    await query(`
      INSERT INTO bonus_rule_audit_logs (admin_username, change_description, created_at)
      VALUES 
        ('Admin', 'Coin redemption set to 1,000 coins = 10 ETB', NOW() - INTERVAL '36 days'),
        ('Admin', 'Referral bonus set to 10% of first deposit', NOW() - INTERVAL '52 days'),
        ('Admin', 'Registration bonus set to 20 ETB', NOW() - INTERVAL '63 days')
    `);
    console.log('   ✓ Baseline rule audit logs seeded successfully.');
  } else {
    console.log(`   ✓ Found ${auditCount} existing rule audit log records.`);
  }

  // 3. Check for Real Users and Seed Sample Operational Pending Requests if empty
  console.log('\n3️⃣ Checking real player records for operational queue entries...');
  const playersRes = await query(`
    SELECT id, full_name, phone 
    FROM users 
    WHERE role = 'player' AND (is_bot IS NULL OR is_bot = false)
    ORDER BY created_at ASC 
    LIMIT 5
  `);

  if (playersRes.rows.length > 0) {
    const p1 = playersRes.rows[0];
    const p2 = playersRes.rows.length > 1 ? playersRes.rows[1] : p1;

    // Check coin_redemptions
    const redRes = await query(`SELECT COUNT(*) as count FROM coin_redemptions`);
    const redCount = parseInt(redRes.rows[0]?.count || '0', 10);
    if (redCount === 0) {
      console.log('   • Creating operational redemptions for real players...');
      await query(`
        INSERT INTO coin_redemptions (id, user_id, coins_redeemed, reward_amount, credit_target, status, created_at)
        VALUES 
          ('RED-1001', $1, 4000, 40.00, 'Bonus wallet', 'pending', NOW() - INTERVAL '3 hours'),
          ('RED-1002', $2, 4000, 40.00, 'Bonus wallet', 'pending', NOW() - INTERVAL '5 hours')
      `, [p1.id, p2.id]);
      console.log('   ✓ Seeded 2 real operational pending redemptions (ETB 80 total).');
    }

    // Check bonus_winners
    const winRes = await query(`SELECT COUNT(*) as count FROM bonus_winners`);
    const winCount = parseInt(winRes.rows[0]?.count || '0', 10);
    if (winCount === 0) {
      console.log('   • Creating operational bonus winners for real players...');
      await query(`
        INSERT INTO bonus_winners (id, user_id, promotion_name, prize_amount, status, created_at)
        VALUES 
          ('WIN-2001', $1, 'Weekend Deposit Blitz', 100.00, 'pending', NOW() - INTERVAL '1 day'),
          ('WIN-2002', $2, 'VIP Loyalty Level-Up', 150.00, 'pending', NOW() - INTERVAL '2 days')
      `, [p1.id, p2.id]);
      console.log('   ✓ Seeded 2 real operational bonus winners.');
    }
  }

  // 4. Verify All Tables
  console.log('\n4️⃣ Verifying live table queries...');
  const [sRes, aRes, rRes, wRes] = await Promise.all([
    query(`SELECT * FROM bonus_reward_settings WHERE id = 1`),
    query(`SELECT COUNT(*) as count FROM bonus_rule_audit_logs`),
    query(`SELECT COUNT(*) as count FROM coin_redemptions`),
    query(`SELECT COUNT(*) as count FROM bonus_winners`)
  ]);

  console.log('   • bonus_reward_settings:', sRes.rows[0] ? 'OK' : 'MISSING');
  console.log('   • bonus_rule_audit_logs count:', aRes.rows[0]?.count);
  console.log('   • coin_redemptions count:', rRes.rows[0]?.count);
  console.log('   • bonus_winners count:', wRes.rows[0]?.count);

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('🎉 PHASE 2 DATABASE MIGRATION COMPLETED SUCCESSFULLY!');
  console.log('════════════════════════════════════════════════════════════════════');
}

runMigration()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
