-- ==============================================================================
-- 2026-11-23: INFLUCASH (puan)
--
-- Supabase SQL Editor de bir kez calistirin. EKLEMELI ve tekrar calistirilabilir (IF NOT EXISTS / ON CONFLICT / CREATE OR REPLACE).
-- Icerik supabase/migrations/20261123000030_influcash.sql ile aynidir. Onkosul: gorev modulu (task_rewards) ve
-- 2026-11-23_odeme.sql (task_rewards.used_at kolonlari) once calistirilmis olmali.
-- Puan paraya cevrilemez ve devredilemez (sahip karari). Bayrak influcash_enabled varsayilan KAPALI: kapaliyken hicbir puan
-- yazilmaz, arayuz gizlidir. Admin /admin/influcash ekranindan acar.
--
-- Yeni tablolar istemci rollerine kapali dogar (RLS acik + yazma yetkileri geri alinir). Kullanici yalnizca kendi hareketlerini
-- ve bakiyesini okuyabilir. Butun yazimlar sunucuda (service role) yetki kontrolunden sonra, iki fonksiyonla:
--   influcash_apply   : tek hareket + bakiye ayni islemde (ayni kullanici + neden + referans ikinci kez yazilmaz)
--   influcash_redeem  : bakiye kilidi + bakiye kontrolu + saatlik sinir + stok + harcama hareketi + odul kaydi tek islemde
-- task_rewards tablosunda yalnizca genisletme: submission_id bos olabilir (Influcash odulu), kaynak kolonu eklenir. DROP yok, veri silme yok.
-- Sonda kontrol sorgulari var.
-- ==============================================================================

-- 1) Hareketler (yalnizca ekleme). amount artı (kazanim) ya da eksi (harcama, geri alim, admin duzeltmesi).
CREATE TABLE IF NOT EXISTS public.influcash_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0 AND amount BETWEEN -1000000 AND 1000000),
  reason text NOT NULL CHECK (reason IN (
    'collab_completed', 'ontime_delivery', 'ontime_payment', 'daily_login', 'login_streak', 'task',
    'profile_complete', 'account_verified', 'clawback', 'redeem', 'admin_adjust'
  )),
  ref text NOT NULL CHECK (char_length(ref) BETWEEN 1 AND 120),
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT influcash_ledger_once UNIQUE (user_id, reason, ref)
);
ALTER TABLE public.influcash_ledger ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.influcash_ledger FROM anon, authenticated;
REVOKE SELECT ON public.influcash_ledger FROM anon;
GRANT SELECT ON public.influcash_ledger TO authenticated;
CREATE INDEX IF NOT EXISTS idx_influcash_ledger_user ON public.influcash_ledger USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influcash_ledger_reason_ref ON public.influcash_ledger USING btree (reason, ref);
CREATE INDEX IF NOT EXISTS idx_influcash_ledger_created_by ON public.influcash_ledger USING btree (created_by);

-- 2) Bakiye (hareketlerle ayni islemde guncellenir; gosterimde eksi bakiye 0 sayilir).
CREATE TABLE IF NOT EXISTS public.influcash_balances (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influcash_balances ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.influcash_balances FROM anon, authenticated;
REVOKE SELECT ON public.influcash_balances FROM anon;
GRANT SELECT ON public.influcash_balances TO authenticated;

DO $p$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'influcash_ledger' AND policyname = 'influcash_ledger_select_own') THEN
    CREATE POLICY influcash_ledger_select_own ON public.influcash_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'influcash_balances' AND policyname = 'influcash_balances_select_own') THEN
    CREATE POLICY influcash_balances_select_own ON public.influcash_balances FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END
$p$;

-- 3) Katalog (admin duzenler). audience: creator (influencer / UGC), brand, all.
CREATE TABLE IF NOT EXISTS public.influcash_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  cost integer NOT NULL CHECK (cost BETWEEN 1 AND 1000000),
  audience text NOT NULL DEFAULT 'all' CHECK (audience IN ('creator', 'brand', 'all')),
  reward_type text NOT NULL CHECK (reward_type IN ('spotlight_days', 'discount_percent', 'partner_coupon')),
  plan text CHECK (plan IS NULL OR plan IN ('basic', 'pro')),
  days integer CHECK (days IS NULL OR days BETWEEN 1 AND 365),
  percent integer CHECK (percent IS NULL OR percent BETWEEN 1 AND 90),
  partner_name text CHECK (partner_name IS NULL OR char_length(partner_name) <= 120),
  active boolean NOT NULL DEFAULT false,
  stock integer CHECK (stock IS NULL OR stock >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT influcash_catalog_shape CHECK (
    (reward_type = 'spotlight_days' AND plan IS NOT NULL AND days IS NOT NULL)
    OR (reward_type = 'discount_percent' AND percent IS NOT NULL)
    OR (reward_type = 'partner_coupon' AND partner_name IS NOT NULL)
  )
);
ALTER TABLE public.influcash_catalog ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.influcash_catalog FROM anon, authenticated;
REVOKE SELECT ON public.influcash_catalog FROM anon, authenticated;

-- 4) Is ortagi kuponlari (yalnizca altyapi; influcash_partner_coupons_enabled KAPALI, arayuz gizli).
CREATE TABLE IF NOT EXISTS public.influcash_partner_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.influcash_catalog(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (char_length(code) BETWEEN 3 AND 64),
  expires_at timestamptz,
  assigned_to uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at timestamptz,
  redemption_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT influcash_partner_coupons_code UNIQUE (item_id, code)
);
ALTER TABLE public.influcash_partner_coupons ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.influcash_partner_coupons FROM anon, authenticated;
REVOKE SELECT ON public.influcash_partner_coupons FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_influcash_partner_coupons_free ON public.influcash_partner_coupons USING btree (item_id, created_at) WHERE assigned_to IS NULL;
CREATE INDEX IF NOT EXISTS idx_influcash_partner_coupons_assigned ON public.influcash_partner_coupons USING btree (assigned_to);

-- 5) Harcamalar (katalogdan alinan oduller).
CREATE TABLE IF NOT EXISTS public.influcash_redemptions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.influcash_catalog(id) ON DELETE SET NULL,
  item_title text NOT NULL,
  cost integer NOT NULL CHECK (cost > 0),
  reward_type text NOT NULL,
  task_reward_id uuid REFERENCES public.task_rewards(id) ON DELETE SET NULL,
  coupon_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.influcash_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.influcash_redemptions FROM anon, authenticated;
REVOKE SELECT ON public.influcash_redemptions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS idx_influcash_redemptions_user ON public.influcash_redemptions USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_influcash_redemptions_item ON public.influcash_redemptions USING btree (item_id);
CREATE INDEX IF NOT EXISTS idx_influcash_redemptions_reward ON public.influcash_redemptions USING btree (task_reward_id);

-- 6) Odul kaydi: Spotlight gun / indirim kodu mevcut gorev odulu yolundan (task_rewards) gecer; Influcash odulunde gonderim yok.
ALTER TABLE public.task_rewards ALTER COLUMN submission_id DROP NOT NULL;
ALTER TABLE public.task_rewards ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'task';
DO $c$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'task_rewards_source_check') THEN
    ALTER TABLE public.task_rewards ADD CONSTRAINT task_rewards_source_check
      CHECK (source IN ('task', 'influcash') AND (submission_id IS NOT NULL OR source = 'influcash'));
  END IF;
END
$c$;

-- 7) Ayarlar: bayraklar KAPALI. Kural tutarlari ve sinirlar koddaki varsayilanla baslar (lib/influcash-shared.ts), admin degistirir.
INSERT INTO public.platform_settings (key, value) VALUES
  ('influcash_enabled', 'false'::jsonb),
  ('influcash_partner_coupons_enabled', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 8) Tek hareket + bakiye. Ayni (kullanici, neden, referans) ikinci kez yazilmaz: NULL doner. Yeni bakiye doner.
CREATE OR REPLACE FUNCTION public.influcash_apply(p_user uuid, p_amount integer, p_reason text, p_ref text, p_note text, p_created_by uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  INSERT INTO public.influcash_ledger (user_id, amount, reason, ref, note, created_by)
  VALUES (p_user, p_amount, p_reason, p_ref, p_note, p_created_by)
  ON CONFLICT ON CONSTRAINT influcash_ledger_once DO NOTHING;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.influcash_balances AS b (user_id, balance, updated_at) VALUES (p_user, p_amount, now())
  ON CONFLICT (user_id) DO UPDATE SET balance = b.balance + EXCLUDED.balance, updated_at = now();
  RETURN (SELECT balance FROM public.influcash_balances WHERE user_id = p_user);
END
$f$;
REVOKE EXECUTE ON FUNCTION public.influcash_apply(uuid, integer, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.influcash_apply(uuid, integer, text, text, text, uuid) TO service_role;

-- 9) Harcama: tek islemde bakiye kilidi, saatlik sinir, urun / kitle / stok, bakiye kontrolu, odul kaydi, harcama hareketi.
--    p_redemption_id ve p_code sunucuda uretilir (kod cakismasinda sunucu yeniden dener). Hata kodlari: influcash_item_unavailable,
--    influcash_rate_limited, influcash_insufficient. Yeni bakiye doner.
CREATE OR REPLACE FUNCTION public.influcash_redeem(
  p_user uuid,
  p_item uuid,
  p_audience text,
  p_redemption_id uuid,
  p_code text,
  p_hourly_limit integer,
  p_reward_status text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
BEGIN
  INSERT INTO public.influcash_balances (user_id, balance) VALUES (p_user, 0) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.influcash_balances WHERE user_id = p_user FOR UPDATE;

  IF (SELECT count(*) FROM public.influcash_redemptions WHERE user_id = p_user AND created_at > now() - interval '1 hour') >= p_hourly_limit THEN
    RAISE EXCEPTION 'influcash_rate_limited' USING ERRCODE = 'P0001';
  END IF;
  PERFORM 1 FROM public.influcash_catalog WHERE id = p_item FOR UPDATE;
  IF NOT EXISTS (
    SELECT 1 FROM public.influcash_catalog c
     WHERE c.id = p_item AND c.active AND (c.audience = 'all' OR c.audience = p_audience) AND (c.stock IS NULL OR c.stock > 0)
  ) THEN
    RAISE EXCEPTION 'influcash_item_unavailable' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT balance FROM public.influcash_balances WHERE user_id = p_user) < (SELECT cost FROM public.influcash_catalog WHERE id = p_item) THEN
    RAISE EXCEPTION 'influcash_insufficient' USING ERRCODE = 'P0001';
  END IF;

  -- Spotlight gun / indirim kodu: gorev odulu tablosuna (satista mevcut yol), Influcash kaynakli.
  INSERT INTO public.task_rewards (id, submission_id, user_id, reward_type, reward_plan, reward_days, reward_percent, code, status, applied_at, source)
  SELECT p_redemption_id, NULL, p_user, c.reward_type, c.plan, c.days, c.percent,
         CASE WHEN c.reward_type = 'discount_percent' THEN p_code END,
         CASE WHEN c.reward_type = 'discount_percent' THEN 'applied' ELSE p_reward_status END,
         CASE WHEN c.reward_type = 'discount_percent' THEN now() END,
         'influcash'
    FROM public.influcash_catalog c
   WHERE c.id = p_item AND c.reward_type IN ('spotlight_days', 'discount_percent');

  -- Is ortagi kuponu: havuzdan bos bir kod ayrilir; yoksa urun tukenmis sayilir.
  IF (SELECT reward_type FROM public.influcash_catalog WHERE id = p_item) = 'partner_coupon' THEN
    UPDATE public.influcash_partner_coupons
       SET assigned_to = p_user, assigned_at = now(), redemption_id = p_redemption_id
     WHERE id = (
       SELECT pc.id FROM public.influcash_partner_coupons pc
        WHERE pc.item_id = p_item AND pc.assigned_to IS NULL AND (pc.expires_at IS NULL OR pc.expires_at > now())
        ORDER BY pc.created_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     );
    IF NOT FOUND THEN
      RAISE EXCEPTION 'influcash_item_unavailable' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.influcash_redemptions (id, user_id, item_id, item_title, cost, reward_type, task_reward_id, coupon_code)
  SELECT p_redemption_id, p_user, c.id, c.title, c.cost, c.reward_type,
         CASE WHEN c.reward_type IN ('spotlight_days', 'discount_percent') THEN p_redemption_id END,
         (SELECT pc.code FROM public.influcash_partner_coupons pc WHERE pc.redemption_id = p_redemption_id LIMIT 1)
    FROM public.influcash_catalog c
   WHERE c.id = p_item;

  INSERT INTO public.influcash_ledger (user_id, amount, reason, ref, note)
  SELECT p_user, -c.cost, 'redeem', p_redemption_id::text, left(c.title, 300) FROM public.influcash_catalog c WHERE c.id = p_item;
  UPDATE public.influcash_balances
     SET balance = balance - (SELECT cost FROM public.influcash_catalog WHERE id = p_item), updated_at = now()
   WHERE user_id = p_user;
  UPDATE public.influcash_catalog SET stock = stock - 1, updated_at = now() WHERE id = p_item AND stock IS NOT NULL;

  RETURN (SELECT balance FROM public.influcash_balances WHERE user_id = p_user);
END
$f$;
REVOKE EXECUTE ON FUNCTION public.influcash_redeem(uuid, uuid, text, uuid, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.influcash_redeem(uuid, uuid, text, uuid, text, integer, text) TO service_role;

-- Kontrol: bes tablo icin rls = true; bayraklar false; iki fonksiyon.
SELECT c.relname::text AS ad, c.relrowsecurity::text AS deger FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('influcash_ledger', 'influcash_balances', 'influcash_catalog', 'influcash_partner_coupons', 'influcash_redemptions')
UNION ALL SELECT key, value::text FROM public.platform_settings WHERE key IN ('influcash_enabled', 'influcash_partner_coupons_enabled')
UNION ALL SELECT 'fonksiyon', count(*)::text FROM pg_proc WHERE proname IN ('influcash_apply', 'influcash_redeem');
