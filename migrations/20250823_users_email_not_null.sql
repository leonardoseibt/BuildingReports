DO $$
BEGIN
  -- Replace NULL or empty emails with unique placeholder values
  UPDATE users
    SET email = CONCAT('unknown_', id, '@example.com')
    WHERE email IS NULL OR email = '';

  -- Ensure email column is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'email' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;
