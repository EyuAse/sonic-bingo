-- ============================================================================
-- Migration: Bonus & Reward Management System (Phase 2)
-- Description: Production tables for bonus rules, audit logs, redemptions, and winners
-- Target: Neon Serverless PostgreSQL
-- ============================================================================

-- 1. Bonus Reward Settings Singleton Table
CREATE TABLE IF NOT EXISTS bonus_reward_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    reg_bonus_enabled BOOLEAN NOT NULL DEFAULT true,
    reg_bonus_amount NUMERIC(10, 2) NOT NULL DEFAULT 20.00 CHECK (reg_bonus_amount >= 0),
    reg_bonus_expires_days INT NOT NULL DEFAULT 0 CHECK (reg_bonus_expires_days >= 0),
    ref_bonus_enabled BOOLEAN NOT NULL DEFAULT true,
    ref_bonus_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (ref_bonus_percent >= 0 AND ref_bonus_percent <= 100),
    ref_min_deposit NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (ref_min_deposit >= 0),
    ref_max_cap NUMERIC(10, 2) NOT NULL DEFAULT 500.00 CHECK (ref_max_cap >= 0),
    coin_earning_enabled BOOLEAN NOT NULL DEFAULT true,
    coin_earning_rate NUMERIC(5, 2) NOT NULL DEFAULT 1.50 CHECK (coin_earning_rate >= 0),
    coin_redemption_coins_per_block INT NOT NULL DEFAULT 1000 CHECK (coin_redemption_coins_per_block > 0),
    coin_redemption_reward_etb NUMERIC(10, 2) NOT NULL DEFAULT 10.00 CHECK (coin_redemption_reward_etb > 0),
    coin_redemption_min_coins INT NOT NULL DEFAULT 1000 CHECK (coin_redemption_min_coins >= 0),
    coin_credit_target VARCHAR(50) NOT NULL DEFAULT 'Bonus wallet' CHECK (coin_credit_target IN ('Bonus wallet', 'Withdrawable wallet')),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed singleton initial configuration if not present
INSERT INTO bonus_reward_settings (
    id, reg_bonus_enabled, reg_bonus_amount, reg_bonus_expires_days,
    ref_bonus_enabled, ref_bonus_percent, ref_min_deposit, ref_max_cap,
    coin_earning_enabled, coin_earning_rate,
    coin_redemption_coins_per_block, coin_redemption_reward_etb, coin_redemption_min_coins, coin_credit_target
) VALUES (
    1, true, 20.00, 0,
    true, 10.00, 50.00, 500.00,
    true, 1.50,
    1000, 10.00, 1000, 'Bonus wallet'
) ON CONFLICT (id) DO NOTHING;

-- 2. Bonus Rule Audit Logs Table
CREATE TABLE IF NOT EXISTS bonus_rule_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_username VARCHAR(100) NOT NULL DEFAULT 'Admin',
    change_description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bonus_rule_audit_created ON bonus_rule_audit_logs(created_at DESC);

-- 3. Coin Redemptions Table
CREATE TABLE IF NOT EXISTS coin_redemptions (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coins_redeemed INT NOT NULL CHECK (coins_redeemed > 0),
    reward_amount NUMERIC(10, 2) NOT NULL CHECK (reward_amount > 0),
    credit_target VARCHAR(50) NOT NULL DEFAULT 'Bonus wallet' CHECK (credit_target IN ('Bonus wallet', 'Withdrawable wallet')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coin_redemptions_user ON coin_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_redemptions_status ON coin_redemptions(status);
CREATE INDEX IF NOT EXISTS idx_coin_redemptions_created ON coin_redemptions(created_at DESC);

-- 4. Bonus & Promotion Prize Winners Table
CREATE TABLE IF NOT EXISTS bonus_winners (
    id VARCHAR(50) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    promotion_name VARCHAR(255) NOT NULL,
    prize_amount NUMERIC(10, 2) NOT NULL CHECK (prize_amount > 0),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
    paid_by VARCHAR(100),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bonus_winners_user ON bonus_winners(user_id);
CREATE INDEX IF NOT EXISTS idx_bonus_winners_status ON bonus_winners(status);
CREATE INDEX IF NOT EXISTS idx_bonus_winners_created ON bonus_winners(created_at DESC);
