-- ==============================================================================
-- 4. KAYIT (SIGNUP) SECURITY
-- AÇIK: Kullanıcı kayıt anında `raw_user_meta_data` içerisine JSON şeklinde {"role": "admin"} atarak veya
-- {"verification_status": "verified"} yollayarak auth.users tablosundan içeri sızabiliyor.
-- Yaptığımız Trigger, bu verileri auth.users'tan alıp public.users'a yapıştırıyor. (Büyük Açık!)
-- ==============================================================================

-- Mevcut güvenlik açığı olan trigger'ı düşürüyoruz
drop trigger if exists on_auth_user_created on auth.users;

-- Trigger'ı daha güvenli bir şekilde yeniden oluşturuyoruz
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
DECLARE
  safe_role text;
BEGIN
  -- 1. Rol Kontrolü: API'den "admin" veya alakasız bir rol gelirse zorla "influencer" yapıyoruz.
  -- Sadece "brand" ve "influencer" rollerine izin var.
  safe_role := coalesce(new.raw_user_meta_data->>'role', 'influencer');
  IF safe_role NOT IN ('brand', 'influencer') THEN
    safe_role := 'influencer';
  END IF;

  -- 2. "verification_status" veya "spotlight_active" gibi kritik verileri KAYIT ANINDA asla kabul etmiyoruz.
  -- Doğrudan standart değerlerle başlatıyoruz. Kimlik yaratılırken bunlar doldurulamaz.
  insert into public.users (id, email, role, full_name, username, created_at, verification_status, spotlight_active)
  values (
    new.id,
    new.email,
    safe_role,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'username',
    timezone('utc', now()),
    CASE WHEN safe_role = 'brand' THEN 'pending' ELSE NULL END, -- Brand için default 'pending' bırakalım, influencer için null kalsın.
    false -- Kayıtta kesinlikle spotlight aktif olamaz
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Güvenli trigger'ı tekrar auth_users üzerine takıyoruz.
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_auth_user();
