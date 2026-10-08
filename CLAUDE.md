# Influmatch — Claude çalışma kuralları

Bu dosya Claude Code tarafından her oturumda otomatik okunur. Proje sahibinin verdiği kararlar ve
çalışma kuralları burada; güncel durum, geçmiş ve açık işler `docs/HANDOFF.md`'de; numaralı sorun
listesinin tamamı `docs/SYSTEM_MAP.md`'de. **İşe başlamadan önce üçünü de oku.** Aynı soruları
kullanıcıya tekrar sorma; karar burada yazıyorsa ona uy.

## Proje

- Influencer/UGC ↔ marka eşleştirme platformu. Web: Next.js 14.2.35 (app router, server actions), Tailwind,
  Vercel Hobby. Veri: Supabase (Postgres + RLS + kolon yetkileri, Auth, Storage, Realtime, pg_cron).
  Mobil: `mobile-app/` (Expo) — test aşamasında, web ile tam uyum hedefi (kural 3).
- Kullanıcı Türkçe yazar; yanıtlar Türkçe, sade ve kısa olmalı. Kod yorumları Türkçe (mevcut stil).
- Supabase projesi: `aiftdpagcnwqzzemtkwt`. Vercel takımı `team_Htk8Xf8Vn8T348y3KswsfwHn`, proje
  `prj_cn5IhkAOOUtEDCxCumw9MMWjk5Dx` (influmatch). GitHub: `fenerlicon/influmatch`. Alan adı: influmatch.net.
- Supabase istemcileri `@supabase/ssr` 0.8 ile: `utils/supabase/server.ts`, `utils/supabase/client.ts`,
  `utils/supabase/admin.ts` (service role, yalnızca sunucu). 0.9+ supabase-js ≥2.97 ister; yükseltmeden önce ikisini birlikte yükselt.
  Eski auth-helpers çerezleri `lib/supabase/legacy-session-cookie.ts` ile middleware'de dönüştürülüyor — silme.

## Kesin kurallar (kullanıcı kararı)

1. **Vergi belgeleri ve kişisel veriler hiçbir dış yapay zekâya / üçüncü tarafa gönderilmez.** Özellikle Google
   Gemini ücretsiz katmanı yasak ("eğitim amacıyla veriyor ve dönütleri inceliyorlar"). Vergi levhası
   yerelde doğrulanır (`lib/tax-verification.ts`); otomatik onay `TAX_AUTO_APPROVE` ile ve varsayılan **kapalı**.
   Gemini 2026-10-10'da tamamen kaldırıldı (anahtar havuzunda yalnızca Apify var, 6.7-S1); geri ekleme.
2. **Giriş yapmadan profiller görünmez.** `/profile/*` korumalı, site haritasında yok, robots engelliyor. Değiştirme.
3. **Mobil (2026-10-09 kararı):** dondurma kalktı. Uygulama **test aşamasında** (mağazada değil, gerçek kullanıcı yok);
   hedef **web ile tam uyum**: web'in kuralları ve özellikleri (zorunlu hesap doğrulama, vergi levhası + kurumsal e-posta,
   bildirimler + push, teklif/başvuru akışları), sahte ekranlar kaldırılır, kritik işlemler web'in sunucu uçlarına taşınır.
   Gerçek kullanıcı olmadığı için eski mobil sürümle uyumluluk gerekmiyor (ör. `avatars insert` politikası ve
   `social_accounts.verification_code` kolonu kapatılabilir). Mağaza yayını (hesap, paket adı) kullanıcının işi.
4. **Canlı veritabanı:** risksiz şema düzeltmeleri (kısıt genişletme, indeks, GRANT/REVOKE, idempotent kolon,
   ALTER POLICY ile daraltma) doğrudan uygulanabilir **ve** `supabase/migrations/` altına dosya olarak yazılır.
   Riskli olanlar (DROP POLICY, veri silme, kısıt daraltma vb.) biriktirilir, sonunda kullanıcıya sırasıyla tek
   SQL dosyası olarak verilir; kullanıcı Supabase SQL Editor'de çalıştırır. Canlıyı değiştirmeden önce mevcut
   durumu sorguyla kontrol et, sonra doğrula.
5. **Test:** kullanıcı her değişikliği tek tek test etmek istemiyor ("zırt pırt test etmektense değiştireceğimiz
   her şeyi değiştirelim"). Liste bitince çok hesapla toplu test yapacak. Değişiklik başına test isteme;
   kendin typecheck + lint + `next build` ile doğrula.
6. **Ürün kararları (2026-10-09, kullanıcı seçti):**
   - Bildirimler (5.4): site içi bildirim + önemli olaylarda e-posta (yeni teklif, teklif yanıtı, başvuru sonucu,
     destek yanıtı); yeni mesaj e-postası en fazla saatte bir özet. Kullanıcının `email_notifications` tercihleri uygulanır.
   - Doğrudan mesaj (5.1-S1): **açılmayacak.** Sohbet yalnızca teklif veya başvuru üzerinden; teklifsiz sohbet yolları kaldırılır.
   - Eski sarı tikler (3.11-S1): kurala uymayanların tiki geri alınır, markaya bildirim gider; kuralı tamamlayan geri alır.
   - Teklif "Beklet" (2.13-S1): davranış aynı, buton adı "Markayla görüş".
   - Ücretsiz marka kotası (3.13): 2026-10-10 (3. tur) kararıyla değişti — aşağıya bak.
   - E-posta (8.4-S1): Resend ücretsiz planda kalınır; doğrulama/şifre e-postaları öncelikli, kota %80'i geçince
     bildirim e-postaları durur (site içi bildirim sürer), admin'e uyarı.
   - Mobil: kural 3.
   - **2026-10-10 kararları:** arayüzde "AI / yapay zeka" denmez, "akıllı eşleştirme / profil analizi" denir (gerçek
     yapay zekâ yok; sahte bekleme ve rastgelelik yok). Ana sayfada ortaklık iddiası yok ("Desteklenen Platformlar":
     yalnızca Instagram, TikTok) ve sabit pazarlama rakamı yok. Yasal metinlerin tek kaynağı `app/legal/page.tsx`;
     hukuki içerik avukat yazınca değişir, Claude yasal metin yazmaz. Ajans paketi sayfası yok. Kodla doğrulayanlara
     sınır OAuth açılınca konuşulur (3.13-N2). Drive yapısı (8.9-N1) Cloudflare R2 ile Kasım'da, Akademi ile birlikte. Mobil uygulama adı "Influmatch",
     paket kimliği `net.influmatch.app` (iOS ve Android).
   - **2026-10-10 (2. tur):** OAuth (2.3-S2/S3/S4, 3.13 kod/OAuth ayrımı) mobil uygulamanın **mağaza yayınından sonra**
     açılır. 5 Yıldız rozeti de yayından sonra. Okundu bilgisi `room_reads` tablosunda (5.3-S2), mobil kritik yazımlar
     web uçlarında, marka sektörü → influencer kategorisi eşlemesi `lib/category-map.ts` (3.5-S2), gönderisiz hesap
     doğrulanmaz (3.13-N6), Gemini tamamen kaldırıldı (6.7-S1).
   - **Strateji ve takvim:** `docs/ROADMAP.md` (Aralık son hafta 0₺ kampanya, şirket 1 Ocak'ta, satış Ocak ortası–sonu,
     Akademi kararları, R2 "Drive", mağazaya önce bireysel hesapla çıkış). Kasım'ın ana işi Akademi + R2.
   - **2026-10-10 (3. tur):** ücretsiz marka sınırları (keşif çarkı 10 profil/24 saat, teklif günde 3 / ayda 15, 1 aktif ilan)
     **satış başlayınca** açılır, altyapı kapalı bayrakla hazırlanır; cevapsız teklif 7 günde düşer; teklif şablonu, ilan alarmı,
     haftalık e-postalar (Resend ücretli plan), ekip/ajans hesabı. Spotlight listesine yalnızca canlıdaki özellik eklenir.
     Ayrıntı ve iş sırası: `docs/ROADMAP.md`.
   - Kuyruğun en sonu (sonda hatırlat): 5 Yıldız rozeti (puanlama sistemi, yayından sonra); avukattan gelecek yasal metinler.
7. Arayüze iş/politika iddiası yazma (ör. "iade yapılmaz", fiyat, garanti) — kullanıcıya sor.
8. Gizli bilgiler: Vercel ortam değişkenlerini **asla** açık metne çevirme/yazdırma. `supabase/cron/hourly_jobs.sql`
   içine gerçek `CRON_SECRET` yazılmış haliyle **commit etme** (repodaki hali `BURAYA_CRON_SECRET` yer tutucusuyla).
   `.env*` dosyalarını commit etme.
9. Repo içeriğine (commit, PR, kod yorumu) model adı/kimliği yazma.
10. Kullanıcının daha önce bilerek tuttuğu şeyler: `@testermobilapp` test marka hesabı (mobil testleri için) silinmez.

## Çalışma akışı

- Düzeltmeler numaralı listeye göre yapılır (`docs/SYSTEM_MAP.md`, ör. `3.7-S2`). Bir madde bitince haritada
  `✅ ~~**ID [SEVİYE]**~~ (ne yapıldı)` biçiminde işaretle; yeni bulguyu o bölümün son numarasından devam ettirerek ekle.
- Kullanıcının kalıcı onayı var: düzeltmeleri dalda yap → push → PR aç → Vercel önizlemesi **READY** olunca
  PR'ı birleştir (merge commit). Önizleme hata verirse birleştirme, düzelt.
  Çalışma dalı: `claude/web-fixes-batch` (her birleştirmeden sonra `origin/main`'e eşitlenir).
- PR'dan önce: `npx tsc --noEmit -p .`, `npx next lint`, `npx next build` (NEXT_PUBLIC_SUPABASE_URL ve
  NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı — `.env.local`'de, commit edilmez). Route silince `rm -rf .next/types`.
- Kurulum, ortam değişkenleri, cron ve yayın: `docs/SETUP.md`.
- **Takip panosu (kontrol haritası) da her değişiklikte ilerlemeli** (kullanıcı isteği). Pano bir claude.ai artifact'ı:
  https://claude.ai/artifact/7JSXk5iePMgLJafpS7UsHV — veritabanı koleksiyonu `issues`, belge kimliği madde ID'si
  (`3.7-S2`), alanlar: `status` (open/doing/done/skip), `note`, `commit`, `updatedAt` (YYYY-AA-GG), ayrıca `text`,
  `severity`, `module`, `section`, `order`, `kind` (issue/note).
  - Bir madde bitince (haritada ✅ yaptığın anda) panoda da `ArtifactData` aracıyla güncelle:
    `action=batch`, her belge için `{op:"update", collection:"issues", doc_id, if_version, data:{status:"done",
    note:"kısa açıklama, PR #", commit:"kısa sha", updatedAt}}`. `if_version` zorunlu: önce `action=get` ile oku.
    Başlanan ama bitmeyen iş `doing`, kullanıcı kararıyla kapanan `skip`. Yeni bulgu haritaya eklenince panoya da
    `op:"set"` ile ekle.
  - Toplu eşitleme: `scripts/tracker_sync.py` haritayla panoyu karşılaştırıp yazma listesi üretir (kullanımı dosyanın başında).
    Oturum sonunda bir kez çalıştırıp panonun haritayla aynı olduğundan emin ol.
  - `ArtifactData`/`Artifact` araçları bu oturumda yoksa (ToolSearch ile ara) kullanıcıya bir kez söyle; harita yine
    güncellenir ve araç olan ilk oturumda `scripts/tracker_sync.py` ile pano eşitlenir. SYSTEM_MAP her zaman asıl kaynaktır.
- Commit mesajları İngilizce, kısa başlık + madde listesi. PR açıklamasında düzeltilen harita ID'lerini yaz.
