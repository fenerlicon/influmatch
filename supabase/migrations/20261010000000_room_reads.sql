-- 5.3-S2: mesaj okundu bilgisi auth user_metadata yerine tabloda (JWT ve cerezi sisirmesin).
-- Kullanici yalnizca kendi satirini, yalnizca katildigi odalar icin okur/yazar.
-- Eski last_read_<roomId> metadata anahtarlari bir kez tabloya kopyalanir; anahtarlarin silinmesi sonraya birakildi.

CREATE TABLE IF NOT EXISTS public.room_reads (
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, room_id)
);

CREATE INDEX IF NOT EXISTS idx_room_reads_room_id ON public.room_reads USING btree (room_id);

-- Istemci saati ileride olsa bile okundu zamani sunucu saatini gecemez.
CREATE OR REPLACE FUNCTION public.room_reads_clamp_time()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $f$
BEGIN
  NEW.last_read_at := LEAST(COALESCE(NEW.last_read_at, now()), now());
  RETURN NEW;
END
$f$;
REVOKE EXECUTE ON FUNCTION public.room_reads_clamp_time() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS room_reads_clamp_time_trigger ON public.room_reads;
CREATE TRIGGER room_reads_clamp_time_trigger BEFORE INSERT OR UPDATE ON public.room_reads
  FOR EACH ROW EXECUTE FUNCTION public.room_reads_clamp_time();

ALTER TABLE public.room_reads ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.room_reads FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.room_reads TO authenticated;

DROP POLICY IF EXISTS "room_reads select own" ON public.room_reads;
CREATE POLICY "room_reads select own" ON public.room_reads AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "room_reads insert own" ON public.room_reads;
CREATE POLICY "room_reads insert own" ON public.room_reads AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_reads.room_id
        AND (r.brand_id = (SELECT auth.uid()) OR r.influencer_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "room_reads update own" ON public.room_reads;
CREATE POLICY "room_reads update own" ON public.room_reads AS PERMISSIVE FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.rooms r
      WHERE r.id = room_reads.room_id
        AND (r.brand_id = (SELECT auth.uid()) OR r.influencer_id = (SELECT auth.uid()))
    )
  );

-- Bir kerelik tasima: auth.users.raw_user_meta_data icindeki last_read_<roomId> anahtarlari.
-- Yalnizca var olan ve kullanicinin katildigi odalar; gecersiz zaman degerleri atlanir.
INSERT INTO public.room_reads (user_id, room_id, last_read_at)
SELECT u.id, r.id, (kv.value #>> '{}')::timestamptz
FROM auth.users u
CROSS JOIN LATERAL jsonb_each(COALESCE(u.raw_user_meta_data, '{}'::jsonb)) AS kv(key, value)
JOIN public.rooms r
  ON r.id::text = substring(kv.key FROM 11)
 AND (r.brand_id = u.id OR r.influencer_id = u.id)
WHERE kv.key ~ '^last_read_[0-9a-fA-F-]{36}$'
  AND jsonb_typeof(kv.value) = 'string'
  AND (kv.value #>> '{}') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}'
  AND EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = u.id)
ON CONFLICT (user_id, room_id) DO UPDATE
  SET last_read_at = GREATEST(public.room_reads.last_read_at, EXCLUDED.last_read_at);

-- Dogrulama
SELECT count(*) AS room_reads_satir FROM public.room_reads;
