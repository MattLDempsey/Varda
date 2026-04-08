-- =============================================================================
-- 010: Add distance and postcode tracking to quotes
-- These fields capture valuable data for pricing intelligence
-- =============================================================================

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS job_postcode text DEFAULT '';
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS distance_miles numeric(6,1);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_name text DEFAULT '';

-- Also add customer_name to jobs for denormalized display
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_name text DEFAULT '';
