-- Admin de geri bildirim gönderebilir; rol kısıtı yalnızca influencer/brand kabul ediyordu
-- (canlıda 2026-10-07'de uygulandı).
ALTER TABLE public.feedback_submissions DROP CONSTRAINT IF EXISTS feedback_submissions_role_check;
ALTER TABLE public.feedback_submissions
  ADD CONSTRAINT feedback_submissions_role_check
  CHECK (role = ANY (ARRAY['influencer'::text, 'brand'::text, 'admin'::text]));
