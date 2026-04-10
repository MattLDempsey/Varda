-- Optional explicit start/end times for scheduled events. Used by the
-- Quick fit-in slot type so the user can pin a sub-1hr job to a specific
-- time in the day (e.g. "11:30 between the morning and afternoon blocks"),
-- and by half-day slots that have been auto-shrunk to make room for a
-- conflicting quick fit-in (e.g. morning trimmed from 08:00–12:00 to
-- 08:00–11:00 because a quick is booked at 11:00–12:00).
--
-- Stored as text in HH:MM format to match the native <input type="time">
-- value directly. When null, the .ics/display layer falls back to the
-- slot's symbolic default (08:00–12:00 morning, 12:00–17:00 afternoon,
-- 08:00–17:00 full).

ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS start_time text;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS end_time text;
