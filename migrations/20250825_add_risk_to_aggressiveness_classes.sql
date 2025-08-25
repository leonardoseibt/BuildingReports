-- Add risk column to aggressiveness classes (PostgreSQL)
ALTER TABLE aggressiveness_classes ADD COLUMN IF NOT EXISTS risk text NOT NULL DEFAULT 'Insignificante';
ALTER TABLE aggressiveness_classes
	ADD CONSTRAINT IF NOT EXISTS chk_aggr_risk CHECK (risk IN ('Insignificante','Pequeno','Grande','Elevado'));
