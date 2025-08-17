DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'technicians' AND column_name = 'address_number'
	) THEN
		ALTER TABLE technicians ADD COLUMN address_number varchar(20);
	END IF;

	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_name = 'technicians' AND column_name = 'registration_type'
	) THEN
		ALTER TABLE technicians DROP COLUMN registration_type;
	END IF;
END $$;
