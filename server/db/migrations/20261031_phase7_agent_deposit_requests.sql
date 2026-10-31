-- Phase 7 Migration: Decentralized Agent Deposit Requests & Agent Anonymity Schema
-- Executed on Neon PostgreSQL

-- 1. Create agent_deposit_requests table
CREATE TABLE IF NOT EXISTS agent_deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Telebirr', 'CBE', 'M-Pesa')),
    player_phone VARCHAR(50) NOT NULL,
    transaction_code VARCHAR(100) NOT NULL,
    screenshot_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    rejection_reason TEXT,
    agent_balance_before NUMERIC(12, 2),
    agent_balance_after NUMERIC(12, 2),
    player_balance_before NUMERIC(12, 2),
    player_balance_after NUMERIC(12, 2),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_dep_req_agent_status ON agent_deposit_requests(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_dep_req_player ON agent_deposit_requests(player_id);
CREATE INDEX IF NOT EXISTS idx_dep_req_tx_code ON agent_deposit_requests(transaction_code);
CREATE INDEX IF NOT EXISTS idx_dep_req_created ON agent_deposit_requests(created_at DESC);

-- 2. Add payment rail columns and online availability flag to agent_profiles
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS telebirr_phone VARCHAR(30);
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS cbe_account VARCHAR(40);
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS mpesa_phone VARCHAR(30);
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;

-- 3. Create agent_commissions ledger table for 100% accurate commission accounting
CREATE TABLE IF NOT EXISTS agent_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
    source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('deposit', 'cashout_voucher', 'referral_first_deposit')),
    source_id UUID,
    amount NUMERIC(12, 2) NOT NULL,
    commission_rate NUMERIC(5, 2) NOT NULL,
    commission_earned NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_created ON agent_commissions(created_at DESC);

