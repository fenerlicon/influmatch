-- ==============================================================================
-- 2026-10-09 TEKLİF DÜZELTMESİ — Supabase Dashboard > SQL Editor ekranında çalıştırın.
-- İçerik: 20261009000004 (offers.payment_type). Tekrar çalıştırılabilir.
-- ==============================================================================

-- ==============================================================================
-- 2026-10-09: offers.payment_type (SYSTEM_MAP 3.6-S5, KRİTİK)
--
-- Teklif penceresi 2026-01-06 tarihinden beri ödeme türünü (nakit / barter) payment_type kolonuna yazıyordu,
-- ama bu kolon tabloda yoktu: webden gönderilen hiçbir teklif kaydedilemedi (son teklif 2026-01-04).
-- Kolon eklenir; mevcut teklifler nakit sayılır. Kod kolon yokken de teklifi kaydedecek şekilde düzeltildi.
--
-- SQL Editor uyumu: yorumlarda tek tırnak ve soru işareti yok.
-- ==============================================================================

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'cash';

DO $c$ BEGIN
  ALTER TABLE public.offers ADD CONSTRAINT offers_payment_type_check CHECK (payment_type = ANY (ARRAY['cash'::text, 'barter'::text]));
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $c$;
