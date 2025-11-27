-- ============================================================
-- Influmatch Seed Data (Influencers)
-- ============================================================

delete from public.users where role = 'influencer';

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

