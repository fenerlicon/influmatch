-- Odeme teyidi 24 saat (kullanici karari 2026-11-24): marka "odeme yapildi" dedikten 24 saat sonra influencer teyit etmediyse
-- marka dekontla basvurur ("Odemeyi yaptim ama onaylanmadi"). Yeni anlasmazlik turu: payment_unconfirmed (bildiren marka).
-- Kisit genisletme (riskisiz, CLAUDE.md kural 4).
ALTER TABLE public.collaboration_disputes DROP CONSTRAINT IF EXISTS collaboration_disputes_kind_check;
ALTER TABLE public.collaboration_disputes
  ADD CONSTRAINT collaboration_disputes_kind_check CHECK (kind IN ('nonpayment', 'nondelivery', 'payment_unconfirmed'));
