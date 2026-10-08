-- 6.7-S2: admin API anahtari siralamasi tek ifadede (tek transaction) degisir.
-- Ayni saglayicinin anahtarlari kilitlenir, secilen anahtar komsusuyla yer degistirir ve
-- tum sira numaralari 10, 20, 30 diye yeniden yazilir. Yalnizca service role cagirir (admin ekrani sunucu kodu).
-- Komsu yoksa (en ustte/en altta) hicbir sey degismez ve false doner.

CREATE OR REPLACE FUNCTION public.move_api_key(p_id uuid, p_direction text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $f$
  WITH target_key AS (
    SELECT provider FROM public.api_keys WHERE id = p_id
  ),
  locked AS (
    SELECT k.id, k.priority, k.created_at
    FROM public.api_keys k
    JOIN target_key t ON k.provider = t.provider
    FOR UPDATE OF k
  ),
  ordered AS (
    SELECT id, row_number() OVER (ORDER BY priority, created_at, id) AS pos FROM locked
  ),
  me AS (
    SELECT o.pos, CASE p_direction WHEN 'up' THEN -1 WHEN 'down' THEN 1 END AS delta
    FROM ordered o WHERE o.id = p_id
  ),
  valid AS (
    SELECT me.pos, me.delta FROM me
    WHERE me.delta IS NOT NULL AND EXISTS (SELECT 1 FROM ordered o2 WHERE o2.pos = me.pos + me.delta)
  ),
  swapped AS (
    SELECT o.id,
      CASE WHEN o.pos = v.pos THEN v.pos + v.delta
           WHEN o.pos = v.pos + v.delta THEN v.pos
           ELSE o.pos END AS new_pos
    FROM ordered o CROSS JOIN valid v
  ),
  upd AS (
    UPDATE public.api_keys k SET priority = (s.new_pos * 10)::integer
    FROM swapped s
    WHERE k.id = s.id AND k.priority IS DISTINCT FROM (s.new_pos * 10)::integer
    RETURNING k.id
  )
  SELECT EXISTS (SELECT 1 FROM valid);
$f$;

REVOKE EXECUTE ON FUNCTION public.move_api_key(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.move_api_key(uuid, text) TO service_role;
