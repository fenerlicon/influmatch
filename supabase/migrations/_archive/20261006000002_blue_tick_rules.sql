-- ==============================================================================
-- MAVİ TİK: YENİ KURAL
--
-- Instagram/TikTok hesap doğrulaması artık kayıt aşamasında herkes için zorunlu olduğundan
-- mavi tik (verified-account rozeti) hesap sahipliğini değil seçkinliği gösterir:
--   aktif Spotlight üyeliği + doğrulanmış ve güncel hesap + en az 10.000 takipçi
--   + güven skoru 80 ve üzeri (kural: lib/blue-tick-rules.ts).
-- Rozetler saatlik görevde (/api/cron/hourly), istatistik yenilemede ve Spotlight
-- değişikliklerinde otomatik verilir ve geri alınır.
--
-- 1. users.blue_tick_override: admin istisnası. granted = kurala bakmadan ver,
--    revoked = asla verme, NULL = otomatik kural. İstemci rolleri bu kolonu okuyamaz
--    ve değiştiremez (kolon bazlı okuma yetkisi ve beyaz liste triggerı).
-- 2. Eski kurala göre (biyografi kodu ile) verilmiş tüm mavi tikler kaldırılır; yeni kurala
--    uyanlar ilk saatlik görevde veya admin panelindeki "Mavi tikleri yeniden değerlendir"
--    butonuyla geri alır.
--
-- Supabase SQL Editor uyumu: DECLARE yok, yorumlarda tek tırnak yok.
-- ==============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blue_tick_override text;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_blue_tick_override_check;
ALTER TABLE public.users ADD CONSTRAINT users_blue_tick_override_check
  CHECK (blue_tick_override IS NULL OR blue_tick_override IN ('granted', 'revoked'));

DELETE FROM public.user_badges WHERE badge_id = 'verified-account';

UPDATE public.users
SET displayed_badges = array_remove(displayed_badges, 'verified-account')
WHERE 'verified-account' = ANY (displayed_badges);
