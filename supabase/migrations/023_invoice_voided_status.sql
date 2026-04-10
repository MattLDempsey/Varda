-- Voided status for invoices that were paid and then cancelled.
-- The invoice stays in the records as a historical entry (never hard-
-- deleted) and the paid amount becomes a customer credit against the
-- job. Run as a standalone statement — ALTER TYPE ... ADD VALUE cannot
-- run inside a transaction block in some Postgres versions.

ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'Voided';
