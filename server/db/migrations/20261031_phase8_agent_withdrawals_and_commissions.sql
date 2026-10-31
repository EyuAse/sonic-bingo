-- Phase 8 Migration: Decentralized Agent Withdrawals, Commission Wallet, and Payout Accounting
-- Executed on Neon PostgreSQL

-- 1. Agent Withdrawal Requests Table
CREATE TABLE IF NOT EXISTS agent_withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
    payout_method VARCHAR(50) NOT NULL CHECK (payout_method IN ('Telebirr', 'CBE', 'M-Pesa')),
    payout_account VARCHAR(100) NOT NULL,
    payout_account_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    agent_tx_ref VARCHAR(100),
    agent_commission_earned NUMERIC(10, 2) DEFAULT 0,
    player_balance_before NUMERIC(12, 2),
    player_balance_after NUMERIC(12, 2),
    agent_balance_before NUMERIC(12, 2),
    agent_balance_after NUMERIC(12, 2),
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_with_req_agent_status ON agent_withdrawal_requests(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_with_req_player_status ON agent_withdrawal_requests(player_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_with_req_created ON agent_withdrawal_requests(created_at DESC);

-- 2. Add commission_balance to agent_profiles
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS commission_balance NUMERIC(12, 2) DEFAULT 0.00;

-- 3. Agent Commission Payout Requests (for Option B: Request Bank/Telebirr Payout from Admin)
CREATE TABLE IF NOT EXISTS agent_commission_payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payout_method VARCHAR(50) NOT NULL CHECK (payout_method IN ('Telebirr', 'CBE')),
    payout_account VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agent_comm_payout_agent ON agent_commission_payout_requests(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_comm_payout_created ON agent_commission_payout_requests(created_at DESC);

-- 4. Update agent_commissions source_type constraint to support withdrawals & commission conversion
ALTER TABLE agent_commissions DROP CONSTRAINT IF EXISTS agent_commissions_source_type_check;
ALTER TABLE agent_commissions ADD CONSTRAINT agent_commissions_source_type_check 
    CHECK (source_type IN ('deposit', 'withdrawal', 'cashout_voucher', 'referral_first_deposit', 'commission_to_float'));

