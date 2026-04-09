-- Soft delete support for jobs
-- Deleted jobs remain in the database so they can still appear in customer history
-- and be restored. Active job lists should filter on deleted_at IS NULL.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON jobs (deleted_at);
