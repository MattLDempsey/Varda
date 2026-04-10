-- Internal (non-customer) calendar entries — travelling, stock check,
-- supply run, admin, training, etc. The category column tags an event
-- as internal and stores the preset key. NULL = customer job (existing
-- behaviour). When set, customer_name carries the preset's display name
-- and job_type is set to 'Internal' for legacy code paths that key off
-- it. job_id and customer_id stay null for internal events.

ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS category text;
