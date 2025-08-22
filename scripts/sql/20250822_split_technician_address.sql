-- Split technician address into discrete street field and drop legacy address column
BEGIN;

ALTER TABLE technicians ADD COLUMN IF NOT EXISTS street varchar(255);

-- Backfill street from legacy address (text before first comma, trimmed). If no comma, take full address.
UPDATE technicians
SET street = COALESCE(NULLIF(trim(split_part(address, ',', 1)), ''), address)
WHERE street IS NULL AND address IS NOT NULL;

-- Fallback: if still null, set to 'N/D' temporarily (should be rare) so we can enforce NOT NULL.
UPDATE technicians SET street = 'N/D' WHERE street IS NULL;

-- Make street required.
ALTER TABLE technicians ALTER COLUMN street SET NOT NULL;

-- Drop legacy combined address column if exists.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'technicians' AND column_name = 'address'
  ) THEN
    ALTER TABLE technicians DROP COLUMN address;
  END IF;
END $$;

COMMIT;