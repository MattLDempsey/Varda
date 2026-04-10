-- Adds a 'quick' slot type for sub-1-hour jobs that fit alongside the
-- existing morning/afternoon/full half-day blocks. A day can have any
-- number of quick events stacked on top of its main slot, so a tradesperson
-- can fit a 20-minute repair in before their main morning job.
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE cannot run inside a transaction
-- block in some Postgres versions. If your migration runner wraps each
-- file in a transaction, run this statement on its own from the SQL
-- editor.

ALTER TYPE event_slot ADD VALUE IF NOT EXISTS 'quick';
