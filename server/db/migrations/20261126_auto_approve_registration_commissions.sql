-- Idempotent migration: enable auto_approve on registration commissions
-- so referred player signups credit the affiliate wallet immediately
-- while preserving withdrawal payout schedule & Admin Reverse controls.

UPDATE affiliate_commission_rules
SET auto_approve = TRUE,
    version = version + 1,
    updated_at = NOW()
WHERE commission_type = 'registration'
  AND auto_approve = FALSE;
