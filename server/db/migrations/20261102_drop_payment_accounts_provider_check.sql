-- Migration: Drop rigid payment_accounts_provider_check constraint
-- Allows admin to add any Ethiopian bank or payment rail (e.g. Bank of Abyssinia, Awash Bank, Dashen Bank, etc.)

ALTER TABLE payment_accounts DROP CONSTRAINT IF EXISTS payment_accounts_provider_check;

-- Ensure payment_accounts provider column can accept up to 100 characters
ALTER TABLE payment_accounts ALTER COLUMN provider TYPE VARCHAR(100);

-- Ensure index exists on provider for fast filtering
CREATE INDEX IF NOT EXISTS idx_payment_accounts_provider ON payment_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_payment_accounts_active ON payment_accounts(is_active);
