-- Gorevler (2026-10-18, docs/ROADMAP.md "Gorevler"): admin gorev acar, kullanici kanit gonderir, sistem olcer, admin onaylar,
-- odul "bekleyen odul" olarak durur; satis (POS) baslayinca admin hesaplara isler.
-- Ayrica: kisiye ozel davet kodu + kayit aninda davet kaydi (auth.users tetikleyicisi), gorev kanitlari icin ozel depo kovasi,
-- 0 TL donemi bayragi (promo_period_enabled; mavi tikte ek sart).
-- Eklemeli degisiklik: yeni tablolar (istemci rollerine tamamen kapali, okuma ve yazma yalnizca sunucu / service role),
-- bir fonksiyon + auth.users uzerinde yeni bir AFTER INSERT tetikleyici (kaydi asla engellemez), bir kova, bir ayar satiri,
-- varsayilan gorevler (KAPALI gelir; admin /admin/tasks'tan acar). DROP yok.

-- 1) Gorev tanimlari
CREATE TABLE IF NOT EXISTS public.platform_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('promo_video', 'story_link', 'invites', 'creator_first_collab', 'brand_first_steps', 'brand_first_collab')),
  audience text NOT NULL CHECK (audience IN ('creator', 'brand')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  reward_type text NOT NULL CHECK (reward_type IN ('spotlight_days', 'discount_percent')),
  reward_plan text CHECK (reward_plan IS NULL OR reward_plan IN ('basic', 'pro')),
  reward_days integer CHECK (reward_days IS NULL OR reward_days BETWEEN 1 AND 365),
  reward_percent integer CHECK (reward_percent IS NULL OR reward_percent BETWEEN 1 AND 90),
  max_rounds integer NOT NULL DEFAULT 1 CHECK (max_rounds BETWEEN 1 AND 10),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- null = rolun tum kullanicilari; dolu = yalnizca secilen kullanicilar
  target_user_ids uuid[] CHECK (target_user_ids IS NULL OR cardinality(target_user_ids) <= 1000),
  is_active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_tasks_reward_shape CHECK (
    (reward_type = 'spotlight_days' AND reward_plan IS NOT NULL AND reward_days IS NOT NULL)
    OR (reward_type = 'discount_percent' AND reward_percent IS NOT NULL)
  ),
  CONSTRAINT platform_tasks_window CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);
ALTER TABLE public.platform_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_tasks FROM anon, authenticated;

-- 2) Gonderimler (kullanici + gorev + tur basina en fazla bir canli/onayli kayit)
CREATE TABLE IF NOT EXISTS public.task_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.platform_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round integer NOT NULL DEFAULT 1 CHECK (round BETWEEN 1 AND 10),
  status text NOT NULL CHECK (status IN ('measuring', 'in_review', 'approved', 'rejected')),
  post_url text CHECK (post_url IS NULL OR char_length(post_url) <= 500),
  platform text CHECK (platform IS NULL OR platform IN ('instagram', 'tiktok')),
  proof_path text CHECK (proof_path IS NULL OR char_length(proof_path) <= 300),
  followers_at_submit bigint CHECK (followers_at_submit IS NULL OR followers_at_submit >= 0),
  required_views bigint CHECK (required_views IS NULL OR required_views >= 0),
  measure_due_at timestamptz,
  measured_views bigint CHECK (measured_views IS NULL OR measured_views >= 0),
  measured_likes bigint CHECK (measured_likes IS NULL OR measured_likes >= 0),
  measured_at timestamptz,
  measure_fail_count integer NOT NULL DEFAULT 0 CHECK (measure_fail_count BETWEEN 0 AND 100),
  has_ad_tag boolean,
  -- Sistem notu (esik alti, gonderiye ulasilamadi vb.); admin karar notu ayri
  check_note text CHECK (check_note IS NULL OR char_length(check_note) <= 300),
  review_note text CHECK (review_note IS NULL OR char_length(review_note) <= 500),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_submissions_live_round
  ON public.task_submissions USING btree (task_id, user_id, round) WHERE status IN ('measuring', 'in_review', 'approved');
CREATE INDEX IF NOT EXISTS idx_task_submissions_user ON public.task_submissions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_submissions_due ON public.task_submissions USING btree (measure_due_at) WHERE status = 'measuring';
CREATE INDEX IF NOT EXISTS idx_task_submissions_review ON public.task_submissions USING btree (created_at) WHERE status = 'in_review';
ALTER TABLE public.task_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_submissions FROM anon, authenticated;

-- 3) Bekleyen oduller (onaylanan gonderim basina bir odul)
CREATE TABLE IF NOT EXISTS public.task_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.task_submissions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reward_type text NOT NULL CHECK (reward_type IN ('spotlight_days', 'discount_percent')),
  reward_plan text CHECK (reward_plan IS NULL OR reward_plan IN ('basic', 'pro')),
  reward_days integer CHECK (reward_days IS NULL OR reward_days BETWEEN 1 AND 365),
  reward_percent integer CHECK (reward_percent IS NULL OR reward_percent BETWEEN 1 AND 90),
  code text UNIQUE CHECK (code IS NULL OR code ~ '^[A-Z0-9-]{6,20}$'),
  -- pending: satis bekleniyor; applied: sure hesaba islendi / kod kullanilabilir; cancelled: admin iptal etti
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'cancelled')),
  applied_at timestamptz,
  applied_plan text CHECK (applied_plan IS NULL OR applied_plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  applied_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_rewards_user ON public.task_rewards USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_task_rewards_pending ON public.task_rewards USING btree (created_at) WHERE status = 'pending';
ALTER TABLE public.task_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_rewards FROM anon, authenticated;

-- 4) Davet kodlari ve davet kayitlari
CREATE TABLE IF NOT EXISTS public.invite_codes (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{6,12}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invite_codes FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.user_invites (
  invitee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_invites_not_self CHECK (invitee_id <> inviter_id)
);
CREATE INDEX IF NOT EXISTS idx_user_invites_inviter ON public.user_invites USING btree (inviter_id);
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_invites FROM anon, authenticated;

-- Kayit aninda davet kodunu (auth user_metadata.invite_code) kaydeder. Hata kaydi asla engellemez.
-- Tetikleyici adi 'on_auth_user_created'dan sonra calisir (ayni olayda ada gore sira), public.users satiri hazirdir.
CREATE OR REPLACE FUNCTION public.record_user_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
DECLARE
  v_code text;
  v_inviter uuid;
BEGIN
  v_code := upper(btrim(coalesce(NEW.raw_user_meta_data ->> 'invite_code', '')));
  IF v_code = '' OR v_code !~ '^[A-Z0-9]{6,12}$' THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO v_inviter FROM public.invite_codes WHERE code = v_code;
  IF v_inviter IS NULL OR v_inviter = NEW.id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.user_invites (invitee_id, inviter_id, code) VALUES (NEW.id, v_inviter, v_code) ON CONFLICT DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.record_user_invite() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_invite ON auth.users;
CREATE TRIGGER on_auth_user_invite AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.record_user_invite();

-- 5) Gorev kanitlari (story ekran goruntusu). Ozel kova; istemciler dogrudan yukleyemez, sunucu imzali yukleme adresi verir.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('task-proofs', 'task-proofs', false, 5242880, '{image/png,image/jpeg,image/jpg,image/webp}')
ON CONFLICT (id) DO NOTHING;

-- 6) 0 TL donemi bayragi (kapali). Acikken mavi tik icin ek sart: onayli tanitim gorevi + en az 1 tamamlanan is birligi.
INSERT INTO public.platform_settings (key, value) VALUES ('promo_period_enabled', 'false'::jsonb) ON CONFLICT (key) DO NOTHING;

-- 7) Varsayilan gorevler (2026-10-18 kararlari). KAPALI gelir; tablo bossa eklenir.
INSERT INTO public.platform_tasks (kind, audience, title, description, reward_type, reward_plan, reward_days, reward_percent, max_rounds, params, sort_order)
SELECT v.kind, v.audience, v.title, v.description, v.reward_type, v.reward_plan, v.reward_days, v.reward_percent, v.max_rounds, v.params::jsonb, v.sort_order
FROM (VALUES
  ('promo_video', 'creator', 'Influmatch tanıtım videosu',
   'Influmatch''i anlatan bir Reels ya da TikTok videosu paylaş. Gönderide #reklam veya #işbirliği etiketi olmalı ve video en az 7 gün yayında kalmalı. 7. gün izlenme takipçi sayının %10''unu (en az 500) geçerse incelemeye alınır.',
   'spotlight_days', 'pro', 30, NULL::integer, 1, '{"view_ratio": 0.1, "min_views": 500, "hold_days": 7}', 10),
  ('story_link', 'creator', 'Davet bağlantılı story',
   'Davet bağlantınla bir story paylaş ve ekran görüntüsünü yükle. Story''de #reklam veya #işbirliği etiketi olmalı.',
   'discount_percent', NULL, NULL, 20, 1, '{}', 20),
  ('invites', 'creator', '3 doğrulanmış davet',
   'Davet kodunla kaydolan ve hesabını doğrulayan her 3 kişi bir tur sayılır (en fazla 3 tur).',
   'spotlight_days', 'basic', 30, NULL, 3, '{"per_round": 3}', 30),
  ('creator_first_collab', 'creator', 'Profilini tamamla, ilk işini bitir',
   'Profilini %100 doldur, fiyat kartına en az bir fiyat ekle ve ilk iş birliğini tamamla.',
   'discount_percent', NULL, NULL, 20, 1, '{}', 40),
  ('brand_first_steps', 'brand', 'İlk ilan ve ilk teklifler',
   'İlk ilanını aç ve en az 3 teklif gönder.',
   'discount_percent', NULL, NULL, 20, 1, '{"adverts": 1, "offers": 3}', 10),
  ('brand_first_collab', 'brand', 'İlk iş birliğini tamamla',
   'Influmatch üzerinden ilk iş birliğini tamamla.',
   'spotlight_days', 'basic', 30, NULL, 1, '{}', 20)
) AS v(kind, audience, title, description, reward_type, reward_plan, reward_days, reward_percent, max_rounds, params, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.platform_tasks);
