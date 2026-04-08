-- Recurring jobs support
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurrence_rule text; -- 'annual', 'quarterly', 'monthly', 'custom'
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recurrence_interval_months integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS next_recurrence_date date;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES jobs(id);
