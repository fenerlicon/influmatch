-- Update handle_new_auth_user trigger to support creator_type
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  safe_role text;
  v_status text;
  safe_creator_type text;
BEGIN
  -- 1. Rol Kontrolü
  safe_role := coalesce(new.raw_user_meta_data->>'role', 'influencer');
  IF safe_role NOT IN ('brand', 'influencer') THEN
    safe_role := 'influencer';
  END IF;

  -- 2. Creator Type Kontrolü
  safe_creator_type := coalesce(new.raw_user_meta_data->>'creator_type', 'influencer');
  IF safe_creator_type NOT IN ('influencer', 'ugc', 'both') THEN
    safe_creator_type := 'influencer';
  END IF;

  -- 3. Verification status belirlenmesi (NOT NULL ve CHECK constraint uyumlu)
  v_status := 'pending';

  -- 4. Güvenli Insert
  INSERT INTO public.users (
    id, 
    email, 
    role, 
    full_name, 
    username, 
    created_at, 
    verification_status, 
    spotlight_active,
    creator_type
  )
  VALUES (
    new.id,
    new.email,
    safe_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    timezone('utc', now()),
    v_status,
    false,
    safe_creator_type
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    username = COALESCE(EXCLUDED.username, public.users.username),
    creator_type = COALESCE(EXCLUDED.creator_type, public.users.creator_type);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user hatası: %', SQLERRM;
    RETURN NEW;
END;
$$;
