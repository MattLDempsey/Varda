-- Business customer support. A customer can be either an individual
-- (existing default) or a business. For businesses the invoice is
-- addressed to the company name with a "FAO contact_name" line, and
-- communications use the contact_name for the greeting.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_business boolean NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_name text;
