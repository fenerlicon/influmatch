-- advert_projects üzerindeki eski, gevşek politikalar kaldırılıyor (7.7-S2).
-- Politikalar OR ile birleştiği için doğrulama şartı olmayan eski INSERT/UPDATE kuralları
-- "yalnızca doğrulanmış marka" kuralını etkisiz bırakıyordu; "Anyone can view open projects"
-- (qual = true) ise taslak dahil tüm ilanları herkese açıyordu.
-- Kalan kurallar: doğrulanmış marka ekler/günceller, sahibi siler, açık ilanları herkes ve
-- taslağı sahibi görür. Web ve mobil zaten brand_user_id ile yazıyor.

DROP POLICY IF EXISTS "Brands can create projects" ON public.advert_projects;
DROP POLICY IF EXISTS "Brands can insert their own adverts" ON public.advert_projects;
DROP POLICY IF EXISTS "Brands can update own projects" ON public.advert_projects;
DROP POLICY IF EXISTS "Brands can update their own adverts" ON public.advert_projects;
DROP POLICY IF EXISTS "Anyone can view open projects" ON public.advert_projects;
DROP POLICY IF EXISTS "Brands can delete their own adverts" ON public.advert_projects; -- "Brands can delete their adverts" ile aynı

-- Eski şemaya (project_id / brand_id) bakan okuma kuralı; yerini advert_id tabanlı kurallar aldı.
DROP POLICY IF EXISTS "Users can view relevant applications" ON public.advert_applications;
