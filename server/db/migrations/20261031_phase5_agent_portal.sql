-- Phase 5 Migration: Decentralized Agent Portal
-- Executed on Neon PostgreSQL

-- 1. Ensure 'agent' role is allowed on users table
DO $$
BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
END $$;

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('player', 'cashier', 'admin', 'agent'));

-- 2. Add agent_id link on users table to track referring agent
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agent_profiles(id);
CREATE INDEX IF NOT EXISTS idx_users_agent ON users(agent_id);

-- 3. Create agent_player_deposits table to track agent on-behalf-of deposits
CREATE TABLE IF NOT EXISTS agent_player_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agent_profiles(id) ON DELETE CASCADE,
    player_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 50),
    agent_balance_after NUMERIC(12, 2) NOT NULL CHECK (agent_balance_after >= 0),
    player_balance_after NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'Telebirr' CHECK (payment_method IN ('Telebirr', 'M-Pesa', 'Cash')),
    reference_code VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agent_deposits_agent ON agent_player_deposits(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_deposits_player ON agent_player_deposits(player_user_id);
CREATE INDEX IF NOT EXISTS idx_agent_deposits_created ON agent_player_deposits(created_at DESC);
