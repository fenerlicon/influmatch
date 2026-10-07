-- ==============================================================================
-- SIKAYET EDILEN MESAJ KALDIRILINCA DENETIM IZI
--
-- Admin sikayet edilen mesaji kaldirdiginda mesaj satiri silinmez (silme sikayet kaydini da
-- CASCADE ile siliyordu); icerik sabit bir metinle degistirilir ve orijinal icerik ilgili
-- sikayet kayitlarina message_snapshot olarak yazilir (app/admin/messages/actions.ts).
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tirnak yok, soru isareti yok.
-- ==============================================================================

ALTER TABLE public.message_reports ADD COLUMN IF NOT EXISTS message_snapshot text;
ALTER TABLE public.message_reports ADD COLUMN IF NOT EXISTS message_removed_at timestamptz;
