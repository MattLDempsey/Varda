-- Add materials_breakdown column to quotes table
-- Stores line-item materials as JSONB array: [{description, quantity, unitPrice}]
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS materials_breakdown jsonb DEFAULT '[]'::jsonb;
