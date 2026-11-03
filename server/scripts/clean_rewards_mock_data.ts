import { query, pool } from '../db.ts';

async function run() {
  console.log('🧹 Purging mock / demo reward data from database...');

  try {
    // 1. Delete mock seed rows from bonus_winners
    const delWinners = await query(`
      DELETE FROM bonus_winners 
      WHERE id IN ('WIN-2001', 'WIN-2002') 
         OR promotion_name LIKE '%Weekend Deposit Blitz%' 
         OR promotion_name LIKE '%VIP Loyalty Level-Up%'
      RETURNING id, promotion_name
    `);
    console.log(`✅ Deleted ${delWinners.rowCount} mock bonus_winners rows:`, delWinners.rows);

    // 2. Delete mock seed rows from coin_redemptions
    const delRedemptions = await query(`
      DELETE FROM coin_redemptions 
      WHERE id IN ('RED-1001', 'RED-1002')
      RETURNING id
    `);
    console.log(`✅ Deleted ${delRedemptions.rowCount} mock coin_redemptions rows:`, delRedemptions.rows);

    // 3. Delete mock seed rows from bonus_rule_audit_logs (the fake September entries)
    const delAudit = await query(`
      DELETE FROM bonus_rule_audit_logs 
      WHERE change_description LIKE '%Registration bonus set to 20 ETB%' 
         OR change_description LIKE '%Referral bonus set to 10%%' 
         OR change_description LIKE '%Coin redemption set to 1,000%'
      RETURNING id, change_description
    `);
    console.log(`✅ Deleted ${delAudit.rowCount} mock bonus_rule_audit_logs rows:`, delAudit.rows);

    // 4. Query real bonus transactions in wallet_transactions
    const realBonuses = await query(`
      SELECT 
        wt.id,
        wt.user_id,
        wt.amount,
        wt.balance_after,
        wt.reference_code,
        wt.payment_method,
        wt.description,
        wt.created_at,
        u.full_name,
        u.phone,
        u.telegram_username,
        u.telegram_id
      FROM wallet_transactions wt
      JOIN users u ON wt.user_id = u.id
      WHERE wt.type = 'bonus'
      ORDER BY wt.created_at DESC
      LIMIT 10
    `);
    console.log(`📊 Found ${realBonuses.rowCount} real bonus transactions in wallet_transactions:`);
    realBonuses.rows.forEach(r => {
      console.log(`  - [${r.id}] ${r.full_name} (${r.phone || r.telegram_id}): ${r.amount} ETB via ${r.payment_method || r.description} at ${r.created_at}`);
    });

  } catch (error) {
    console.error('❌ Error cleaning mock data:', error);
  } finally {
    await pool.end();
  }
}

run();

