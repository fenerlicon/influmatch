-- ============================================================
-- Influmatch Seed Data
-- ============================================================

-- Clean up existing data to avoid conflicts
delete from public.advert_applications;
delete from public.advert_projects;
delete from public.offers;
delete from public.users where role in ('influencer', 'brand');

-- ============================================================
-- BRANDS
-- ============================================================
insert into public.users (
  id,
  role,
  email,
  full_name,
  username,
  category,
  city,
  bio,
  avatar_url,
  company_legal_name,
  tax_id,
  tax_id_verified,
  spotlight_active
)
values
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'brand',
    'marketing@techstyle.com',
    'TechStyle Co.',
    'techstyle',
    'Fashion',
    'İstanbul',
    'Giyilebilir teknoloji ve modern sokak modasının öncüsü.',
    'https://images.unsplash.com/photo-1599305445671-ac291c95aaa9?auto=format&fit=crop&w=400&q=80',
    'TechStyle Mağazacılık A.Ş.',
    '1234567890',
    true,
    true
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
    'brand',
    'contact@glowbeauty.com',
    'Glow Beauty',
    'glowbeauty',
    'Beauty',
    'İzmir',
    'Doğal içerikli, vegan ve hayvan dostu cilt bakım ürünleri.',
    'https://images.unsplash.com/photo-1596462502278-27bfdd403348?auto=format&fit=crop&w=400&q=80',
    'Glow Kozmetik Ltd. Şti.',
    '9876543210',
    true,
    false
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
    'brand',
    'hello@coffeelovers.com',
    'Coffee Lovers',
    'coffeelovers',
    'Lifestyle',
    'Ankara',
    '3. dalga kahve kültürünü evinize getiren abonelik kutusu.',
    'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=400&q=80',
    'Kahve Tutkusu Gıda A.Ş.',
    '5554443322',
    false,
    true
  );

-- ============================================================
-- INFLUENCERS
-- ============================================================
insert into public.users (
  id,
  role,
  email,
  full_name,
  username,
  category,
  city,
  bio,
  avatar_url,
  spotlight_active
)
values
  (
    uuid_generate_v4(),
    'influencer',
    'selin@influmatch-demo.com',
    'Selin Arslan',
    'selinlight',
    'Beauty',
    'İstanbul',
    'Lüks kozmetik ve skincare içerikleriyle 450K kadın kitlesine ulaşıyor.',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80',
    true
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'lara@influmatch-demo.com',
    'Lara Soydan',
    'laraso',
    'Fashion',
    'İzmir',
    'Sürdürülebilir moda hikâyeleri ve günlük kombin önerileri paylaşıyor.',
    'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=600&q=80',
    true
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'nihal@influmatch-demo.com',
    'Nihal Gürel',
    'nigurel',
    'Lifestyle',
    'Ankara',
    'Şehir yaşamı, kahve rotaları ve minimal yaşam içerikleri.',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=600&q=80',
    false
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'deniz@influmatch-demo.com',
    'Deniz Ersoy',
    'denizers',
    'Fashion',
    'İstanbul',
    'Premium erkek giyim kombinleri ve backstage vlogları.',
    'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=600&q=80',
    true
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'melisa@influmatch-demo.com',
    'Melisa Aydın',
    'meltheory',
    'Beauty',
    'Bursa',
    'Temiz içerik odaklı makyaj rutini videoları ve canlı yayınları.',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
    false
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'can@influmatch-demo.com',
    'Can Akdeniz',
    'cankolt',
    'Lifestyle',
    'Antalya',
    'Sahil yaşamı, boutique oteller ve kahvaltı rotaları.',
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
    false
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'beren@influmatch-demo.com',
    'Beren Talu',
    'berent',
    'Fashion',
    'İstanbul',
    'Haute couture defilelerden backstage içerikleri.',
    'https://images.unsplash.com/photo-1544723795-432537f12f6c?auto=format&fit=crop&w=600&q=80',
    true
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'elif@influmatch-demo.com',
    'Elif Koral',
    'elifkoral',
    'Beauty',
    'İzmir',
    'Organik ürün incelemeleri ve kısa format ipuçları.',
    'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=600&q=80',
    false
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'arda@influmatch-demo.com',
    'Arda Tezcan',
    'ardatez',
    'Lifestyle',
    'Eskişehir',
    'Tasarım kafeler, solo travel ve üretkenlik günlükleri.',
    'https://images.unsplash.com/photo-1546456073-6712f79251bb?auto=format&fit=crop&w=600&q=80',
    false
  ),
  (
    uuid_generate_v4(),
    'influencer',
    'duru@influmatch-demo.com',
    'Duru Kireç',
    'durukirec',
    'Fashion',
    'İstanbul',
    'Premium takı markalarıyla stil kombin serileri.',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    true
  );

-- ============================================================
-- ADVERT PROJECTS (BRIEFS)
-- ============================================================
insert into public.advert_projects (
  brand_id,
  title,
  summary,
  category,
  platforms,
  deliverables,
  budget_min,
  budget_max,
  budget_currency,
  status,
  deadline,
  hero_image,
  location
)
values
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- TechStyle
    'Yaz Koleksiyonu Lansmanı',
    'Yeni sezon neon renkli yaz koleksiyonumuz için enerjik, genç ve dinamik Reels içerikleri arıyoruz. Ürünler hediye edilecek + bütçe sağlanacaktır.',
    'Fashion',
    array['instagram', 'tiktok'],
    array['1x Reels', '3x Story'],
    5000,
    15000,
    'TRY',
    'open',
    '2025-06-30',
    'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80',
    'İstanbul'
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- TechStyle
    'Akıllı Saat İncelemesi',
    'Yeni model Watch X Pro akıllı saatimizin spor modlarını test edecek ve deneyimlerini paylaşacak teknoloji/spor influencerları arıyoruz.',
    'Technology',
    array['youtube', 'instagram'],
    array['1x YouTube Video', '1x Instagram Post'],
    15000,
    30000,
    'TRY',
    'open',
    '2025-05-15',
    'https://images.unsplash.com/photo-1510017803434-a899398421b3?auto=format&fit=crop&w=800&q=80',
    'Türkiye Geneli'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', -- Glow Beauty
    'C Vitaminli Serum Deneyimi',
    'Leke karşıtı yeni serumumuzu 14 gün boyunca düzenli kullanıp, öncesi/sonrası değişimini şeffaf bir şekilde paylaşacak içerik üreticileri.',
    'Beauty',
    array['instagram'],
    array['1x Reels', '2x Story Serisi'],
    3000,
    8000,
    'TRY',
    'open',
    '2025-04-20',
    'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80',
    'Türkiye Geneli'
  ),
  (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', -- Coffee Lovers
    'Sabah Rutini & Kahve',
    'Güne bizim kahvelerimizle başladığınız, estetik ve "cozy" sabah rutini videoları istiyoruz. ASMR tarzı içerikler tercih sebebidir.',
    'Lifestyle',
    array['tiktok', 'instagram'],
    array['1x TikTok', '1x Reels'],
    2000,
    5000,
    'TRY',
    'open',
    '2025-05-01',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80',
    'Türkiye Geneli'
  ),
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- TechStyle
    'Sokak Stili Yarışması',
    'Markamızın ürünleriyle oluşturduğunuz en iyi sokak stilini paylaşın, takipçilerinizi yarışmaya davet edin.',
    'Fashion',
    array['instagram'],
    array['1x Post', '1x Story'],
    4000,
    10000,
    'TRY',
    'paused',
    '2025-08-01',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80',
    'İstanbul'
  );
