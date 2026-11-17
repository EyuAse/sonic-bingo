-- ============================================================================
-- Fast Keno Production Schema Migration (100% Additive)
-- Touches ZERO existing tables (Bingo, Wallets, Users schemas completely frozen)
-- ============================================================================

-- 1. Standalone Keno Rounds Table (Persistent sequence, Provably Fair seeds)
CREATE TABLE IF NOT EXISTS keno_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_number BIGSERIAL UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'betting' CHECK (status IN ('betting', 'drawing', 'settled', 'cancelled')),
    drawn_numbers INT[] DEFAULT '{}',
    server_seed VARCHAR(128) NOT NULL,
    server_seed_hash VARCHAR(64) NOT NULL,
    client_seed VARCHAR(64) NOT NULL DEFAULT 'sonic-bingo-public',
    nonce BIGINT NOT NULL,
    total_bets_count INT NOT NULL DEFAULT 0,
    total_wagered NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_payout NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    drawn_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_keno_rounds_round_number ON keno_rounds(round_number DESC);
CREATE INDEX IF NOT EXISTS idx_keno_rounds_status ON keno_rounds(status);
CREATE INDEX IF NOT EXISTS idx_keno_rounds_settled_at ON keno_rounds(settled_at DESC);

-- 2. Standalone Keno Tickets Table (Player bets, spots, and winning settlements)
CREATE TABLE IF NOT EXISTS keno_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES keno_rounds(id) ON DELETE CASCADE,
    round_number BIGINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    selected_numbers INT[] NOT NULL CHECK (array_length(selected_numbers, 1) BETWEEN 1 AND 10),
    spot_count INT NOT NULL CHECK (spot_count BETWEEN 1 AND 10),
    bet_amount NUMERIC(12, 2) NOT NULL CHECK (bet_amount >= 5.00 AND bet_amount <= 500.00),
    is_bonus BOOLEAN NOT NULL DEFAULT FALSE,
    hit_numbers INT[] DEFAULT '{}',
    hit_count INT NOT NULL DEFAULT 0,
    multiplier NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    payout_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost', 'refunded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_keno_tickets_round_number ON keno_tickets(round_number);
CREATE INDEX IF NOT EXISTS idx_keno_tickets_user_id ON keno_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_keno_tickets_status ON keno_tickets(status);
CREATE INDEX IF NOT EXISTS idx_keno_tickets_created_at ON keno_tickets(created_at DESC);
