import { pool } from '../db.ts';

async function migrate() {
  console.log('══════════════════════════════════════════════════════════════');
  console.log('🐘 MIGRATING AGENT COMMISSION PAYOUTS SCHEMA IN NEON DB');
  console.log('══════════════════════════════════════════════════════════════');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Add required columns to agent_commission_payout_requests
    console.log('1️⃣ Adding enhanced columns to agent_commission_payout_requests...');
    await client.query(`
      ALTER TABLE agent_commission_payout_requests
        ADD COLUMN IF NOT EXISTS code VARCHAR(50),
        ADD COLUMN IF NOT EXISTS account_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS payout_tx_ref VARCHAR(100),
        ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS first_approved_by UUID,
        ADD COLUMN IF NOT EXISTS first_approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS second_approved_by UUID,
        ADD COLUMN IF NOT EXISTS second_approved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    `);

    // 2. Drop existing status check constraints if any
    console.log('2️⃣ Updating status constraints...');
    const constraintRes = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'agent_commission_payout_requests'::regclass 
      AND contype = 'c';
    `);

    for (const row of constraintRes.rows) {
      if (row.conname.includes('status')) {
        console.log(`   Dropping old constraint: ${row.conname}`);
        await client.query(`ALTER TABLE agent_commission_payout_requests DROP CONSTRAINT IF EXISTS "${row.conname}"`);
      }
    }

    // 3. Normalize existing status values
    console.log('3️⃣ Normalizing existing statuses...');
    await client.query(`
      UPDATE agent_commission_payout_requests 
      SET status = CASE 
        WHEN status = 'pending' THEN 'Requested'
        WHEN status = 'approved' THEN 'Paid'
        WHEN status = 'rejected' THEN 'Rejected'
        ELSE status 
      END;
    `);

    // 4. Add updated status constraint
    await client.query(`
      ALTER TABLE agent_commission_payout_requests
        ADD CONSTRAINT agent_commission_payout_requests_status_check
        CHECK (status IN ('Requested', 'Under review', 'Awaiting 2nd approval', 'Paid', 'Rejected', 'pending', 'approved', 'rejected'));
    `);

    // 5. Populate code and initial timeline for any existing rows that have empty values
    console.log('4️⃣ Backfilling codes and timelines for existing rows...');
    const existingRes = await client.query(`
      SELECT id, status, amount, payout_method, payout_account, created_at, admin_notes, settled_at
      FROM agent_commission_payout_requests
      ORDER BY created_at ASC;
    `);

    for (let i = 0; i < existingRes.rows.length; i++) {
      const row = existingRes.rows[i];
      const code = `PO-${100 + i + 1}`;
      const createdStr = new Date(row.created_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
      
      const timeline: Array<[string, string]> = [];
      if (row.status === 'Paid') {
        const settledStr = row.settled_at ? new Date(row.settled_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : createdStr;
        timeline.push([settledStr, `Paid ${row.amount} ETB to ${row.payout_method} ${row.payout_account}. Reference ${row.admin_notes || 'DISBURSED'}. Agent notified`]);
      } else if (row.status === 'Rejected') {
        const settledStr = row.settled_at ? new Date(row.settled_at).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : createdStr;
        timeline.push([settledStr, `Rejected: ${row.admin_notes || 'Compliance mismatch'}. ${row.amount} ETB refunded to agent commission balance.`]);
      }
      timeline.push([createdStr, 'Cashout requested. Commission held']);

      await client.query(`
        UPDATE agent_commission_payout_requests
        SET code = COALESCE(code, $1),
            timeline = CASE WHEN timeline IS NULL OR timeline = '[]'::jsonb THEN $2::jsonb ELSE timeline END,
            payout_tx_ref = COALESCE(payout_tx_ref, admin_notes)
        WHERE id = $3
      `, [code, JSON.stringify(timeline), row.id]);
    }

    // 6. Ensure agent_commissions table has source_type index for fast float conversion lookups
    console.log('5️⃣ Creating performance indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_acpr_agent_status ON agent_commission_payout_requests(agent_id, status);
      CREATE INDEX IF NOT EXISTS idx_acpr_created_at ON agent_commission_payout_requests(created_at);
      CREATE INDEX IF NOT EXISTS idx_ac_source_type ON agent_commissions(source_type, created_at);
    `);

    await client.query('COMMIT');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('🎉 SCHEMA MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('══════════════════════════════════════════════════════════════');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();

