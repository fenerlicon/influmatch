-- ==============================================================================
-- 2026-10-26: Kurucu Uye rozeti (SYSTEM_MAP 3.21-N3)
--
-- ISTEGE BAGLI. Kod bu satir olmadan da calisir: ayar yoksa son tarih "belirlenmemis" sayilir ve
-- admin /admin/tasks sayfasindan tarihi kaydedince satir kendiliginden olusur. Bu dosya canli
-- veritabanini repodaki kayitla ayni tutmak icindir (MCP bu oturumda izin vermedi).
--
-- Supabase SQL Editor'de calistir. Eklemeli; tekrar calistirmak zararsizdir.
-- ==============================================================================

-- 1) Ayar anahtari: null = son tarih henuz belirlenmedi (o ana kadar dogrulanan herkes rozeti alir).
INSERT INTO public.platform_settings (key, value)
VALUES ('founder_badge_cutoff', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Kontrol: ayar ve mevcut rozet sahipleri (rol ve dogrulama durumuna gore).
SELECT key, value, updated_at FROM public.platform_settings WHERE key = 'founder_badge_cutoff';

SELECT u.role, u.verification_status, count(*) AS rozet_sahibi
FROM public.user_badges b
JOIN public.users u ON u.id = b.user_id
WHERE b.badge_id = 'founder-member'
GROUP BY 1, 2
ORDER BY 1, 2;

-- 3) BILGI (karar sende, SYSTEM_MAP 3.21-N4): eski kuralla ("ilk 1000 influencer", dogrulama sarti yok)
--    rozet almis ama hesabi dogrulanmamis olanlar. Kod verilmis rozeti geri almaz; silmek istersen
--    once listeye bak. Silme komutu bilerek yorum satirinda.
SELECT u.id, u.username, u.role, u.verification_status, b.earned_at
FROM public.user_badges b
JOIN public.users u ON u.id = b.user_id
WHERE b.badge_id = 'founder-member' AND u.verification_status IS DISTINCT FROM 'verified'
ORDER BY b.earned_at;

-- UPDATE public.users SET displayed_badges = array_remove(displayed_badges, 'founder-member')
--   WHERE id IN (SELECT b.user_id FROM public.user_badges b JOIN public.users u ON u.id = b.user_id
--                WHERE b.badge_id = 'founder-member' AND u.verification_status IS DISTINCT FROM 'verified');
-- DELETE FROM public.user_badges b USING public.users u
--   WHERE u.id = b.user_id AND b.badge_id = 'founder-member' AND u.verification_status IS DISTINCT FROM 'verified';
