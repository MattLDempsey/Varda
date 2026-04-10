-- Tracks when a customer was sent a booking confirmation for a scheduled
-- event. Set when the user clicks "Send confirmation" in the job panel.
-- Existing events are backfilled to now() so they're treated as
-- already-confirmed and don't trigger spurious resend prompts on the
-- first load after this migration runs.

ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

UPDATE schedule_events
SET confirmation_sent_at = now()
WHERE confirmation_sent_at IS NULL;
