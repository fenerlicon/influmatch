-- 3.6-S8 (2026-10-14, kullanici karari): marka teklifini geri cekince o teklif icin acilmis sohbet odasi kapanir.
-- Oda kapanisi sunucuda (lib/offers.ts withdrawOfferAs, service role) yazilir: rooms.closed_at + closed_reason
-- ve sistem mesaji (messages.is_system). Kapali odada gecmis gorunur, yeni mesaj yazilamaz.
-- DB yedegi: istemci oturumu (authenticated / anon) kapali odaya mesaj ekleyemez, sistem mesaji yazamaz,
-- kapali oda acamaz ve geri cekilmis teklif icin yeni oda acamaz. Service role etkilenmez.
-- Yalnizca ekleme: yeni kolonlar, kisit, iki tetikleyici. Mevcut politika ve tetikleyicilere dokunulmaz.

ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS closed_reason text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rooms_closed_reason_check') THEN
    ALTER TABLE public.rooms
      ADD CONSTRAINT rooms_closed_reason_check CHECK (closed_reason IS NULL OR closed_reason IN ('offer_withdrawn'));
  END IF;
END $$;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- Mesaj ekleme: kapali odaya istemciden mesaj yok; sistem mesajini yalnizca sunucu yazar.
CREATE OR REPLACE FUNCTION public.enforce_room_open_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
    NEW.is_system := false;
    IF EXISTS (SELECT 1 FROM public.rooms WHERE id = NEW.room_id AND closed_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Bu sohbet kapandı; yeni mesaj gönderilemez.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER enforce_room_open_on_message
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_open_on_message();

-- Oda ekleme: istemci kapali oda alanlarini yazamaz, geri cekilmis teklif icin oda acamaz.
CREATE OR REPLACE FUNCTION public.enforce_room_insert_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') IN ('authenticated', 'anon') THEN
    NEW.closed_at := NULL;
    NEW.closed_reason := NULL;
    IF NEW.offer_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.offers WHERE id = NEW.offer_id AND status = 'withdrawn') THEN
      RAISE EXCEPTION 'Marka bu teklifi geri çekti; sohbet açılamaz.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER enforce_room_insert_state
  BEFORE INSERT ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_room_insert_state();

REVOKE EXECUTE ON FUNCTION public.enforce_room_open_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_room_insert_state() FROM PUBLIC, anon, authenticated;
