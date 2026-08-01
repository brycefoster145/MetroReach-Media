-- 002_client_password_hash.sql
-- Add password_hash to clients for email + password portal authentication.
--
-- Nullable on purpose: existing clients haven't set a password yet.
-- They complete account setup via their one-time portal_token
-- (/portal?token=XXX → "Set your password"), after which the token is
-- cleared and email + password login takes over.
--
-- Also applied idempotently by src/lib/migrate.ts on every deploy,
-- so this file is the source-of-truth record in the migrations dir.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash TEXT;
