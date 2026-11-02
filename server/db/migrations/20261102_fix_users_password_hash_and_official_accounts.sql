-- Phase 9 Migration: Fix users table schema, add official platform accounts management
-- Executed on Neon PostgreSQL

-- 1. Ensure 'updated_at' and 'password_hash' exist on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Synchronize existing pin_hash into password_hash for existing records
UPDATE users 
SET password_hash = pin_hash 
WHERE password_hash IS NULL AND pin_hash IS NOT NULL;

-- 2. Upgrade payment_accounts table for rich official account display
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS account_title VARCHAR(150);
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS badge VARCHAR(100);
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;

-- Ensure unique constraint on account_number if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'payment_accounts_account_number_key'
    ) THEN
        ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_account_number_key UNIQUE (account_number);
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 3. Upsert Official Sonic Accounts specified by user
INSERT INTO payment_accounts (provider, account_title, account_name, account_number, badge, is_active, display_order, daily_limit)
VALUES 
  ('Telebirr', 'TELEBIRR SUPER AGENT', 'Abduurehim Sheycho', '0952013863', '⚡ Instant Fast Track', true, 1, 500000.00),
  ('CBE', 'COMMERCIAL BANK OF ETHIOPIA', 'Sonic Gaming Operations', '1000458291048', '🏦 Direct Bank Transfer', true, 2, 1000000.00),
  ('M-Pesa', 'SAFARICOM M-PESA', 'Sonic Gaming Operations', '0712345678', '📲 Instant Till / Paybill', true, 3, 500000.00)
ON CONFLICT (account_number) DO UPDATE 
SET 
  provider = EXCLUDED.provider,
  account_title = EXCLUDED.account_title,
  account_name = EXCLUDED.account_name,
  badge = EXCLUDED.badge,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

