-- Tracks when a customer was sent a booking confirmation for a scheduled
-- event. Set when the user clicks "Send confirmation" in the job panel.
-- Existing events are backfilled to created_at so they don't show as
-- pending and trigger spurious resend prompts.

ALTER TABLE events ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;

UPDATE events
SET confirmation_sent_at = created_at
WHERE confirmation_sent_at IS NULL;
