-- Trigger function to handle new user creation and send welcome notification
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Create public user profile
  INSERT INTO public.users (id, email, role, full_name, username, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'role', 'influencer'),
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
    '/dashboard/influencer/profile' -- Default link, user will be redirected correctly anyway
  );

  RETURN new;
END;
$$;
