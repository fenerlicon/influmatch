-- ==============================================================================
-- 2026-11-23: Odemeler ve abonelikler (SYSTEM_MAP 4.7, docs/PAYMENTS.md)
--
-- Eklemeli: uc yeni tablo, task_rewards tablosuna iki kolon, platform_settings anahtarlari ve
-- mevcut admin Spotlight uyeliklerinin subscriptions tablosuna aktarimi (tekrar calistirmak zararsiz).
-- Tablolar RLS ile ayni blokta kapatilir (yeni tablo varsayilan yetkilerle dogar).
-- Canliya: supabase/manual/2026-11-23_odeme.sql (ayni icerik; MCP bu oturumda izin vermedi).
-- ==============================================================================

-- 1) Abonelikler: her kaynak (iyzico, Apple, Google, admin, 0 TL kampanyasi, gorev odulu) tek tabloda.
--    Spotlight durumu (users.spotlight_*) bu tablodan tek sunucu fonksiyonuyla turetilir (lib/payments/subscriptions.ts).
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  billing_interval text CHECK (billing_interval IS NULL OR billing_interval IN ('mo', 'yr')),
  source text NOT NULL CHECK (source IN ('iyzico', 'apple', 'google', 'admin', 'promo', 'reward')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'past_due', 'canceled', 'expired')),
  current_period_start timestamptz,
  -- null = suresiz (yalnizca admin)
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  past_due_since timestamptz,
  grace_until timestamptz,
  iyzico_subscription_ref text UNIQUE,
  iyzico_customer_ref text,
  iyzico_pricing_plan_ref text,
  iyzico_checkout_token text UNIQUE,
  apple_original_transaction_id text UNIQUE,
  google_purchase_token text UNIQUE,
  store_product_id text,
  store_environment text,
  -- indirim: ilk ay yuzde 50 (0 TL donemi Pro) ya da gorev odulu kodu; birlesmez
  discount_kind text CHECK (discount_kind IS NULL OR discount_kind IN ('promo_first_period', 'task_code')),
  discount_percent integer CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90),
  discount_code text,
  discount_reward_id uuid REFERENCES public.task_rewards(id) ON DELETE SET NULL,
  -- scheduled: sonraki donem indirimli plana gecer; active: bu donem indirimli; done: normal plana donuldu
  discount_state text CHECK (discount_state IS NULL OR discount_state IN ('scheduled', 'active', 'done')),
  pending_plan text CHECK (pending_plan IS NULL OR pending_plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  renewal_reminder_for timestamptz,
  expiry_notice_for timestamptz,
  last_synced_at timestamptz,
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions USING btree (status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_by ON public.subscriptions USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_reward ON public.subscriptions USING btree (discount_reward_id);
-- Kullanici basina en fazla bir canli ucretli abonelik (web ya da magaza; capraz platform kurali).
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_one_paid
  ON public.subscriptions USING btree (user_id)
  WHERE source IN ('iyzico', 'apple', 'google') AND status IN ('pending', 'active', 'past_due');
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subscriptions FROM anon, authenticated;
REVOKE SELECT ON public.subscriptions FROM anon;

-- 2) Odemeler: her tahsilat (ve iade kaydi). Kart verisi hic tutulmaz.
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('iyzico', 'apple', 'google')),
  provider_order_ref text NOT NULL,
  provider_payment_id text,
  plan text CHECK (plan IS NULL OR plan IN ('ibasic', 'ipro', 'mbasic', 'mpro')),
  billing_interval text CHECK (billing_interval IS NULL OR billing_interval IN ('mo', 'yr')),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'TRY',
  status text NOT NULL CHECK (status IN ('success', 'failed', 'refunded', 'partially_refunded', 'canceled')),
  period_start timestamptz,
  period_end timestamptz,
  discount_percent integer CHECK (discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90),
  failure_reason text CHECK (failure_reason IS NULL OR char_length(failure_reason) <= 300),
  refunded_amount numeric(12, 2),
  refunded_at timestamptz,
  refund_note text CHECK (refund_note IS NULL OR char_length(refund_note) <= 500),
  refunded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- e-Arsiv fatura yer tutucusu (saglayici secilince lib/payments/invoice.ts)
  invoice_status text NOT NULL DEFAULT 'pending' CHECK (invoice_status IN ('pending', 'issued', 'failed', 'not_applicable')),
  invoice_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payments_provider_order_unique UNIQUE (provider, provider_order_ref)
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_subscription ON public.payments USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_refunded_by ON public.payments USING btree (refunded_by);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payments FROM anon, authenticated;
REVOKE SELECT ON public.payments FROM anon;

-- 3) Saglayici bildirimleri (iyzico webhook, Apple, Google): yalnizca ekleme, tekrar islenmez.
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('iyzico', 'apple', 'google')),
  idempotency_key text NOT NULL UNIQUE,
  event_type text,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- en aza indirilmis yuk: yalnizca referans kodlari ve olay turu, kart verisi yok
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_valid boolean,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  result text CHECK (result IS NULL OR char_length(result) <= 300)
);
CREATE INDEX IF NOT EXISTS idx_payment_events_subscription ON public.payment_events USING btree (subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user ON public.payment_events USING btree (user_id);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payment_events FROM anon, authenticated;
REVOKE SELECT ON public.payment_events FROM anon, authenticated;

-- 4) Okuma: kullanici yalnizca kendi aboneligini ve odemelerini gorur (kod zaten service role ile okur; bu dar bir yedek).
DO $pol$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Users read own subscriptions') THEN
    CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'Users read own payments') THEN
    CREATE POLICY "Users read own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
END $pol$;

-- 5) Gorev odulu indirim kodlari: tek kullanim (rezervasyon + kullanim zamani).
ALTER TABLE public.task_rewards ADD COLUMN IF NOT EXISTS used_at timestamptz;
ALTER TABLE public.task_rewards ADD COLUMN IF NOT EXISTS used_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_task_rewards_used_subscription ON public.task_rewards USING btree (used_subscription_id);

-- 6) Ayarlar (yalnizca service role). Satis ve magaza ici satin alma KAPALI gelir.
INSERT INTO public.platform_settings (key, value) VALUES
  ('payments_enabled', 'false'::jsonb),
  ('iap_enabled', 'false'::jsonb),
  ('promo_ends_at', 'null'::jsonb),
  ('promo_discount_until', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7) Bugun admin tarafindan acilmis Spotlight uyelikleri abonelik kaydi olarak aktarilir (kaynak admin).
--    Boylece Spotlight durumu tek yerden turetilir; aktarilan kayit uyeligin bitis tarihini aynen tasir.
INSERT INTO public.subscriptions (user_id, plan, source, status, current_period_start, current_period_end, note)
SELECT u.id, u.spotlight_plan::text, 'admin', 'active', now(), u.spotlight_expires_at, 'Mevcut uyelik aktarildi (2026-11-23)'
FROM public.users u
WHERE u.spotlight_active = true
  AND u.spotlight_plan IS NOT NULL
  AND (u.spotlight_expires_at IS NULL OR u.spotlight_expires_at > now())
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id);
