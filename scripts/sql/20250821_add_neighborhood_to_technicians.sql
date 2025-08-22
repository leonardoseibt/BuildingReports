-- Migration: Add neighborhood column to technicians
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS neighborhood varchar(128);

-- Backfill logic (noop currently): If existing address contains a pattern ' - Bairro X', extract? (Skipping complex parsing)
-- Future enhancement: parse address into street / neighborhood if desired.

-- No down migration provided inline; create a separate rollback script if needed.