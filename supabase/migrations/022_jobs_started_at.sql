-- Tracks when a job actually started, separate from its scheduled
-- date/time. Set when the user taps "Start now" on the dashboard
-- prompt, NOT automatically when the scheduled time arrives — auto
-- transitions would lie about reality (running late, traffic,
-- last-minute cancellation) and corrupt downstream metrics.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at timestamptz;
