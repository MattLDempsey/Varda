-- =============================================================================
-- 007: Multi-invoice support
-- Jobs can now have multiple invoices (deposits, progress, final)
-- =============================================================================

-- Add invoice type
CREATE TYPE invoice_type AS ENUM ('deposit', 'progress', 'final', 'custom');

-- Add type column to invoices (default 'final' for backward compat)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type invoice_type NOT NULL DEFAULT 'final';

-- Remove the UNIQUE-ish constraint implied by jobs.invoice_id (single invoice per job)
-- Jobs should no longer reference a single invoice — the relationship is invoices → job
-- We keep the column for backward compat but it's no longer the primary linkage
-- Going forward, query: SELECT * FROM invoices WHERE job_id = ?

-- Add an index for looking up invoices by job
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices (job_id);
