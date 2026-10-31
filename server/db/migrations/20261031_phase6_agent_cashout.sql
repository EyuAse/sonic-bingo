-- Phase 6: Decentralized Agent Cash-Out Voucher Engine
-- Table: agent_cashout_vouchers

CREATE TABLE IF NOT EXISTS agent_cashout_vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_code VARCHAR(20) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'redeemed', 'cancelled', 'expired')),
    redeemed_by_agent_id UUID REFERENCES agent_profiles(id),
    redeemed_at TIMESTAMPTZ,
    agent_commission_earned NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON agent_cashout_vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_vouchers_user ON agent_cashout_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON agent_cashout_vouchers(status);

ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS cashout_commission_rate NUMERIC(5, 2) DEFAULT 1.50;

