-- Snapshot of the date/start_time/end_time at the moment a customer was
-- last sent a booking confirmation. Lets us tell the difference between
-- "the schedule has actually moved since the customer was notified" and
-- "the user dragged the card and then put it back where it started".
-- The "needs resend" warning is now derived by comparing the live values
-- against this snapshot, instead of clearing confirmation_sent_at on every
-- time edit.

ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS confirmed_date date;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS confirmed_start_time text;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS confirmed_end_time text;

-- Backfill: any event already marked as confirmed has its current state
-- captured as the snapshot, so historical events don't suddenly look like
-- they've been moved.
UPDATE schedule_events
SET confirmed_date = date,
    confirmed_start_time = start_time,
    confirmed_end_time = end_time
WHERE confirmation_sent_at IS NOT NULL
  AND confirmed_date IS NULL;
