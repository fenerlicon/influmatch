-- Ret nedeni ve itiraz (2026-10-26, SYSTEM_MAP 6.10). Admin bir reddi (hesap onayi, vergi levhasi, gorev gonderimi) nedenle verir;
-- karar moderation_decisions tablosuna yazilir. Kullanici karar basina bir kez itiraz eder (moderation_appeals, decision_id benzersiz).
-- Admin /admin/appeals ekraninda kabul eder (asil kayit yeniden incelemeye alinir) ya da yanitla reddeder.
-- Eklemeli degisiklik: iki yeni tablo (istemci rollerine tamamen kapali; okuma ve yazma yalnizca sunucu / service role, lib/moderation.ts),
-- itiraz ekleri icin ozel bir kova (istemciler dogrudan yukleyemez; sunucu imzali yukleme adresi verir). DROP yok, veri degisikligi yok.
-- Kullanici silinince kararlari ve itirazlari da silinir (ON DELETE CASCADE).

-- 1) Kararlar
CREATE TABLE IF NOT EXISTS public.moderation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('account', 'tax_document', 'task_submission')),
  subject_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  decision text NOT NULL DEFAULT 'rejected' CHECK (decision IN ('rejected')),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z_]{2,40}$'),
  reason_text text CHECK (reason_text IS NULL OR char_length(reason_text) <= 500),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_decisions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_user ON public.moderation_decisions USING btree (user_id, subject_type, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_subject ON public.moderation_decisions USING btree (subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_moderation_decisions_decided_by ON public.moderation_decisions USING btree (decided_by);

-- 2) Itirazlar (karar basina tek itiraz)
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id uuid NOT NULL UNIQUE REFERENCES public.moderation_decisions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  attachment_path text CHECK (attachment_path IS NULL OR char_length(attachment_path) <= 200),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'rejected')),
  response_text text CHECK (response_text IS NULL OR char_length(response_text) <= 1000),
  outcome text CHECK (outcome IS NULL OR outcome IN ('reopened', 'unchanged', 'rejected')),
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.moderation_appeals FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_status ON public.moderation_appeals USING btree (status, created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_user ON public.moderation_appeals USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_appeals_resolved_by ON public.moderation_appeals USING btree (resolved_by);

-- 3) Itiraz ekleri (PDF ya da gorsel, en fazla 5 MB). Ozel kova; politikasi yok, yalnizca service role erisir.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('appeal-files', 'appeal-files', false, 5242880, '{application/pdf,image/png,image/jpeg,image/jpg,image/webp}')
ON CONFLICT (id) DO NOTHING;
