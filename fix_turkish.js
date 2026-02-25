const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'mobile-app', 'screens', 'influencer', 'BadgesScreen.js');
let content = fs.readFileSync(target, 'utf8');

// Fix badge names and descriptions
const fixes = [
    // Badge names
    ["'Onayly Hesap'", "'Onaylı Hesap'"],
    ["'Kurucu Uye'", "'Kurucu Üye'"],
    ["'Profil Uzmani'", "'Profil Uzmanı'"],
    ["'Marka Elcisi'", "'Marka Elçisi'"],
    ["'Hizli Donus'", "'Hızlı Dönüş'"],
    ["'5 Yildiz'", "'5 Yıldız'"],
    ["'Trend Belirleyici'", "'Trend Belirleyici'"],
    ["'Milyon Kulubu'", "'Milyon Kulübü'"],
    ["'Donusum Sihirbazi'", "'Dönüşüm Sihirbazı'"],
    ["'Resmi Isletme'", "'Resmi İşletme'"],
    ["'Oncu Marka'", "'Öncü Marka'"],
    ["'Vitrin Marka'", "'Vitrin Marka'"],
    ["'Jet Onay'", "'Jet Onay'"],
    ["'Elit Butce'", "'Elit Bütçe'"],
    ["'Iletisim Uzmani'", "'İletişim Uzmanı'"],
    ["'Sadik Partner'", "'Sadık Partner'"],
    ["'Global'", "'Global'"],

    // Badge descriptions
    ["'Kimlik dogrulanmis influencer hesabi.'", "'Kimliği doğrulanmış influencer hesabı.'"],
    ["'Platformun ilk uyelerinden.'", "'Platformun ilk üyelerinden.'"],
    ["'Profilini eksiksiz doldurmac kullanici.'", "'Profilini eksiksiz doldurmuş kullanıcı.'"],
    ["'Markalarla uzun sureli isbirlikleri.'", "'Markalarla uzun süreli işbirlikleri.'"],
    ["'Mesajlara cok hizli yanit veren.'", "'Mesajlara çok hızlı yanıt veren.'"],
    ["'Yuksek puanli isbirlikleri.'", "'Yüksek puanlı işbirlikleri.'"],
    ["'Icerikleri trend olan.'", "'İçerikleri trend olan.'"],
    ["'Milyonlarca erisime sahip.'", "'Milyonlarca erişime sahip.'"],
    ["'Yuksek donusum oranlari.'", "'Yüksek dönüşüm oranları.'"],
    ["'Vergi levhasi dogrulanmis isletme.'", "'Vergi levhası doğrulanmış işletme.'"],
    ["'Platformun ilk marklarindan.'", "'Platformun ilk markalarından.'"],
    ["'Ornek kampanya sayfali marka.'", "'Örnek kampanya sayfası olan marka.'"],
    ["'Basvurulari hizli onaylayan.'", "'Başvuruları hızlı onaylayan.'"],
    ["'Yuksek butceli kampanyalar.'", "'Yüksek bütçeli kampanyalar.'"],
    ["'Influencerlarla iletisimi guclu.'", "'Influencer'larla iletişimi güçlü.'"],
    ["'Duzenli isbirligi yapan.'", "'Düzenli işbirliği yapan.'"],
    ["'Uluslararasi faaliyet gosteren.'", "'Uluslararası faaliyet gösteren.'"],

    // Requirements
    ["'Hesabini dogrulayarak kazanilir.'", "'Instagram hesabını doğrulayarak kazanılır.'"],
    ["'Platforma ilk 1000 uye arasinda katilarak kazanilir.'", "'Platforma ilk 1000 üye arasında katılarak kazanılır.'"],
    ["'Profil bilgilerini %100 eksiksiz doldurarak kazanilir.'", "'Profil bilgilerini %100 eksiksiz doldurarak kazanılır.'"],
    ["'En az 5 marka ile basarili isbirligi yaparak kazanilir.'", "'En az 5 marka ile başarılı işbirliği yaparak kazanılır.'"],
    ["'Mesajlara ortalama 1 saatten hizli yanit vererek kazanilir.'", "'Mesajlara ortalama 1 saatten hızlı yanıt vererek kazanılır.'"],
    ["'Yuksek puanli isbirlikleriyle kazanilir.'", "'Yüksek puanlı işbirlikleriyle kazanılır.'"],
    ["'Icerikleriniz kesfet sayfasinda yer alarak kazanilir.'", "'İçerikleriniz keşfet sayfasında yer alarak kazanılır.'"],
    ["'Milyonlarca erisime ulasarak kazanilir.'", "'Milyonlarca erişime ulaşarak kazanılır.'"],
    ["'Yuksek donusum oranlariyla kazanilir.'", "'Yüksek dönüşüm oranlarıyla kazanılır.'"],
    ["'Vergi levhaniz admin tarafindan dogrulanarak kazanilir.'", "'Vergi levhanız admin tarafından doğrulanarak kazanılır.'"],
    ["'Platforma ilk 100 marka arasinda katilarak kazanilir.'", "'Platforma ilk 100 marka arasında katılarak kazanılır.'"],
    ["'Marka profilinizi eksiksiz tamamlayarak kazanilir.'", "'Marka profilinizi eksiksiz tamamlayarak kazanılır.'"],
    ["'Basvurulari 24 saatten hizli onaylayarak kazanilir.'", "'Başvuruları 24 saatten hızlı onaylayarak kazanılır.'"],
    ["'Yuksek butceli kampanyalar yayinlayarak kazanilir.'", "'Yüksek bütçeli kampanyalar yayınlayarak kazanılır.'"],
    ["'Guclu iletisim gecsimisiyle kazanilir.'", "'Güçlü iletişim geçmişiyle kazanılır.'"],
    ["'Duzenli isbirlikleri yaparak kazanilir.'", "'Düzenli işbirlikleri yaparak kazanılır.'"],
    ["'Uluslararasi faaliyetler gostererek kazanilir.'", "'Uluslararası faaliyetler göstererek kazanılır.'"],
    ["'Platformdaki aktivitelerini artir.'", "'Platformdaki aktivitelerini artır.'"],

    // UI strings
    ["rozet kazanildi", "rozet kazanıldı"],
    ["tamamlandi", "tamamlandı"],
    ["MVP rozetinden {mvpEarned} tanesine sahipsin.", "MVP rozetinden {mvpEarned} tanesine sahipsin."],
    ["Sahip Oldugun Rozetler", "Sahip Olduğun Rozetler"],
    ["Kazanabilecegin Rozetler", "Kazanabileceğin Rozetler"],
    ["Gelecek Rozetler", "Gelecek Rozetler"],
    ["yeni rozet yakinda platforma eklenecek. Takipte kal!", "yeni rozet yakında platforma eklenecek. Takipte kal!"],
    ["Konu basligi", "Konu başlığı"],
    ["Sorunu acikla...", "Sorunu açıkla..."],
    ["Talebi Gonder", "Talebi Gönder"],
    ["Cikis Yap", "Çıkış Yap"],
    ["Hesabindan cikis yapmak istedigine emin misin?", "Hesabından çıkış yapmak istediğine emin misin?"],
    ["Vazgec", "Vazgeç"],
    ["Bagli Hesaplar", "Bağlı Hesaplar"],
    ["Instagram hesap baglantisi", "Instagram hesap bağlantısı"],
    ["TERCIHLER", "TERCİHLER"],
    ["Bize Ulasin", "Bize Ulaşın"],
    ["Kullanici Adi:", "Kullanıcı Adı:"],
    ["Kullanici adi yalnizca uyelik sirasinda belirlenir ve sonradan degistirilemez.", "Kullanıcı adı yalnızca üyelik sırasında belirlenir ve sonradan değiştirilemez."],
    ["Degistirmek icin", "Değiştirmek için"],
    ["adresine destek talebi olusturun.", "adresine destek talebi oluşturun."],
    ["Kullanici Adi Degisikligi", "Kullanıcı Adı Değişikliği"],
    ["Kullanim Kosullari", "Kullanım Koşulları"],
    ["Eksik Alan", "Eksik Alan"],
    ["Konu ve mesaj alanlarini doldur.", "Konu ve mesaj alanlarını doldur."],
    ["Gonderildi", "Gönderildi"],
    ["Talebiniz alindi. En kisa surede donus yapacagiz.", "Talebiniz alındı. En kısa sürede dönüş yapacağız."],
];

for (const [from, to] of fixes) {
    content = content.split(from).join(to);
}

fs.writeFileSync(target, content, 'utf8');
console.log('Fixed Turkish chars in BadgesScreen.js');

// Also fix SettingsScreen.js
const settingsTarget = path.join(__dirname, 'mobile-app', 'screens', 'SettingsScreen.js');
let settingsContent = fs.readFileSync(settingsTarget, 'utf8');

const settingsFixes = [
    ["Kullanici Adi:", "Kullanıcı Adı:"],
    ["Kullanici adi yalnizca uyelik sirasinda belirlenir ve sonradan degistirilemez.", "Kullanıcı adı yalnızca üyelik sırasında belirlenir ve sonradan değiştirilemez."],
    ["Degistirmek icin", "Değiştirmek için"],
    ["adresine destek talebi olusturun.", "adresine destek talebi oluşturun."],
    ["Kullanici Adi Degisikligi", "Kullanıcı Adı Değişikliği"],
    ["TERCIHLER", "TERCİHLER"],
    ["Bagli Hesaplar", "Bağlı Hesaplar"],
    ["Instagram hesap baglantisi", "Instagram hesap bağlantısı"],
    ["Bize Ulasin", "Bize Ulaşın"],
    ["Kullanim Kosullari", "Kullanım Koşulları"],
    ["Cikis Yap", "Çıkış Yap"],
    ["Hesabindan cikis yapmak istedigine emin misin?", "Hesabından çıkış yapmak istediğine emin misin?"],
    ["Vazgec", "Vazgeç"],
    ["Konu basligi", "Konu başlığı"],
    ["Sorunu acikla...", "Sorunu açıkla..."],
    ["Talebi Gonder", "Talebi Gönder"],
    ["Eksik Alan", "Eksik Alan"],
    ["Konu ve mesaj alanlarini doldur.", "Konu ve mesaj alanlarını doldur."],
    ["Gonderildi", "Gönderildi"],
    ["Talebiniz alindi. En kisa surede donus yapacagiz.", "Talebiniz alındı. En kısa sürede dönüş yapacağız."],
    ["MEVCUT SIFRE", "MEVCUT ŞİFRE"],
    ["YENİ SIFRE", "YENİ ŞİFRE"],
    ["YENi SIFRE", "YENİ ŞİFRE"],
    ["Sifre en az 8 karakter olmali.", "Şifre en az 8 karakter olmalı."],
    ["Mevcut sifre yanlis.", "Mevcut şifre yanlış."],
    ["Sifren guncellendi.", "Şifren güncellendi."],
    ["Tum alanlari doldur.", "Tüm alanları doldur."],
    ["Yeni sifreler eslasmiyor.", "Yeni şifreler eşleşmiyor."],
    ["Sifre Degistir", "Şifre Değiştir"],
    ["Hesap guvenligini guncelle", "Hesap güvenliğini güncelle"],
    ["Sifrenizi Guncelleyin", "Şifreyi Güncelle"],
    ["Kaydediliyor...", "Kaydediliyor..."],
];

for (const [from, to] of settingsFixes) {
    settingsContent = settingsContent.split(from).join(to);
}

fs.writeFileSync(settingsTarget, settingsContent, 'utf8');
console.log('Fixed Turkish chars in SettingsScreen.js');
