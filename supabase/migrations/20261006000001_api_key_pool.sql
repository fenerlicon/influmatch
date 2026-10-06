-- ==============================================================================
-- HARİCİ SERVİS ANAHTAR HAVUZU (Apify, Gemini)
--
-- - api_keys: Admin panelinden eklenen anahtarlar. Bir anahtar patladığında (geçersiz,
--   kredi veya kota bitti, hız limiti) uygulama onu işaretleyip sıradakine geçer.
-- - system_state: Saatlik kontrolün son çalışma zamanı ve e-posta uyarılarının tekrar
--   gönderilmemesi için kullanılan küçük anahtar-değer tablosu.
--
-- İki tabloya da sadece service role (sunucu) erişir: RLS açık, politika yok ve istemci
-- rollerinin tüm yetkileri geri alındı. Anahtarlar tarayıcıya hiçbir zaman gönderilmez.
--
-- Supabase SQL Editor uyumu: fonksiyonlarda DECLARE yok, yorumlarda tek tırnak yok.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('apify', 'gemini')),
  label text NOT NULL,
  secret text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('unknown', 'active', 'low_credit', 'exhausted', 'rate_limited', 'invalid', 'error')),
  status_message text,
  cooldown_until timestamptz,
  credit_used_usd numeric(12, 4),
  credit_limit_usd numeric(12, 4),
  credit_resets_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  last_error text,
  last_used_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, secret)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider_priority ON public.api_keys (provider, priority, created_at);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_keys FROM anon, authenticated;
GRANT ALL ON public.api_keys TO service_role;

CREATE TABLE IF NOT EXISTS public.system_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.system_state FROM anon, authenticated;
GRANT ALL ON public.system_state TO service_role;

-- Bir anahtar kullanımının sonucunu tek sorguda (atomik sayaçlarla) kaydeder.
-- Başarılı çağrı anahtarı tekrar aktif yapar; kredi uyarısı (low_credit) ise saatlik
-- kontrol kredi bilgisini güncelleyene kadar korunur.
CREATE OR REPLACE FUNCTION public.record_api_key_result(
  p_key_id uuid,
  p_success boolean,
  p_status text DEFAULT NULL,
  p_message text DEFAULT NULL,
  p_cooldown_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public.api_keys SET
    status = CASE
      WHEN p_success AND status = 'low_credit' THEN 'low_credit'
      WHEN p_success THEN 'active'
      ELSE coalesce(p_status, 'error')
    END,
    status_message = CASE
      WHEN p_success AND status = 'low_credit' THEN status_message
      WHEN p_success THEN NULL
      ELSE p_message
    END,
    cooldown_until = CASE WHEN p_success THEN NULL ELSE p_cooldown_until END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    success_count = success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failure_count = failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    last_error = CASE WHEN p_success THEN last_error ELSE p_message END,
    last_used_at = now(),
    last_success_at = CASE WHEN p_success THEN now() ELSE last_success_at END,
    last_failure_at = CASE WHEN p_success THEN last_failure_at ELSE now() END,
    updated_at = now()
  WHERE id = p_key_id;
$$;

REVOKE ALL ON FUNCTION public.record_api_key_result(uuid, boolean, text, text, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_api_key_result(uuid, boolean, text, text, timestamptz) TO service_role;
