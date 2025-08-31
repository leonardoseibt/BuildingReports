DO $$
BEGIN
	BEGIN
		ALTER TABLE buildings ADD COLUMN isopleth_code varchar(16);
	EXCEPTION WHEN duplicate_column THEN
		-- already exists, ignore
		NULL;
	END;
END $$;

-- Optionally backfill from city/isopleth coverage if desired (left blank for now)
