-- Extended profile fields for personal details.
-- These capture information useful both for the user's own business
-- operations and for anonymised aggregate data products.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address1 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address2 text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS postcode text;
