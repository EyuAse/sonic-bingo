-- Phase 1 Migration: Sonic Bingo Enqu System Requirements Upgrade
-- Executed on Neon PostgreSQL

-- 1. Update wallets.bonus default to 20.00 ETB
ALTER TABLE wallets ALTER COLUMN bonus SET DEFAULT 20.00;

-- 2. Update deposit_requests checks
DO $$
BEGIN
    ALTER TABLE deposit_requests DROP CONSTRAINT IF EXISTS deposit_requests_amount_check;
    ALTER TABLE deposit_requests DROP CONSTRAINT IF EXISTS deposit_requests_payment_method_check;
END $$;

ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_amount_check CHECK (amount >= 50);
ALTER TABLE deposit_requests ADD CONSTRAINT deposit_requests_payment_method_check CHECK (payment_method IN ('Telebirr', 'CBE', 'M-Pesa'));

-- 3. Update withdrawal_requests checks
DO $$
BEGIN
    ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_amount_check;
    ALTER TABLE withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_payment_method_check;
END $$;

ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_amount_check CHECK (amount >= 50 AND amount <= 5000);
ALTER TABLE withdrawal_requests ADD CONSTRAINT withdrawal_requests_payment_method_check CHECK (payment_method IN ('Telebirr', 'CBE', 'M-Pesa'));

-- 4. Update game_tickets cartela_id check to support up to 600 cartelas
DO $$
BEGIN
    ALTER TABLE game_tickets DROP CONSTRAINT IF EXISTS game_tickets_cartela_id_check;
END $$;

ALTER TABLE game_tickets ADD CONSTRAINT game_tickets_cartela_id_check CHECK (cartela_id BETWEEN 1 AND 600);

-- 5. Create coin_wallets
CREATE TABLE IF NOT EXISTS coin_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned INT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    lifetime_redeemed INT NOT NULL DEFAULT 0 CHECK (lifetime_redeemed >= 0),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coin_wallets_user ON coin_wallets(user_id);

-- 6. Create coin_transactions
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('earned_deposit', 'redeemed_bonus', 'admin_adjustment')),
    balance_after INT NOT NULL,
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_created ON coin_transactions(created_at DESC);

-- 7. Create jackpot_pool
CREATE TABLE IF NOT EXISTS jackpot_pool (
    room_id VARCHAR(50) PRIMARY KEY REFERENCES game_rooms(id),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    seed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (seed_amount >= 0),
    last_won_amount NUMERIC(12, 2) DEFAULT 0.00,
    last_winner_user_id UUID REFERENCES users(id),
    last_won_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. Create jackpot_winners
CREATE TABLE IF NOT EXISTS jackpot_winners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(50) NOT NULL REFERENCES game_rooms(id),
    round_id UUID REFERENCES game_rounds(id),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    balls_count INT NOT NULL,
    won_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jackpot_winners_room ON jackpot_winners(room_id);
CREATE INDEX IF NOT EXISTS idx_jackpot_winners_user ON jackpot_winners(user_id);

-- 9. Create agent_profiles
CREATE TABLE IF NOT EXISTS agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_code VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 10000.00 CHECK (wallet_balance >= 0),
    initial_deposit NUMERIC(12, 2) NOT NULL DEFAULT 10000.00,
    low_balance_threshold NUMERIC(12, 2) NOT NULL DEFAULT 1000.00,
    target_monthly NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 5.00,
    low_balance_alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_code ON agent_profiles(agent_code);
CREATE INDEX IF NOT EXISTS idx_agent_user ON agent_profiles(user_id);

-- 10. Create agent_recharge_requests
CREATE TABLE IF NOT EXISTS agent_recharge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 1000),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Telebirr', 'M-Pesa', 'CBE')),
    transaction_code VARCHAR(100) UNIQUE NOT NULL,
    receipt_image TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_recharge_status ON agent_recharge_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_recharge_agent ON agent_recharge_requests(agent_id);

-- 11. Create payment_accounts (for Banks & Payment Accounts Desk)
CREATE TABLE IF NOT EXISTS payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('Telebirr', 'M-Pesa', 'CBE')),
    account_number VARCHAR(100) NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    daily_limit NUMERIC(12, 2) DEFAULT 100000.00,
    current_daily_turnover NUMERIC(12, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_provider ON payment_accounts(provider);

-- 12. Seed default jackpot pools for all 4 rooms
INSERT INTO jackpot_pool (room_id, balance, seed_amount)
VALUES
    ('room-10', 500.00, 500.00),
    ('room-20', 1000.00, 1000.00),
    ('room-50', 2500.00, 2500.00),
    ('room-100', 5000.00, 5000.00)
ON CONFLICT (room_id) DO NOTHING;

-- 13. Seed default payment accounts
INSERT INTO payment_accounts (provider, account_number, account_name, is_active)
VALUES
    ('Telebirr', '0998983344', 'Sonic Bingo Official (Telebirr)', TRUE),
    ('CBE', '1000492817263', 'Sonic Bingo Games CBE', TRUE),
    ('M-Pesa', '0701234567', 'Sonic Bingo M-Pesa Merchant', TRUE)
ON CONFLICT DO NOTHING;

-- 14. Seed default admin system settings for new rules
INSERT INTO admin_settings (key, value)
VALUES
    ('welcome_bonus_amount', '20.00'),
    ('referral_bonus_percent', '10.00'),
    ('coin_earning_multiplier', '1.5'),
    ('coin_redemption_rate', '100'),
    ('jackpot_percentage', '10.00'),
    ('house_commission_percent', '20.00'),
    ('winner_payout_percent', '70.00'),
    ('max_cartelas_per_player', '4'),
    ('max_cartelas_pool', '600'),
    ('lobby_time_seconds', '45'),
    ('min_deposit_amount', '50.00'),
    ('max_withdrawal_amount', '5000.00'),
    ('agent_initial_deposit', '10000.00'),
    ('agent_low_balance_warning', '1000.00')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 15. Ensure existing users have coin wallets initialized
INSERT INTO coin_wallets (user_id, balance, lifetime_earned, lifetime_redeemed)
SELECT id, 0, 0, 0 FROM users
ON CONFLICT (user_id) DO NOTHING;

