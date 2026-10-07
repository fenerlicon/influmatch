-- ==============================================================================
-- FIX: handle_new_auth_user verification_status NULL constraint violation
-- The previous trigger set verification_status to NULL for influencers, 
-- but the column has a NOT NULL constraint and a CHECK constraint ('pending', 'verified', 'rejected').
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  safe_role text;
  v_status text;
BEGIN
  -- 1. Rol Kontrolü
  safe_role := coalesce(new.raw_user_meta_data->>'role', 'influencer');
  IF safe_role NOT IN ('brand', 'influencer') THEN
    safe_role := 'influencer';
  END IF;

  -- 2. Verification status belirlenmesi (NOT NULL ve CHECK constraint uyumlu)
  -- Influencer'lar için de başlangıçta 'pending' veya bir varsayılan değer olmalı.
  -- Projeye göre influencerlar 'pending' ile başlar.
  v_status := 'pending';

  -- 3. Güvenli Insert
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    full_name, 
    username, 
    created_at, 
    verification_status, 
    spotlight_active
  )
  VALUES (
    new.id,
    new.email,
    safe_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    timezone('utc', now()),
    v_status,
    false
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    username = COALESCE(EXCLUDED.username, public.users.username);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Kayıt işleminin tamamen durmasını engellemek için hatayı yutuyoruz ama logluyoruz (warning olarak)
    RAISE WARNING 'handle_new_auth_user hatası: %', SQLERRM;
    RETURN NEW;
END;
$$;
