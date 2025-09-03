-- Add admin flag and allowed modules to users
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill defaults explicitly (in case of NULLs)
UPDATE users SET is_admin = COALESCE(is_admin, false);
UPDATE users SET allowed_modules = COALESCE(allowed_modules, '[]'::jsonb);
