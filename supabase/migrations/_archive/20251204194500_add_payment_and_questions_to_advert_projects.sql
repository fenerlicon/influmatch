ALTER TABLE advert_projects
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'cash',
ADD COLUMN IF NOT EXISTS custom_questions jsonb DEFAULT '[]'::jsonb;
