-- Add is_priority column to offers table
ALTER TABLE offers
ADD COLUMN is_priority BOOLEAN DEFAULT FALSE;

-- Create policy or index if needed (optional for small usage)
-- IDX for sorting efficiency
CREATE INDEX IF NOT EXISTS idx_offers_priority_created ON offers (is_priority DESC, created_at DESC);
