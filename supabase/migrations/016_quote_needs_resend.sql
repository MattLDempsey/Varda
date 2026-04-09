-- Tracks whether a quote has been changed since it was last sent to the
-- customer. Set to true whenever the totals (materials, etc.) are edited
-- after the customer has already received the quote, and cleared when the
-- updated quote is resent.

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS needs_resend boolean NOT NULL DEFAULT false;
