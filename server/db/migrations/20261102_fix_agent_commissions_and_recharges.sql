-- Phase 10 Migration: Fix agent_commissions table for Direct Cash-In and Recharges
-- Executed on Neon PostgreSQL

-- 1. Alter source_id from UUID to VARCHAR(100) to support 'AGT-DEP-XXXXXX'
ALTER TABLE agent_commissions ALTER COLUMN source_id TYPE VARCHAR(100);

-- 2. Update source_type constraint to include 'cash_in'
DO $$
BEGIN
    ALTER TABLE agent_commissions DROP CONSTRAINT IF EXISTS agent_commissions_source_type_check;
    ALTER TABLE agent_commissions ADD CONSTRAINT agent_commissions_source_type_check 
      CHECK (source_type IN ('deposit', 'cash_in', 'withdrawal', 'cashout_voucher', 'referral_first_deposit', 'commission_to_float', 'recharge'));
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Create indexes for high-speed timeframe queries
CREATE INDEX IF NOT EXISTS idx_recharge_req_agent_created ON agent_recharge_requests(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_comm_agent_created ON agent_commissions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apd_agent_created ON agent_player_deposits(agent_id, created_at DESC);
