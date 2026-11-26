import 'dotenv/config';
import { query } from '../db.ts';
import { approveCommission } from '../services/affiliateCommissionService.ts';

async function main() {
  console.log('🔄 Enabling auto_approve on registration commission rule...');
  const ruleUpdate = await query(
    `UPDATE affiliate_commission_rules
     SET auto_approve = TRUE,
         version = version + 1,
         updated_at = NOW()
     WHERE commission_type = 'registration'
       AND auto_approve = FALSE
     RETURNING commission_type, version, auto_approve`
  );
  if (ruleUpdate.rows.length > 0) {
    console.log('✅ Updated registration rule:', ruleUpdate.rows[0]);
  } else {
    console.log('ℹ️ Registration rule already has auto_approve = TRUE.');
  }

  const pendingRes = await query<{ id: string; affiliate_id: string; amount: string }>(
    `SELECT id, affiliate_id, amount
     FROM affiliate_commissions
     WHERE commission_type = 'registration'
       AND status = 'pending'
     ORDER BY created_at ASC`
  );

  console.log(`📋 Found ${pendingRes.rows.length} pending registration commission(s) to approve.`);
  let approvedCount = 0;
  let failedCount = 0;

  for (const row of pendingRes.rows) {
    try {
      await approveCommission(
        row.id,
        { fullName: 'System Auto-Approve Migration' },
        'Auto-approved pending registration commission'
      );
      approvedCount += 1;
      console.log(`  ✅ Approved registration commission ${row.id} (ETB ${row.amount})`);
    } catch (err: any) {
      failedCount += 1;
      console.error(`  ❌ Failed to approve ${row.id}:`, err?.message || err);
    }
  }

  console.log(`🎉 Backfill complete: ${approvedCount} approved, ${failedCount} failed.`);
  process.exit(failedCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
