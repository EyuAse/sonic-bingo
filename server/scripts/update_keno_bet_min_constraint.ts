/**
 * server/scripts/update_keno_bet_min_constraint.ts
 * Updates keno_tickets check constraint to support 1.00 ETB - 500.00 ETB
 * matching keno.html's starting stake of 2 ETB.
 */

import { query } from '../db.ts';

async function updateConstraint() {
  console.log('🔄 Updating keno_tickets bet_amount constraint on Neon PostgreSQL...');
  try {
    await query(`
      ALTER TABLE keno_tickets 
      DROP CONSTRAINT IF EXISTS keno_tickets_bet_amount_check;
      
      ALTER TABLE keno_tickets 
      ADD CONSTRAINT keno_tickets_bet_amount_check 
      CHECK (bet_amount >= 1.00 AND bet_amount <= 500.00);
    `);
    console.log('✅ PASS: keno_tickets bet_amount constraint updated to >= 1.00 ETB');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update constraint:', err);
    process.exit(1);
  }
}

updateConstraint();

