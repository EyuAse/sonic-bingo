-- Upgrade payment_accounts for full Enqu Payment Accounts Luxury UI Feature Parity
-- Executed on Neon PostgreSQL

-- 1. Add missing fields to payment_accounts
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agent_profiles(id) ON DELETE SET NULL;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS max_per_deposit NUMERIC(12, 2) NOT NULL DEFAULT 1500.00;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS auto_pause_at_daily_limit BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'Active';
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- 2. Synchronize existing records
UPDATE payment_accounts 
SET status = CASE 
  WHEN is_active = true THEN 'Active' 
  ELSE 'Paused' 
END
WHERE status IS NULL OR status = 'Active';

-- Ensure at least one primary per provider for active accounts
WITH ranked_accounts AS (
  SELECT id, provider, ROW_NUMBER() OVER (PARTITION BY provider ORDER BY display_order ASC, created_at ASC) as rn
  FROM payment_accounts
  WHERE is_active = true
)
UPDATE payment_accounts pa
SET is_primary = true
FROM ranked_accounts ra
WHERE pa.id = ra.id AND ra.rn = 1 AND NOT EXISTS (
  SELECT 1 FROM payment_accounts WHERE provider = pa.provider AND is_primary = true
);

-- 3. Create payment_account_audit_logs table for real audit logging
CREATE TABLE IF NOT EXISTS payment_account_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_account_id UUID NOT NULL REFERENCES payment_accounts(id) ON DELETE CASCADE,
    actor_name VARCHAR(100) NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pa_audit_account ON payment_account_audit_logs(payment_account_id);
CREATE INDEX IF NOT EXISTS idx_pa_audit_created ON payment_account_audit_logs(created_at DESC);

-- 4. Seed initial audit log entries for existing records
INSERT INTO payment_account_audit_logs (payment_account_id, actor_name, action, created_at)
SELECT id, 'Admin', 'Account registered and operational', created_at
FROM payment_accounts pa
WHERE NOT EXISTS (
    SELECT 1 FROM payment_account_audit_logs WHERE payment_account_id = pa.id
);

