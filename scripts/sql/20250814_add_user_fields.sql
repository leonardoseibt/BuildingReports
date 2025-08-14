-- Add optional profile image URL and phone columns to users table
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS profile_image_url varchar,
  ADD COLUMN IF NOT EXISTS phone varchar(32);

