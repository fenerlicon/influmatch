# Toplu test listesi (web + mobil)

> 2026-10-15 itibarıyla `main`. Kullanıcı (Arda) çok hesapla tek seferde test eder; ara test yok (CLAUDE.md kural 5).
> İşaretle: `[x]` geçti, `[!]` hata (altına kısa not), `[-]` atlandı. Hata notunda: hesap, cihaz (web/telefon tarayıcısı/mobil uygulama), adres, ne beklendi / ne oldu.
> Yeni özellik ekleyen oturum ilgili bölüme madde ekler.

**Not:** Web panelinde Profil, Ayarlar, iş birliği detayı (`/dashboard/collaborations/[id]`), İstatistikler ve Spotlight sayfaları
yeni görünüme henüz taşınmadı (REDESIGN, 3. aşama sürüyor). Bu sayfaların **işlevini** test et; görünüm sonra değişecek.

## 0. Hazırlık

- [ ] Hesaplar (gerçek e-posta, kod gelmesi için):
  - **A** admin (mevcut)
  - **M1** marka — vergi levhası + kurumsal e-postayla doğrulanacak
  - **M2** marka — doğrulanmayacak (kilit ekranlarını görmek için)
  - **I1** influencer — Instagram ile doğrulanacak
  - **I2** UGC üreticisi — TikTok ile doğrulanacak
- [ ] Cihazlar: masaüstü tarayıcı, telefon tarayıcısı (375 px civarı), mobil uygulama (Expo Go ya da derleme).
- [ ] Testten önce `/admin/limits`'te "Ücretsiz marka sınırları" **kapalı** olmalı (şu anki karar). 8. bölümde kısa süre açılıp **mutlaka kapatılır**.
- [ ] Ödeme yok: Spotlight paketleri admin panelinden elle açılır.

## 1. Tanıtım, kayıt, giriş (web)

- [ ] Yeni ana sayfa (2026-10-19, OpenDesign Yön B · Ürün sahnesi): masaüstü ve telefonda hero sahnesi, "Ürünü gez" bağlantısı, bölümler kaydırınca beliriyor, telefonda Menü açılıyor, S.S.S. açılıp kapanıyor, Ücretsiz başla → /signup, Giriş yap → /login, Spotlight → /spotlight.

- [ ] `/` ana sayfa masaüstü ve telefonda: başlık, "Nasıl çalışır" sekmeleri (Markalar / İçerik üreticileri), S.S.S. açılıp kapanıyor, alt bağlantılar çalışıyor.
- [ ] Ana sayfada "Öne çıkan profiller" bölümü ve Social Art ibaresi yok (2026-10-19 kararı).
- [ ] `/signup`: Marka / Influencer / UGC seçimi; koşullar kutusu işaretlenmeden "Hesap oluştur" pasif.
- [ ] Eski bağlantı `/signup-role?role=brand` → `/signup`'a gider, Marka seçili gelir.
- [ ] Kayıt → `/auth/check-email`: 6 haneli kod; yanlış kodda hata; 60 sn sonra "Tekrar gönder".
- [ ] Aynı e-postayla ikinci kayıt → "Bu e-posta adresi zaten kayıtlı."
- [ ] `/login`: yanlış şifre hatası; doğru girişte panele gider; `?redirectedFrom=/dashboard/works` ile giriş o sayfaya döner.
- [ ] Şifremi unuttum → e-posta → bağlantı → `/auth/update-password` → yeni şifreyle giriş ("Şifreniz güncellendi" bildirimi).
- [ ] Çerez bandı: "Yalnızca zorunlu" ve "Tümünü kabul et" seçimi sayfa yenilenince hatırlanıyor.
- [ ] `/legal` sekmeleri (`?tab=terms`, `?tab=privacy`, `?tab=cookies`); sözleşme md. 4–5 güncel metinle.
- [ ] `/feedback`: görselli ve görselsiz gönderim → teşekkür sayfası → panele dönüş; admin `/admin/feedback`'te görüyor.

## 2. Onboarding

- [ ] **I1/I2:** profil formu (kullanıcı adı müsaitlik kontrolü, kategori, şehir, en az bir sosyal hesap); "Kaydet ve devam et" → `/onboarding/verify`.
- [ ] Kayıtta UGC seçen **I2**'de "İçerik üretici türü" UGC ön seçili geliyor.
- [ ] Hesap doğrulama: Instagram (I1) ve TikTok (I2) biyografi koduyla; doğrulanınca panele geçiş. Doğrulamadan panele girilemiyor.
- [ ] Formu yarıda bırakıp sayfayı yenile → girilen bilgiler taslaktan geri geliyor.
- [ ] **M1/M2:** marka formu (web sitesi + kurumsal e-posta zorunlu; vergi no girilince vergi dairesi ve il istenir) → panel.

## 3. Admin (A)

- [ ] `/admin` Kullanıcılar: sekmeler, arama (ad / e-posta / kullanıcı adı / ID), satıra tıklayınca sağda inceleme paneli (telefonda üstte).
- [ ] M1'in vergi levhası kontrolleri ve "Belgeyi gör"; levha reddi (not yazarak) → markaya gidiyor.
- [ ] Onayla / Reddet (tekli ve toplu), vergi numarasını onayla → "Resmi İşletme".
- [ ] Mavi tik ver / kaldır / otomatiğe döndür (I1); sarı tik (M1).
- [ ] Spotlight aç (paket + ay) ve kapat; rozet ver; doğrulama e-postası; e-postayı elle onayla; Instagram verisini güncelle.
- [ ] "Mavi tikleri yeniden değerlendir" (canlıda tüm kullanıcıları etkiler; gerekirse en sona bırak).
- [ ] `/admin/support`, `/admin/feedback`, `/admin/messages` (raporlanan mesaj, mesajı kaldır), `/admin/adverts` (ilanlar + başvurular, ilan silme), `/admin/notifications` (tümüne / seçilenlere).
- [ ] `/admin/limits`, `/admin/api-keys` (kontrol et, test e-postası), `/admin/manual-connect`, `/admin/weekly-preview`.

## 4. Marka akışı (M1, doğrulanmış)

- [ ] Ana sayfa: Hesap durumu kartı (ilk adımlar), "Senden bekleyenler", öneriler.
- [ ] Keşfet: filtreler (kategori, şehir, bütçe), profil kartı → profil → teklif penceresi (`?teklif=1`); Favoriler ve listeler.
- [ ] Önerilenler (`/dashboard/brand/ai`): Spotlight yokken açıklama; admin Spotlight açınca öneriler + uyum skoru.
- [ ] İlan aç (`?new=1`): kategori seçimi, sorular; ilanın başvurularında Yeni / Ön liste / Değerlendirilen, "Kabul et".
- [ ] Teklif gönder (şablon kaydet / kullan), teklifi **düzenle** ve **geri çek** → teklif sohbeti kapanıyor (iki tarafta salt okunur).
- [ ] Kampanyalar: sihirbaz (`/dashboard/brand/campaigns/new`), toplu davet, üretici başı bütçe, CSV, rapor (`/[id]/report`), arşiv.
- [ ] Marka profili + ayarlar (e-posta tercihleri, şifre, destek talebi).

## 5. Marka (M2, doğrulanmamış)

- [ ] Keşfet, İlanlar, Favoriler, Önerilenler, Teklifler kilit ekranı gösteriyor; ana sayfa, profil, ayarlar, rozetler açık (SYSTEM_MAP T1).

## 6. Influencer akışı (I1 ve I2)

- [ ] Ana sayfa: bekleyen teklifler (satırdan yanıt), süren işler, yeni ilanlar, Hesap durumu kartı, vitrin anahtarı.
- [ ] İlanlar: liste + sağ panel, başvuru formu (sorulara cevap), Kaydedilenler, Alarmlar (anlık ilan alarmı → bildirim).
- [ ] Teklif al: kabul / reddet (onay penceresi) / "Markayla görüş"; 7 gün yanıtsız teklif "Süresi doldu".
- [ ] Fiyat kartı (profil): yalnızca doğrulanmış marka görüyor, M2 ve diğer influencer göremiyor.
- [ ] Müsaitlik durumu, Spotlight (admin açınca rozet + keşifte öncelik + görüntülenme sayıları), Pro'da portföy sonuçları.
- [ ] Keşfet (influencer vitrini) ve İstatistikler (`/dashboard/influencer/stats`).

## 7. Ortak: iş birliği, mesajlar, bildirimler (M1 ↔ I1)

- [ ] Teklif kabulü → İşler'de "Anlaşıldı"; sohbet açılıyor, sohbet üstünde bağlı iş satırı ve "İşe git".
- [ ] İş birliği detayı: anlaşma özeti hazırla → karşı taraf onaylasın → teslimatlar (taslak bağlantısı, revize iste, revize hakkı sayacı, taslağı onayla) → yayın bağlantısı → marka "Onayla ve tamamla".
- [ ] Ödeme teyidi: marka "Ödeme yapıldı", influencer "Ödemeyi aldım"; ödeme alınamadı bildirimi (süresi gelince).
- [ ] İptal (neden yazarak) ve yeniden açma; marka 7 gün onaylamazsa otomatik tamamlanma (saatlik görev).
- [ ] Sonuç raporu: teslimat gönderi metrikleri; tamamlanan iş profilde ve güvenilirlik satırında görünüyor (SYSTEM_MAP 3.20-S6: canlıda henüz tamamlanmış iş yok).
- [ ] İlan başvurusu kabulü (I2) aynı akıştan geçiyor.
- [ ] Mesajlar: arama, Okunmamış / Süren işler, görsel gönderme, raporla, engelle; okundu bilgisi iki cihazda.
- [ ] Bildirimler: zil, okundu; e-posta tercihleri kapalıyken ilgili e-posta gelmiyor.
- [ ] Destek talebi aç → admin yanıtlasın → kullanıcıya bildirim.

## 7b. Görevler (SQL `20261018000010_tasks_module.sql` çalıştırıldıktan sonra)

- [ ] **A** `/admin/tasks`: 6 varsayılan görev **kapalı** geliyor; birini düzenle, aç, kaydet. Yeni görev oluştur (tarih, hedef kullanıcı ID'si).
- [ ] **I1** `/dashboard/tasks` ve mobil Profil → Görevler: açık görevler, davet kodu + bağlantı (kopyala / paylaş).
- [ ] Davet: çıkış yap, `/signup?davet=KOD` ile yeni hesap aç (kod alanı dolu gelir); mobilde kodu elle yaz. I1'de "kodunla kaydoldu" sayısı artıyor;
  davetli onaylanınca "onaylandı" sayısı artıyor.
- [ ] Tanıtım videosu: Reels/TikTok linki gönder → "Ölçülüyor"; aynı link ikinci hesaptan reddediliyor; story ya da kısa link kabul edilmiyor.
  (Hızlı deneme: admin görevde bekleme süresini 1 gün yap.) Ölçümden sonra eşik üstü → incelemede, altı → reddedildi + bildirim.
- [ ] Story: ekran görüntüsü yükle → admin incelemede görüntüyü görüyor → reddet (not zorunlu) → kullanıcı notu görüyor, tekrar gönderebiliyor.
- [ ] Otomatik görev (M1 ilk ilan + 3 teklif): koşullar tamamlanınca "Ödülü talep et" → admin onaylar → "Ödüllerim"de "Satış başlayınca" + indirim kodu.
- [ ] Bir görev ikinci kez gönderilemiyor (kişi başı bir kez; davet görevi 3 tur).
- [ ] 0₺ dönemi açıkken M1 keşfinde (web + mobil) Spotlight'lı profiller artık önde değil; dolu profiller sonda; kapatınca Spotlight yine önde.
- [ ] 0₺ dönemi anahtarını aç → mavi tikli I1'in tiki (görev + 1 tamamlanan iş yoksa) kalkıyor, panel kartında iki yeni şart görünüyor; **kapat** → geri geliyor.
- [ ] "Ödülleri hesaplara işle"yi **satış başlamadan deneme** (Spotlight süreleri gerçekten eklenir). Gerekirse yalnızca test hesabının ödülüyle dene, sonra Spotlight'ı admin panelinden düzelt.
## 7c. 2026-10-19 düzeltmeleri

- [ ] Giriş yapınca panel (marka / influencer / admin) boş ekranda kalmadan açılıyor; çıkış giriş sayfasına götürüyor.
- [ ] Menüde sayfa değiştirince içerik alanında hemen yükleme iskeleti görünüyor.
- [ ] Avatarlar ve profil fotoğrafları hızlı açılıyor; yeni yüklenen fotoğraf / logo / ilan kapağı küçültülmüş (WebP) yükleniyor.
- [ ] **A** `/admin/adverts`: ilan silerken neden zorunlu → marka bildirimi alıyor; **M1** panele girince pencere açılıyor, "Anladım" deyince bir daha açılmıyor (web + mobil ana sayfa). Başvuranlar "ilan kaldırıldı" bildirimi alıyor.
- [ ] **A** `/admin`: "Şu an çevrimiçi" kartına basınca yalnızca çevrimiçi hesaplar listeleniyor; tekrar basınca / sekme değiştirince filtre kapanıyor.
- [ ] Yeni hesap: onboarding'i birkaç kez kaydet → destekten yalnızca **bir** hoş geldin mesajı.
- [ ] Mesajlar (web ↔ web, web ↔ mobil): mesaj anında görünüyor ("Gönderiliyor…" → "Gönderildi"); karşı taraf açınca "Görüldü"; yazarken karşıda "… yazıyor".
- [ ] Sohbette görsel gönder: büyük fotoğraf küçültülerek gidiyor, karşı tarafta hızlı açılıyor.
- [ ] Spotlight'lı profil kartlarında "Spotlight" yazısı yok; isim yanında altın parıltı ikonu ve kartın üstünde ince altın çizgi / hafif parlama var (web + mobil).
- [ ] Admin elle mavi tik ver / kaldır / otomatiğe döndür çalışıyor.

## 8. Ücretsiz marka sınırları (kısa süre, canlıyı etkiler)

- [ ] A `/admin/limits`'te bayrağı aç → M1 (Spotlight'sız): keşif çarkı, teklif günlük/aylık sınırı, aktif ilan sınırı, favori/liste kilidi.
- [ ] Spotlight Basic / Pro'da sınırlar farklı (Basic: günde 10 / ayda 60 teklif, 3 aktif ilan; Pro sınırsız).
- [ ] **Bayrağı tekrar kapat** ve markaların eski hâle döndüğünü kontrol et.

## 9. Mobil uygulama

- [ ] Giriş, kayıt (rol + UGC), e-posta kodu, şifremi unuttum, onboarding ve sosyal doğrulama kapısı.
- [ ] Influencer: Ana Sayfa (Hızlı erişim → "Vitrine göz at", "Vitrinde görün" anahtarı), İşler, İlanlar, Mesajlar, Profil (fiyat kartı, müsaitlik, analiz).
- [ ] Marka: Ana Sayfa ("Yeni ilan"), Keşfet (bütçe filtresi, keşif çarkı), İlanlar (Yeni / Kısa liste / Kabul), İşler, Mesajlar, profil (avatar).
- [ ] Mesajlar: sohbet satırında bağlı iş etiketi (Teklif / Başvuru / Aktif iş) ve okunmamış sayısı; sohbet üstündeki iş kartı detaya götürüyor.
- [ ] İş birliği detayı: zaman çizelgesi + "Sıradaki" adım, alttaki tek ana eylem, taslak / revize / yayın / ödeme / iptal.
- [ ] Ayarlar: e-posta tercihleri web'deki ayarlarla aynı (birinde değiştir, ötekinde gör); şifre değiştir; destek talebi.
- [ ] Geri bildirim gönder (admin'de görünüyor). Push bildirimi (derlemede; Expo Go Android'de yok).
- [ ] Web ile aynı veri: mobilde yapılan teklif/başvuru/mesaj web'de anında görünüyor.

## 10. Genel

- [ ] Telefon tarayıcısında her sayfa: yatay kayma yok, alt sekme çubuğu ve "Menü" çekmecesi çalışıyor.
- [ ] Çıkış yap → korumalı sayfalar girişe yönlendiriyor; admin olmayan `/admin`'e giremiyor.
- [ ] Silinen hesap (`/admin` → Hesabı sil) ile giriş yapılamıyor.

## Bilinen eksikler (hata sayma)

- Ödeme platform üzerinden yapılmaz; Spotlight satın alma kapalı (admin açar).
- Instagram/TikTok bağlama kutuları eski görünümde (profil sayfasıyla taşınacak).
- Gizlilik metnindeki ödeme hizmeti satırları avukat metnini bekliyor.
- OAuth, 5 Yıldız rozeti: mağaza yayınından sonra.
