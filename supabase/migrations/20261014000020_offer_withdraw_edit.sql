-- Teklif geri cekme ve duzenleme (2026-10-14, SYSTEM_MAP 3.6-N1 / 3.6-N2).
-- Marka bekleyen teklifini geri cekebilir (status = withdrawn) ya da duzenleyebilir (edited_at).
-- Iki islem de sunucuda (lib/offers.ts) rol ve sahiplik kontrolunden sonra service role ile yazilir.
-- Bu dosya DB yedegidir: istemci oturumu durumu withdrawn / expired yapamaz, teklif icerigini degistiremez,
-- created_at (7 gunluk sure) ve kimlik kolonlarina dokunamaz. Canliya 2026-10-14 uygulandi.

-- 1) Kolonlar ve durum kisiti (genisletme) -------------------------------------------------------

ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.offers ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_status_check,
  ADD CONSTRAINT offers_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text, 'withdrawn'::text]));

-- 2) Guncelleme korumasi -------------------------------------------------------------------------
-- Istemci (anon / authenticated) yalnizca alici influencer olarak bekleyen teklifin durumunu
-- accepted / rejected yapabilir. Kotaya sayilan created_at degismez; geri cekme ve duzenleme sunucudan.

CREATE OR REPLACE FUNCTION public.secure_offers_final()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
    -- Kimlik, tarih ve sunucu kolonlari istemciden degismez.
    NEW.id = OLD.id;
    NEW.sender_user_id = OLD.sender_user_id;
    NEW.receiver_user_id = OLD.receiver_user_id;
    NEW.created_at = OLD.created_at;
    NEW.edited_at = OLD.edited_at;
    NEW.withdrawn_at = OLD.withdrawn_at;
    -- Teklif icerigi yalnizca sunucudan (duzenleme bildirimi ve edited_at ile) degisir.
    NEW.budget = OLD.budget;
    NEW.message = OLD.message;
    NEW.campaign_name = OLD.campaign_name;
    NEW.campaign_type = OLD.campaign_type;
    NEW.payment_type = OLD.payment_type;

    -- Yanitlanmis, suresi dolmus, geri cekilmis ya da 7 gunu gecmis teklif degismez.
    IF OLD.status <> 'pending' OR OLD.created_at < now() - interval '7 days' THEN
      NEW.status = OLD.status;
      RETURN NEW;
    END IF;

    -- Durumu yalnizca alici influencer, yalnizca accepted / rejected yapabilir.
    IF auth.uid() IS DISTINCT FROM OLD.receiver_user_id OR NEW.status NOT IN ('pending', 'accepted', 'rejected') THEN
      NEW.status = OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Kolon yetkileri -----------------------------------------------------------------------------
-- Istemci yalnizca status kolonunu guncelleyebilir (influencer yaniti, lib/offers.ts respondToOfferAs).
-- Silme politikasi yok; anon yazma yetkileri gereksiz.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.offers FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.offers FROM authenticated;
GRANT UPDATE (status) ON public.offers TO authenticated;
