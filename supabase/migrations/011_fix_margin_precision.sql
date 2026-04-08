-- Fix: margin column too small — was numeric(5,4) which maxes at 9.9999
-- but we store margin as percentage (e.g. 66.5 not 0.665)
ALTER TABLE quotes ALTER COLUMN margin TYPE numeric(10,2);
