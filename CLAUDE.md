# Influmatch — Claude çalışma kuralları

Bu dosya Claude Code tarafından her oturumda otomatik okunur. Proje sahibinin verdiği kararlar ve
çalışma kuralları burada; güncel durum, geçmiş ve açık işler `docs/HANDOFF.md`'de; numaralı sorun
listesinin tamamı `docs/SYSTEM_MAP.md`'de. **İşe başlamadan önce üçünü de oku.** Aynı soruları
kullanıcıya tekrar sorma; karar burada yazıyorsa ona uy.

## Proje

- Influencer/UGC ↔ marka eşleştirme platformu. Web: Next.js 14.2.35 (app router, server actions), Tailwind,
  Vercel Hobby. Veri: Supabase (Postgres + RLS + kolon yetkileri, Auth, Storage, Realtime, pg_cron).
  Mobil: `mobile-app/` (Expo) — **şu an dondurulmuş, aşağıya bak**.
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
   `lib/gemini.ts`'te yalnızca anahtar sağlık kontrolü var, içerik üretme yok — geri ekleme.
2. **Giriş yapmadan profiller görünmez.** `/profile/*` korumalı, site haritasında yok, robots engelliyor. Değiştirme.
3. **Mobil uygulamaya dokunma** (2026-10-07: "Önce Web'i düzenleyelim, Web'e göre mobil entegrasyonlar sağlarız").
   Web bitince kullanıcıya **hatırlat**. Bekleyen mobil maddeler: SYSTEM_MAP 10.3, ve mobil sürüm çıkınca
   `DROP POLICY "avatars insert" ON storage.objects;`
4. **Canlı veritabanı:** risksiz şema düzeltmeleri (kısıt genişletme, indeks, GRANT/REVOKE, idempotent kolon,
   ALTER POLICY ile daraltma) doğrudan uygulanabilir **ve** `supabase/migrations/` altına dosya olarak yazılır.
   Riskli olanlar (DROP POLICY, veri silme, kısıt daraltma vb.) biriktirilir, sonunda kullanıcıya sırasıyla tek
   SQL dosyası olarak verilir; kullanıcı Supabase SQL Editor'de çalıştırır. Canlıyı değiştirmeden önce mevcut
   durumu sorguyla kontrol et, sonra doğrula.
5. **Test:** kullanıcı her değişikliği tek tek test etmek istemiyor ("zırt pırt test etmektense değiştireceğimiz
   her şeyi değiştirelim"). Liste bitince çok hesapla toplu test yapacak. Değişiklik başına test isteme;
   kendin typecheck + lint + `next build` ile doğrula.
6. **Bekleyen ürün kararları** — kullanıcı "biraz daha beklesin" dedi, **kendi başına uygulama**: bildirimler (5.4),
   doğrudan mesaj (5.1-S1), ücretsiz marka kotası (3.13), ortak logoları (9.1-S2), eski sarı tikler (3.11-S1),
   teklif "Beklet" (2.13-S1), "AI analiz" metni (2.9-S1). Ayrıntı `docs/HANDOFF.md`.
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
