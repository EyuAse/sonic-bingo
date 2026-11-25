-- ============================================================================
-- Additive Permanent Numeric Player ID (public_id) for All Users
-- Preserves existing UUID primary keys and touches zero Bingo/Deposit/Withdraw logic.
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS users_public_id_seq START WITH 600001 INCREMENT BY 1;

ALTER TABLE users ADD COLUMN IF NOT EXISTS public_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_public_id_unique'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_public_id_unique UNIQUE (public_id);
  END IF;
END $$;

ALTER TABLE users ALTER COLUMN public_id SET DEFAULT nextval('users_public_id_seq');

UPDATE users
SET public_id = nextval('users_public_id_seq')
WHERE public_id IS NULL;
