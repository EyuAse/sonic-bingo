-- Migration: Upgrade Agent Low-Balance Warning Alert Threshold to 5,000 ETB
-- Date: 2026-11-08

-- 1. Update column default to 5,000.00 ETB
ALTER TABLE agent_profiles 
  ALTER COLUMN low_balance_threshold SET DEFAULT 5000.00;

-- 2. Upgrade existing agents with 1,000.00 ETB or NULL to 5,000.00 ETB
UPDATE agent_profiles 
  SET low_balance_threshold = 5000.00 
  WHERE low_balance_threshold = 1000.00 OR low_balance_threshold IS NULL;

