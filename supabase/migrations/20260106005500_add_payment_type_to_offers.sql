ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash' CHECK (payment_type IN ('cash', 'barter'));
