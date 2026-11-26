-- ============================================================================
-- Affiliate Management System Migration (100% Additive & Non-Breaking)
-- Zero changes to existing Cashier Agents, Bingo, Keno, Deposits, or Withdrawals
-- ============================================================================

-- 1. Affiliates Directory & Balances
CREATE TABLE IF NOT EXISTS affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_code VARCHAR(32) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(40) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    payout_method VARCHAR(50) NOT NULL DEFAULT 'Telebirr',
    payout_account VARCHAR(120),
    payout_account_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT,
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0),
    pending_commission NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (pending_commission >= 0),
    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_earned >= 0),
    total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0),
    monthly_target_override INT,
    invited_by_token VARCHAR(100),
    application_notes TEXT,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_affiliates_phone ON affiliates(phone);
CREATE INDEX IF NOT EXISTS idx_affiliates_status ON affiliates(status, approval_status);

-- 2. Nullable Single-Affiliate Ownership Column on Users (Metadata-only O(1) ADD COLUMN)
ALTER TABLE users ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES affiliates(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_affiliate_id ON users(affiliate_id);

-- 3. Admin-Generated Shareable Affiliate Registration Links
CREATE TABLE IF NOT EXISTS affiliate_registration_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(64) UNIQUE NOT NULL,
    label VARCHAR(150),
    max_uses INT,
    uses_count INT NOT NULL DEFAULT 0,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_reg_links_token ON affiliate_registration_links(token);

-- 4. Six Independent Admin-Configurable Commission Rules (With Inline Version Tracking)
CREATE TABLE IF NOT EXISTS affiliate_commission_rules (
    id SERIAL PRIMARY KEY,
    commission_type VARCHAR(40) UNIQUE NOT NULL CHECK (
        commission_type IN ('registration', 'first_deposit', 'regular_deposit', 'target', 'monthly', 'loyalty')
    ),
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    calc_mode VARCHAR(20) NOT NULL DEFAULT 'percent' CHECK (calc_mode IN ('percent', 'fixed')),
    rate_or_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    min_qualifying_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_monthly_players INT NOT NULL DEFAULT 0,
    active_window_days INT NOT NULL DEFAULT 14,
    auto_approve BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed 6 Independent Default Commission Rules (idempotent)
INSERT INTO affiliate_commission_rules (
    commission_type, display_name, description, version, calc_mode,
    rate_or_amount, min_qualifying_deposit, min_monthly_players, active_window_days, auto_approve, is_active
) VALUES
    ('registration', 'Registration Commission', 'Fixed ETB reward for each successful referred player signup', 1, 'fixed', 10.00, 0.00, 0, 14, TRUE, TRUE),
    ('first_deposit', 'First Deposit Commission', '6% commission on a player''s first qualifying deposit above ETB 500', 1, 'percent', 6.00, 500.00, 0, 14, TRUE, TRUE),
    ('regular_deposit', 'Regular Deposit Commission', '2% commission on every subsequent deposit after first deposit', 1, 'percent', 2.00, 0.00, 0, 14, TRUE, TRUE),
    ('target', 'Monthly Target Commission', 'Reward when affiliate achieves monthly player registration target (default 50)', 1, 'fixed', 500.00, 0.00, 50, 14, FALSE, TRUE),
    ('monthly', 'Monthly Active Commission', '2% commission on deposits from active players (deposited in last 14 days)', 1, 'percent', 2.00, 0.00, 0, 14, FALSE, TRUE),
    ('loyalty', 'Loyalty Retention Commission', '1% loyalty commission on retained active referred players (14-day active)', 1, 'percent', 1.00, 0.00, 0, 14, FALSE, TRUE)
ON CONFLICT (commission_type) DO NOTHING;

-- 5. Global Affiliate Payout Settings (Single Row id = 1)
CREATE TABLE IF NOT EXISTS affiliate_payout_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    min_withdrawal_amount NUMERIC(12, 2) NOT NULL DEFAULT 100.00,
    payout_schedule_mode VARCHAR(30) NOT NULL DEFAULT 'end_of_month' CHECK (payout_schedule_mode IN ('end_of_month', 'anytime')),
    payout_window_days INT NOT NULL DEFAULT 3,
    updated_by UUID,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO affiliate_payout_settings (id, min_withdrawal_amount, payout_schedule_mode, payout_window_days)
VALUES (1, 100.00, 'end_of_month', 3)
ON CONFLICT (id) DO NOTHING;

-- 6. Immutable Commission Ledger (Snapshots rule_version & rate_applied at earn time)
CREATE TABLE IF NOT EXISTS affiliate_commissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    player_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    deposit_ref_id VARCHAR(120),
    commission_type VARCHAR(40) NOT NULL CHECK (
        commission_type IN ('registration', 'first_deposit', 'regular_deposit', 'target', 'monthly', 'loyalty')
    ),
    rule_version INT NOT NULL DEFAULT 1,
    calc_mode VARCHAR(20) NOT NULL DEFAULT 'percent',
    base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    rate_applied NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'reversed')),
    period_month VARCHAR(7),
    note TEXT,
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    reversed_by UUID,
    reversed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_comm_affiliate ON affiliate_commissions(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_comm_status ON affiliate_commissions(status, commission_type);
CREATE INDEX IF NOT EXISTS idx_aff_comm_player ON affiliate_commissions(player_user_id);

-- 7. Affiliate Wallet Transactions Ledger
CREATE TABLE IF NOT EXISTS affiliate_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL CHECK (
        type IN (
            'commission_approved',
            'manual_credit',
            'manual_debit',
            'recharge',
            'reversal_debit',
            'withdrawal_hold',
            'withdrawal_refund',
            'withdrawal_paid'
        )
    ),
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    reason TEXT NOT NULL,
    reference_id VARCHAR(120),
    performed_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_wallet_tx_affiliate ON affiliate_wallet_transactions(affiliate_id, created_at DESC);

-- 8. Affiliate Withdrawal Requests (Monthly Payout Schedule Governed)
CREATE TABLE IF NOT EXISTS affiliate_withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payout_method VARCHAR(50) NOT NULL DEFAULT 'Telebirr',
    payout_account VARCHAR(120) NOT NULL,
    payout_account_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    rejection_reason TEXT,
    payment_reference VARCHAR(120),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    paid_by UUID,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_withdrawals_aff ON affiliate_withdrawal_requests(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aff_withdrawals_status ON affiliate_withdrawal_requests(status);

-- 9. Affiliate Admin Audit Log (Tracks rule edits, adjustments, approvals, reversals)
CREATE TABLE IF NOT EXISTS affiliate_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID,
    admin_name VARCHAR(150),
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(100),
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_aff_audit_created ON affiliate_audit_logs(created_at DESC);
