-- Lomi Bingo Production Database Schema (Neon PostgreSQL)
-- Multi-user Scalable Real-Time Gaming Engine for Telegram Mini App

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Optimized for Telegram Mini App Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE,
    telegram_username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30),
    pin_hash VARCHAR(255),
    avatar VARCHAR(255) DEFAULT '👤',
    photo_url TEXT,
    role VARCHAR(20) DEFAULT 'player' CHECK (role IN ('player', 'cashier', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure Telegram columns exist if users table was created earlier
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE users ALTER COLUMN pin_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS attached_accounts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_deposited BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_tg_username ON users(telegram_username);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_has_deposited ON users(has_deposited);

-- 2. Wallets Table (Strict Decimal Precision & ACID Safe)
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    bonus NUMERIC(12, 2) NOT NULL DEFAULT 50.00 CHECK (bonus >= 0),
    locked_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (locked_balance >= 0),
    currency VARCHAR(10) DEFAULT 'ETB',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- 3. Wallet Transactions (Immutable Ledger)
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet', 'win', 'bonus', 'refund', 'admin_adjustment')),
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_code VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'rejected', 'failed')),
    payment_method VARCHAR(50),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON wallet_transactions(reference_code);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_created ON wallet_transactions(created_at DESC);

-- 4. Deposit Requests (Telebirr & CBE Cashier Workflows)
CREATE TABLE IF NOT EXISTS deposit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Telebirr', 'CBE', 'M-Pesa')),
    player_phone VARCHAR(30) NOT NULL,
    transaction_ref VARCHAR(100) UNIQUE NOT NULL,
    receipt_image TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deposit_status ON deposit_requests(status);
CREATE INDEX IF NOT EXISTS idx_deposit_user ON deposit_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deposit_tx_ref ON deposit_requests(transaction_ref);

-- 5. Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50 AND amount <= 5000),
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('Telebirr', 'CBE', 'M-Pesa')),
    account_phone VARCHAR(30) NOT NULL,
    account_name VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_user ON withdrawal_requests(user_id);

-- 6. Game Rooms Table
CREATE TABLE IF NOT EXISTS game_rooms (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    stake_amount NUMERIC(10, 2) NOT NULL CHECK (stake_amount > 0),
    min_players INT NOT NULL DEFAULT 1,
    max_players INT NOT NULL DEFAULT 500,
    house_commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Game Rounds Table
CREATE TABLE IF NOT EXISTS game_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id VARCHAR(50) NOT NULL REFERENCES game_rooms(id),
    round_number INT NOT NULL,
    phase VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (phase IN ('lobby', 'locked', 'playing', 'winner', 'ended')),
    drawn_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_pot NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    winner_payout NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    winner_user_ids JSONB DEFAULT '[]'::jsonb,
    winner_cartelas JSONB DEFAULT '[]'::jsonb,
    winner_names JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_rounds_room ON game_rounds(room_id, created_at DESC);

-- 8. Game Tickets Table
CREATE TABLE IF NOT EXISTS game_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES game_rounds(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cartela_id INT NOT NULL CHECK (cartela_id BETWEEN 1 AND 600),
    card_matrix JSONB NOT NULL,
    bet_amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tickets_round ON game_tickets(round_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON game_tickets(user_id);

-- 9. Seed Default Game Rooms (Idempotent)
INSERT INTO game_rooms (id, name, stake_amount, min_players, max_players, house_commission_percent, is_active)
VALUES
    ('room-10', '10 Birr Room', 10.00, 3, 50, 10.00, TRUE),
    ('room-20', '20 Birr Room', 20.00, 3, 50, 10.00, TRUE),
    ('room-50', '50 Birr Room', 50.00, 3, 50, 10.00, TRUE),
    ('room-100', '100 Birr VIP Room', 100.00, 3, 50, 10.00, TRUE)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    stake_amount = EXCLUDED.stake_amount,
    house_commission_percent = EXCLUDED.house_commission_percent;

-- 10. Admin Dynamic System Settings (Bot Token, Channel ID, WebApp URL)
CREATE TABLE IF NOT EXISTS admin_settings (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. Telegram Marketing & Ads Broadcast Campaigns
CREATE TABLE IF NOT EXISTS telegram_broadcasts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    message_text TEXT NOT NULL,
    photo_url TEXT,
    button_text VARCHAR(100),
    button_url TEXT,
    target_type VARCHAR(50) DEFAULT 'all_users',
    target_id VARCHAR(100),
    pin_message BOOLEAN DEFAULT FALSE,
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_started BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bot_blocked BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON telegram_broadcasts(created_at DESC);

-- 12. Referral System (1-Time 10% First Deposit Game Bonus)
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    referred_user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_amount NUMERIC(12, 2) DEFAULT 0.00,
    deposit_amount NUMERIC(12, 2) DEFAULT 0.00,
    status VARCHAR(30) DEFAULT 'pending_deposit' CHECK (status IN ('pending_deposit', 'rewarded')),
    is_telegram_premium BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    rewarded_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);



-- 13. Coin Wallets Table (Loyalty Rewards 1.5x of deposit)
CREATE TABLE IF NOT EXISTS coin_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
    lifetime_earned INT NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
    lifetime_redeemed INT NOT NULL DEFAULT 0 CHECK (lifetime_redeemed >= 0),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coin_wallets_user ON coin_wallets(user_id);

-- 14. Coin Transactions Table (1,000 Coins = 20 ETB Redemption)
CREATE TABLE IF NOT EXISTS coin_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('earned_deposit', 'earned_gameplay', 'redeemed_bonus', 'admin_adjustment')),
    balance_after INT NOT NULL,
    reference_id VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_tx_created ON coin_transactions(created_at DESC);

-- 15. Progressive Jackpot Pool (10% pot allocation rollover)
CREATE TABLE IF NOT EXISTS jackpot_pool (
    room_id VARCHAR(50) PRIMARY KEY REFERENCES game_rooms(id),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    seed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (seed_amount >= 0),
    last_won_amount NUMERIC(12, 2) DEFAULT 0.00,
    last_winner_user_id UUID REFERENCES users(id),
    last_won_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 16. Progressive Jackpot Winners Ledger
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

-- 17. Agent Profiles Table (Decentralized Cashier Network)
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

-- 18. Agent Wallet Recharge Requests (Telebirr / M-Pesa / CBE)
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

-- 19. Payment Accounts (Admin Dynamic Accounts Rotation)
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

-- 20. Agent Cash-Out Vouchers (Counter Withdrawal Vouchers)
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

-- 21. Bonus Reward Settings Singleton Table
CREATE TABLE IF NOT EXISTS bonus_reward_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    reg_bonus_enabled BOOLEAN NOT NULL DEFAULT true,
    reg_bonus_amount NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (reg_bonus_amount >= 0),
    reg_bonus_expires_days INT NOT NULL DEFAULT 0 CHECK (reg_bonus_expires_days >= 0),
    ref_bonus_enabled BOOLEAN NOT NULL DEFAULT true,
    ref_bonus_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00 CHECK (ref_bonus_percent >= 0 AND ref_bonus_percent <= 100),
    ref_min_deposit NUMERIC(10, 2) NOT NULL DEFAULT 50.00 CHECK (ref_min_deposit >= 0),
    ref_max_cap NUMERIC(10, 2) NOT NULL DEFAULT 500.00 CHECK (ref_max_cap >= 0),
    coin_earning_enabled BOOLEAN NOT NULL DEFAULT true,
    coin_earning_rate NUMERIC(5, 2) NOT NULL DEFAULT 1.50 CHECK (coin_earning_rate >= 0),
    coin_redemption_coins_per_block INT NOT NULL DEFAULT 1000 CHECK (coin_redemption_coins_per_block > 0),
    coin_redemption_reward_etb NUMERIC(10, 2) NOT NULL DEFAULT 20.00 CHECK (coin_redemption_reward_etb > 0),
    coin_redemption_min_coins INT NOT NULL DEFAULT 1000 CHECK (coin_redemption_min_coins >= 0),
    coin_credit_target VARCHAR(50) NOT NULL DEFAULT 'Bonus wallet' CHECK (coin_credit_target IN ('Bonus wallet', 'Withdrawable wallet')),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 22. Bonus Rule Audit Logs Table
CREATE TABLE IF NOT EXISTS bonus_rule_audit_logs (
    id SERIAL PRIMARY KEY,
    admin_username VARCHAR(100) NOT NULL DEFAULT 'Admin',
    change_description TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bonus_rule_audit_created ON bonus_rule_audit_logs(created_at DESC);

-- 23. Coin Redemptions Table
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

-- 24. Bonus & Promotion Prize Winners Table
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


