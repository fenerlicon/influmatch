-- Create system support user if not exists
INSERT INTO public.users (id, email, role, full_name, username, created_at, verification_status, bio)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'support@influmatch.com',
  'brand',
  'Influmatch Destek',
  'influmatch',
  timezone('utc', now()),
  'verified',
  'Influmatch resmi destek hesabı.'
)
ON CONFLICT (id) DO UPDATE SET
  full_name = 'Influmatch Destek',
  verification_status = 'verified';

-- Update the handle_new_auth_user function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  system_user_id uuid := '00000000-0000-0000-0000-000000000000';
  new_room_id uuid;
  user_role text;
BEGIN
  -- Get user role (default to influencer)
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'influencer');

  -- 1. Create public user profile
  INSERT INTO public.users (id, email, role, full_name, username, created_at)
  VALUES (
    new.id,
    new.email,
    user_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    timezone('utc', now())
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Send Welcome Notification
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    new.id,
    'Influmatch''e Hoş Geldin! 🎉',
    'Hesabın başarıyla oluşturuldu. Profilini tamamlayarak hemen işbirliklerine başlayabilirsin.',
    'system',
    '/dashboard/' || user_role || '/profile'
  );

  -- 3. Send Welcome Chat Message
  -- If user is influencer, create a chat with system support (brand)
  -- If user is brand, we could theoretically do the reverse, but system user is 'brand' role.
  -- Current rooms table requires one brand and one influencer (or offer/advert).
  -- So we can only support System(Brand) -> New User(Influencer).
  
  IF user_role = 'influencer' THEN
    -- Create room between System (Brand) and New User (Influencer)
    INSERT INTO public.rooms (brand_id, influencer_id)
    VALUES (system_user_id, new.id)
    RETURNING id INTO new_room_id;

    -- Add welcome message
    INSERT INTO public.messages (room_id, sender_id, content)
    VALUES (
      new_room_id,
      system_user_id,
      'Influmatch ailesine hoş geldin! 🎉\n\nProfilini tamamlayıp Instagram hesabını bağlayarak (Güven Skorunu artırarak) hemen markalarla işbirliğine başlayabilirsin.\n\nSoruların olursa buradan bize ulaşabilirsin.'
    );
  END IF;

  RETURN new;
END;
$$;

-- Drop trigger if exists to avoid duplication
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Re-create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_auth_user();
