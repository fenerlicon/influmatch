-- Revize üst sınırı 2 (kullanıcı kararı 2026-11-24). Kısıt daraltma olduğu için elle çalıştırılır (CLAUDE.md kural 4).
-- Uygulama zaten 0–2 dışını reddediyor (lib/collaboration-workspace-shared.ts AGREEMENT_LIMITS.maxRevisions); bu dosya
-- veritabanını da aynı kurala bağlar. 2026-11-24 kontrolü: canlıda hiç anlaşma kaydı yok (2'den büyük değer yok).
-- Önce kontrol (0 satır dönmeli; dönerse önce o anlaşmaları 2'ye indirin):
--   SELECT collaboration_id, revision_limit FROM public.collaboration_agreements WHERE revision_limit > 2;

BEGIN;
UPDATE public.collaboration_agreements SET revision_limit = 2 WHERE revision_limit > 2;
ALTER TABLE public.collaboration_agreements DROP CONSTRAINT IF EXISTS collaboration_agreements_revision_limit_check;
ALTER TABLE public.collaboration_agreements
  ADD CONSTRAINT collaboration_agreements_revision_limit_check CHECK (revision_limit BETWEEN 0 AND 2);
COMMIT;

-- Doğrulama:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'collaboration_agreements_revision_limit_check';
--   → CHECK (((revision_limit >= 0) AND (revision_limit <= 2)))
