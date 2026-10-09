# Influmatch yol haritası (2026-10-10, kullanıcıyla belirlendi)

> Kararlar kullanıcıya ait; tarih/fiyat/kampanya metinleri kullanıcı onayı olmadan arayüze yazılmaz (CLAUDE.md kural 7).
> Bu belge strateji ve takvimin tek kaynağıdır; değişiklik olursa burayı güncelle.

## Hedef

- **Aralık son haftasına kadar** web, mobil ve **Akademi** tam hazır; bu sürede kitle yavaş yavaş toplanır.
- **Aralık son hafta:** "Her şey 0₺" yılbaşı kampanyası (Akademi hariç). Ayrıntılar henüz netleşmedi (kullanıcıda).
- **Şirket 1 Ocak'ta açılır** (şahıs şirketi; vergi dönemi avantajı için daha önce açılmayacak — kesin karar).
  POS başvurusu şirketle birlikte → **satış Ocak ortası–sonu**. Öneri: 0₺ kampanyası POS açılana kadar uzatılır, ücretsiz
  dönem bitişi = satış başlangıcı (bitişten önce "üyeliğin bitiyor" bildirimi + e-postası kurulmalı).
- Sonra gelir ve büyüme. Süreç ileride **InfluAct**'e varacak (acelesi yok).

## Takvim

| Dönem | Kod (Claude) | Kullanıcı |
|---|---|---|
| Ekim sonu | Açık liste biter; çok hesaplı toplu test | Eğitim yüzü, Akademi metinleri |
| Kasım | **Akademi** (kurs, video, ilerleme, sınav, sertifika) + **R2 "Drive"** (videolar ve görseller) | Video çekimi/kurgu, Cloudflare hesabı, **bireysel** Apple/Google geliştirici hesapları, `eas init` + FCM |
| Aralık 1–2. hafta | Mağazaya gönderim, kampanya altyapısı, üyelik bitiş hatırlatmaları | Kampanya ayrıntıları, POS sağlayıcı seçimi ve evrak hazırlığı, **Resend ücretli plan** (ücretsiz plan günde 100 e-posta; kampanya bunu aşar) |
| Aralık son hafta | 0₺ kampanyası yayında | |
| 1 Ocak | | Şirket kuruluşu, POS başvurusu, D-U-N-S başvurusu |
| Ocak ortası–sonu | POS entegrasyonu canlı (test ortamında önceden hazırlanır), satış başlar | Avukattan yasal metinler (mesafeli satış, ön bilgilendirme, iptal/iade, KVKK) şirket bilgisiyle |
| Şirket + D-U-N-S sonrası | Uygulamalar bireysel hesaptan şirket hesabına taşınır (Apple ve Google destekliyor, kullanıcı/yorum korunur) | Şirket geliştirici hesapları |

## Akademi (kararlar)

- **Kime:** yalnızca **hesabını doğrulamış influencer/UGC'ler** satın alabilir.
- **İçerik:** temel taktik ve eğitim videoları; ayrıca işinde iyi UGC/influencer'larla kısa görüşmeler (tanıtım/vitrin içeriği
  olarak ücretsiz kullanılabilir). Metinleri kullanıcı yazar, bir eğitmen anlatır, kurguyu kullanıcı yapar.
- **Satış:** **tek seferlik, ömür boyu** erişim (abonelik yok). Fiyatı kullanıcı belirler. 0₺ kampanyasına dahil değil.
- **İzleme:** **sıralı** — bir video bitmeden ve bölüm sonu testi geçilmeden sonraki açılmaz.
- **Final sınavı:** geçme notu **%80**, **sınırsız hak**, denemeler arası **24 saat**; sorular havuzdan karışık gelir.
  Değerler admin panelinden değiştirilebilir olsun.
- **Mezuniyet:** profilde "Influmatch Akademi Mezunu" rozeti + indirilebilir sertifika. InfluAct seçiminde kullanılacak.
- **Admin:** kurs/bölüm/video ekleme, video yükleme, soru havuzu, sonuçlar.
- **Video barındırma:** Cloudflare R2 (çıkış trafiği ücretsiz). Yalnızca satın almış ve giriş yapmış kullanıcıya kısa süreli
  imzalı bağlantı. Not: ekran kaydı hiçbir sistemle tamamen engellenemez; rastgele paylaşım ve doğrudan indirme engellenir.
  Google Drive kullanılmaz (görüntüleme kotası, kolay indirme/paylaşım).

## R2 "Drive" (8.9-N1 ile birleşik)

- Akademi videoları + görseller (avatar, logo, ilan kapağı, sohbet ekleri) Cloudflare R2'ye taşınır; görseller yüklemede
  küçültülür (ör. WebP, en fazla 1080 px). Gizli dosyalar imzalı bağlantıyla. Supabase Storage trafik sınırı aşılmaz.
- Vergi belgeleri kural 1 gereği kendi altyapımızda kalır (R2 de bizim depomuz; üçüncü taraf işleme yok).

## InfluAct (ileride)

- Influmatch "buluşturma platformu"; InfluAct "parayı verin, sürecinizi biz yönetelim" yönetilen hizmet (ajanslardan farklı).
- Elit Influmatch üyeleri alınır, özellikle Akademi mezunları. Seçim verisi: Akademi mezuniyeti/sınav puanı, tamamlanan iş
  birlikleri, (yayından sonra gelecek) 5 Yıldız puanları. Acelesi yok.

## Buluşturmayı kolaylaştıran özellikler (2026-10-10, kullanıcı hepsini seçti)

Sıra (birbirine bağlı): **1 → 2 → 3 → 4**. Çok hesaplı toplu test 1. aşamadan **sonra** yapılmalı (akışlar değişiyor).

1. **Tek iş birliği akışı + fiyat kartı** (Ekim sonu – Kasım başı)
   - Teklif ve ilan başvurusu kabul edildiğinde ortak bir **iş birliği** (`collaborations`) kaydı açılır; iki kaynak da aynı
     aşamalardan geçer: `agreed` (anlaşıldı) → `in_progress` (içerik hazırlanıyor) → `published` (yayın linki girildi) →
     `completed` / `cancelled`. Teklif ve başvuru tabloları kaynak olarak kalır (geçmiş bozulmaz).
   - **Tamamlama:** influencer yayın linkini girer, marka onaylar; marka **7 gün** yanıt vermezse otomatik tamamlanır
     (saatlik görev). Tamamlanan iş birliği sayısı profilde görünür (ileride puanlama ve InfluAct seçimi buna dayanır).
   - **Fiyat kartı:** her teslimat türü (story, reel, gönderi, UGC video, paket) için **"₺X'ten başlayan"** başlangıç fiyatı +
     "pazarlığa açık". Yalnızca **doğrulanmış markalar** görür (influencer'lar birbirininkini göremez; sunucuda/RLS ile).
     Keşfette bütçeye göre filtre.
   - Her iki rol için tek **"İş Birlikleri"** sayfası (web + mobil).
2. **İş birliği takip alanı + anlaşma özeti** (Kasım)
   - Teslimatlar listesi, tarihler, taslak yükleme, marka onayı / revize isteği, yayın linki.
   - **Revize hakkı anlaşmada belirlenir** (ör. 2); sistem sayar ve sınırı gösterir.
   - Anlaşma özeti: teslimatlar, ücret, tarihler, kullanım hakkı, revize sayısı; iki taraf uygulamada onaylar.
     **Şablon/hukuki metin avukattan** gelir; o gelene kadar yalnızca alanların özeti ve iki tarafın onay kaydı.
   - ✅ 2026-10-10 yapıldı (SYSTEM_MAP 3.18): anlaşma özeti + onaylar, teslimat takibi (taslak linki, revize sayacı, yayın linki), ödeme teyidi,
     "Ödeme alamadım" bildirimi, marka güvenilirliği satırı. Taslak dosyası yükleme ve teslim kilidi R2 ile (Kasım).
3. **UGC portföyü + sonuç raporu** (Kasım sonu; R2'ye bağlı)
   - Profilde örnek videolar (R2, imzalı bağlantı). Yayın linkinden Apify ile beğeni/izlenme/yorum → markaya kampanya raporu.
4. **Kampanya sihirbazı + müsaitlik** (Aralık başı)
   - Marka kısa brief → uygun profiller (`lib/category-map.ts` + fiyat kartı + müsaitlik) → toplu davet.
   - Influencer "iş alıyorum / dolu" durumu; doluyken keşifte alt sırada, teklif butonu uyarı gösterir.

## 2026-10-10 (3. tur) kararları

- **Cevapsız teklif:** 7 gün yanıtlanmayan teklif "süresi doldu" olur, marka bilgilendirilir.
- **Ücretsiz marka sınırları** (3.13'teki "şimdilik açık" kararının yerine geçer). **Altyapı Aralık'a kadar hazırlanır ama kapalı durur;
  satış başlayınca (POS açılınca) açılır** — 0₺ kampanyasında herkes Spotlight. Değerler admin panelinden değiştirilebilir:
  - **Keşif çarkı:** ücretsiz marka tüm influencer/UGC listesini göremez. Günde bir kez "çark" çevirir; kategorisine uygun
    **10 doğrulanmış profil 24 saat** görünür, sonra yerini başka profillere bırakır (aynı profiller arka arkaya gelmez).
    Spotlight markalar herkesi görür.
  - **Teklif:** ücretsiz markada **günde 3, ayda 15**. Spotlight Basic daha yüksek, Pro sınırsız (değerler paket içeriğiyle).
  - **İlan:** ücretsiz markada **1 aktif ilan**. Spotlight'ta daha fazla.
- **Teklif şablonu:** marka bir teklifi şablon olarak kaydeder / son teklifini kopyalayıp başka influencer'a gönderir.
- **Kaydedilen ilanlar + ilan alarmı:** influencer ilanı kaydeder; kategori/bütçe/platform alarmı kurar, yeni uygun ilan çıkınca
  bildirim (+ e-posta tercihine göre).
- **Haftalık e-postalar:** kişisel özet (takipçi değişimi, profil görüntülenmesi) + eşleşme özeti (influencer: uygun yeni ilanlar;
  marka: sektöründe yeni doğrulanmış profiller). **Resend ücretli plana geçilecek** (kullanıcı onayladı; kampanyadan önce).
- **Ekip hesabı:** bir marka hesabına birden çok kişi; ileride **ajanslara özel** bir yapı da geliştirilebilir (InfluAct'e zemin).
- **Ödeme teyidi + teslim kilidi + marka güvenilirliği, davet kodu (Spotlight günü), admin metrik paneli:** kabul edildi (önceki tur).
- **İlk adımlar kontrol listesi:** kabul edildi 2026-10-10 (web + mobil panelde yapıldı, SYSTEM_MAP 3.16).
- **Spotlight paketleri:** karşılığı olmayan maddeler kaldırıldı (PR #50). Boşalan yerler **yalnızca çalışan özelliklerle** doldurulur;
  bir özellik canlıya çıkınca `lib/spotlight-plans.ts`'teki listeye eklenir. Önerilen dağılım (sayılar kullanıcı onayıyla):

| | Basic | Pro |
|---|---|---|
| Influencer | Rozet/çerçeve, öncelikli listeleme, profil görüntülenmeleri, uyum skoru, **anlık ilan alarmı** | Basic + profil koçu, **portföyde sonuç raporları**, haftalık özette detaylı istatistik |
| Marka | **Keşif çarkı yok (herkesi görür)**, daha yüksek teklif ve ilan sınırı, akıllı eşleştirme, uyum skoru, benzer profil keşfi, öne çıkan ilanlar | Basic + **sınırsız teklif/ilan**, **kampanya sihirbazı + toplu davet**, **sonuç raporları**, **haftalık eşleşme e-postası**, (ileride) **ekip hesabı** |

### Güncel iş sırası (Aralık sonuna kadar)
1. ✅ İş birliği akışı + fiyat kartı (PR #51)
2. Cevapsız teklif süresi, teklif şablonu, kaydedilen ilanlar + ilan alarmı
3. ✅ Ücretsiz marka sınırları + keşif çarkı (kapalı bayrakla), teklif/ilan sayaçları (SYSTEM_MAP 3.17; bayrak `/admin/limits`'ten satış başlayınca açılır)
4. ✅ İş birliği takip alanı (teslimatlar, revize, anlaşma özeti) + ödeme teyidi + marka güvenilirliği (SYSTEM_MAP 3.18, `claude/collab-workspace`). **Teslim kilidi bekliyor** (R2 ile Kasım'da; veri modeli hazır, 3.18-N4)
5. Akademi + R2 "Drive" (Kasım)
6. UGC portföyü + sonuç raporu
7. Kampanya sihirbazı + müsaitlik, davet kodu, admin metrik paneli, haftalık e-postalar (Resend ücretli)
8. Ekip hesabı / ajans yapısı (yayından sonra da olabilir)
