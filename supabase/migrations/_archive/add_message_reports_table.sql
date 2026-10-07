-- Create message_reports table for reporting abusive or illegal messages
CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('harassment', 'spam', 'inappropriate', 'illegal', 'other')),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

-- Users can report messages
CREATE POLICY "Users can report messages"
  ON public.message_reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_user_id);

-- Users can view their own reports
CREATE POLICY "Users can view their own reports"
  ON public.message_reports
  FOR SELECT
  USING (auth.uid() = reporter_user_id);

-- Admins can view all reports (assuming admin role in users table)
CREATE POLICY "Admins can view all reports"
  ON public.message_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports"
  ON public.message_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_message_reports_message_id ON public.message_reports(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reporter_user_id ON public.message_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reported_user_id ON public.message_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_status ON public.message_reports(status);
CREATE INDEX IF NOT EXISTS idx_message_reports_created_at ON public.message_reports(created_at DESC);

