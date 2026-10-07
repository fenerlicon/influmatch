-- Eski kurallarımızı siliyoruz
drop policy if exists "Brands can manage their adverts" on public.advert_projects;
drop policy if exists "Brands can insert adverts if verified" on public.advert_projects;
drop policy if exists "Brands can update their adverts if verified" on public.advert_projects;
drop policy if exists "Brands can delete their adverts" on public.advert_projects;

-- 1. INSERT YETKİSİ: İlan oluştururken, kullancının 'brand' (marka) rolünde ve 'verified' (onaylanmış) olması şartı kondu.
create policy "Brands can insert adverts if verified"
  on public.advert_projects
  for insert
  with check (
    auth.uid() = brand_user_id
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.role = 'brand'
      and u.verification_status = 'verified'
    )
  );

-- 2. UPDATE YETKİSİ: Mevcut ilanını güncellerken yine marka ve onaylı olması gerekiyor. 
create policy "Brands can update their adverts if verified"
  on public.advert_projects
  for update
  using (
    auth.uid() = brand_user_id
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.role = 'brand'
      and u.verification_status = 'verified'
    )
  )
  with check (
    auth.uid() = brand_user_id
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.role = 'brand'
      and u.verification_status = 'verified'
    )
  );

-- 3. DELETE YETKİSİ: Kullanıcı ilanı silebilir (burada onay seviyesini kontrol etmeden silebilmelerine izin vermek mantıklı çünkü belki onayı düştü ama kendi pasif ilanını silmek isteyebilir).
create policy "Brands can delete their adverts"
  on public.advert_projects
  for delete
  using (auth.uid() = brand_user_id);
