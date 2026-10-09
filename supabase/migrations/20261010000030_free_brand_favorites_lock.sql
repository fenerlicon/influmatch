-- Ucretsiz marka sinirlari (3.17, 2026-10-10 karari): ucretsiz markada favori ve liste (Inflist) yok, yalnizca Spotlight
-- (Basic / Pro) markalarda. AYNI bayrak: free_brand_limits_enabled = false iken hicbir davranis degismez.
-- Sunucu kontrolu lib/favorites.ts icinde; bu tetikleyiciler DB tarafindaki yedektir (istemci oturumu icin).
-- Kayitli favoriler ve listeler silinmez; kilitliyken istemci oturumu bunlari ekleyemez, degistiremez, silemez.
-- Service role (hesap silme, admin) etkilenmez.
-- Eklemeli degisiklik: bir fonksiyon, uc BEFORE tetikleyici, kullanilmayan tablo yetkilerinin geri alinmasi.

-- 1) Kilit: bayrak acik + marka + aktif Spotlight yok. Plan kurali brand_limit_for() ve lib/brand-limits.ts ile ayni.

CREATE OR REPLACE FUNCTION public.brand_favorites_locked(p_brand uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce((SELECT value = 'true'::jsonb FROM public.platform_settings WHERE key = 'free_brand_limits_enabled'), false)
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = p_brand
        AND u.role = 'brand'
        AND NOT (u.spotlight_active IS TRUE AND (u.spotlight_expires_at IS NULL OR u.spotlight_expires_at > now()))
    );
$function$;
REVOKE EXECUTE ON FUNCTION public.brand_favorites_locked(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Ortak tetikleyici fonksiyonu: favorites (brand_id), favorite_lists (brand_id), favorite_list_items (listenin sahibi).

CREATE OR REPLACE FUNCTION public.enforce_brand_favorites_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  IF TG_TABLE_NAME = 'favorite_list_items' THEN
    IF public.brand_favorites_locked((SELECT fl.brand_id FROM public.favorite_lists fl WHERE fl.id = coalesce(NEW.list_id, OLD.list_id)))
       OR (TG_OP = 'UPDATE' AND public.brand_favorites_locked((SELECT fl.brand_id FROM public.favorite_lists fl WHERE fl.id = OLD.list_id))) THEN
      RAISE EXCEPTION 'brand_limit:favorites' USING ERRCODE = 'P0001';
    END IF;
  ELSIF public.brand_favorites_locked(CASE WHEN TG_OP = 'DELETE' THEN OLD.brand_id ELSE NEW.brand_id END)
     OR (TG_OP = 'UPDATE' AND public.brand_favorites_locked(OLD.brand_id)) THEN
    RAISE EXCEPTION 'brand_limit:favorites' USING ERRCODE = 'P0001';
  END IF;
  RETURN coalesce(NEW, OLD);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.enforce_brand_favorites_lock() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER enforce_brand_favorites_lock_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_favorites_lock();

CREATE OR REPLACE TRIGGER enforce_brand_favorites_lock_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.favorite_lists
  FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_favorites_lock();

CREATE OR REPLACE TRIGGER enforce_brand_favorites_lock_trigger
  BEFORE INSERT OR UPDATE OR DELETE ON public.favorite_list_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_brand_favorites_lock();

-- 3) Kullanilmayan yetkiler: anon bu tablolara hic yazmaz/okumaz (RLS zaten bos dondurur), TRUNCATE / REFERENCES / TRIGGER
-- istemcide hic gerekmez (TRUNCATE RLS ve tetikleyiciyi atlar).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.favorites FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.favorite_lists FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.favorite_list_items FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.favorites FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.favorite_lists FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.favorite_list_items FROM authenticated;
