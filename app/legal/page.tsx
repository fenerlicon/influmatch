'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense, useState, useEffect } from 'react'
import LandingHeader from '@/components/landing/LandingHeader'
import LandingFooter from '@/components/landing/LandingFooter'
import { Card, Eyebrow, Tabs } from '@/components/ui'

const tabs = [
  { key: 'privacy', label: 'Gizlilik ve KVKK' },
  { key: 'terms', label: 'Kullanıcı Sözleşmesi' },
  { key: 'cookies', label: 'Çerez Politikası' },
] as const

type TabKey = (typeof tabs)[number]['key']

function LegalPageContent() {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab') as TabKey | null
  const [activeTab, setActiveTab] = useState<TabKey>(tabParam && tabs.some((t) => t.key === tabParam) ? tabParam : 'privacy')

  useEffect(() => {
    if (tabParam && tabs.some((t) => t.key === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam])

  const getContent = (tab: TabKey) => {
    switch (tab) {
      case 'privacy':
        return (
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-ink">Gizlilik Politikası ve KVKK Aydınlatma Metni</h2>
            <div className="space-y-6 text-ink-muted">
              <p className="text-sm text-ink-faint italic border-l-2 border-gold pl-4">
                Son Güncelleme: 1 Ocak 2026<br />
                Veri Sorumlusu: Influmatch Teknoloji ve Medya Hizmetleri
              </p>

              <p>
                İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca,
                Influmatch platformunun kullanıcılarına ait kişisel verilerin toplanması, işlenmesi, aktarılması ve korunması süreçlerini şeffaflıkla açıklamak üzere hazırlanmıştır.
              </p>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">1. İşlenen Kişisel Veriler</h3>
                <p className="mb-2">Platform üzerinden sunduğumuz hizmetlerin doğası gereği, aşağıdaki veri kategorileri işlenmektedir:</p>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li><strong>Kimlik Verileri:</strong> Ad, soyad, doğum tarihi, T.C. kimlik numarası (fatura/ödeme işlemleri için).</li>
                  <li><strong>İletişim Verileri:</strong> E-posta adresi, telefon numarası, ikamet adresi.</li>
                  <li><strong>Mesleki Veriler:</strong> Sosyal medya hesapları, takipçi istatistikleri, içerik kategorileri, marka işbirlikleri geçmişi.</li>
                  <li><strong>Finansal Veriler:</strong> IBAN, banka hesap bilgileri, vergi numarası.</li>
                  <li><strong>İşletme Doğrulama Verileri:</strong> Markaların yüklediği vergi levhası belgesi ve bu belgeden okunan bilgiler (vergi numarası, unvan, vergi dairesi).</li>
                  <li><strong>İşlem Güvenliği:</strong> IP adresleri, giriş-çıkış logları, cihaz bilgileri.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">2. Veri İşleme Amaçları</h3>
                <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li>Üyelik işlemlerinin gerçekleştirilmesi ve hesap güvenliğinin sağlanması.</li>
                  <li>Marka ve Influencer arasındaki eşleşme algoritmasının çalıştırılması (Spotlight vb.).</li>
                  <li>İşbirliği süreçlerinin yönetimi, tekliflerin iletilmesi.</li>
                  <li>Ödeme hizmetlerinin sağlanması ve finansal mutabakatların yapılması.</li>
                  <li>Yasal mevzuattan kaynaklanan yükümlülüklerin yerine getirilmesi (Fatura kesimi, vergi bildirimi vb.).</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">3. Veri Aktarımı</h3>
                <p>
                  Kişisel verileriniz, açık rızanız olmaksızın üçüncü kişilerle paylaşılmaz. Ancak aşağıdaki durumlarda paylaşım yapılabilir:
                </p>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li><strong>Markalar/Influencerlar ile:</strong> Bir işbirliği teklifi kabul edildiğinde, ilgili tarafın iletişim bilgileri karşı tarafla paylaşılabilir.</li>
                  <li><strong>Hizmet Sağlayıcılar:</strong> Ödeme altyapısı (örn. Iyzico, Stripe), bulut sunucu hizmetleri.</li>
                  <li><strong>Yasal Kurumlar:</strong> Mahkemeler, icra daireleri ve yetkili kamu kurumlarının yasal talepleri doğrultusunda.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">4. Haklarınız</h3>
                <p className="mb-2">KVKK Madde 11 uyarınca, destek@influmatch.net adresine başvurarak:</p>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li>Verilerinizin işlenip işlenmediğini öğrenebilir,</li>
                  <li>İşlenen verilerinizin düzeltilmesini veya silinmesini talep edebilir,</li>
                  <li>Aleyhinize çıkan otomatik analiz sonuçlarına itiraz edebilirsiniz.</li>
                </ul>
              </div>
            </div>
          </div>
        )
      case 'terms':
        return (
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-ink">Kullanıcı Sözleşmesi</h2>
            <div className="space-y-6 text-ink-muted">
              <p className="text-sm text-ink-faint italic border-l-2 border-gold pl-4">
                Yürürlük Tarihi: 1 Ocak 2026
              </p>
              <p>
                İşbu Kullanıcı Sözleşmesi ("Sözleşme"), Influmatch ("Platform") ile Platform'a üye olan gerçek veya tüzel kişi ("Kullanıcı") arasında akdedilmiştir.
                Platform'a kayıt olarak, bu sözleşmenin tüm hükümlerini okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.
              </p>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">1. Tanımlar</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li><strong>Platform:</strong> Influmatch mobil uygulaması ve web sitesi.</li>
                  <li><strong>Marka:</strong> Ürün veya hizmetlerini tanıtmak amacıyla Influencer arayan kullanıcı.</li>
                  <li><strong>Influencer:</strong> Sosyal medya hesapları üzerinden içerik üreterek tanıtım hizmeti sunan kullanıcı.</li>
                  <li><strong>İşbirliği:</strong> Marka ve Influencer arasında Platform üzerinden kurulan hizmet ilişkisi.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">2. Üyelik Şartları</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li>Üyelik, Platform üzerindeki kayıt formunun doldurulması ve e-posta doğrulamasının yapılmasıyla başlar.</li>
                  <li>Kullanıcı, 18 yaşından büyük olduğunu ve yasal ehliyete sahip olduğunu beyan eder.</li>
                  <li>Kullanıcı, profilinde beyan ettiği tüm bilgilerin (takipçi sayısı, etkileşim oranı vb.) doğruluğundan sorumludur. Yanıltıcı beyanlar üyeliğin iptaline sebep olur.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">3. Tarafların Hak ve Yükümlülükleri</h3>
                <p className="mb-2 font-semibold text-ink">3.1. Influencer'ın Yükümlülükleri:</p>
                <ul className="list-disc pl-6 mb-4 space-y-1 marker:text-gold">
                  <li>Anlaşılan İşbirliği şartlarına (zamanlama, içerik formatı) tam olarak uymak.</li>
                  <li>İçeriklerde ilgili yasal düzenlemelere (Reklam Kurulu kararları, #reklam etiketi kullanımı vb.) riayet etmek.</li>
                  <li>İçeriği anlaşılan süre boyunca sosyal medya hesabında yayında tutmak.</li>
                </ul>

                <p className="mb-2 font-semibold text-ink">3.2. Marka'nın Yükümlülükleri:</p>
                <ul className="list-disc pl-6 mb-4 space-y-1 marker:text-gold">
                  <li>İşbirliği bedelini zamanında ve eksiksiz ödemek.</li>
                  <li>Influencer'a gerekli materyalleri (brief, görsel vb.) zamanında sağlamak.</li>
                  <li>Genel ahlaka ve yasalara aykırı tanıtım taleplerinde bulunmamak.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">4. Platformun Rolü ve Sorumluluk Reddi</h3>
                <p>
                  Influmatch, Marka ve Influencer'ı bir araya getiren bir <strong>yer sağlayıcıdır</strong>.
                  İşbirliklerinin içeriğinden, ürünlerin kalitesinden veya Influencer'ın performansından Platform sorumlu tutulamaz.
                  Taraflar arasındaki ticari ve hukuki ilişki, tarafların kendi sorumluluğundadır.
                </p>
                <p className="mt-2">
                  Platform yalnızca tarafları bir araya getirir; işbirliği süreçlerinin yürütülmesinden ve güvenliğinden, taraflarca
                  paylaşılan içeriklerden ve bunlardan doğabilecek hukuki uyuşmazlıklardan sorumlu tutulamaz. Marka ve Influencer kendi
                  haklarını korumakla yükümlüdür.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">5. Ödeme ve Komisyon</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li>Platform, Marka ile Influencer arasındaki işbirliklerinden komisyon veya hizmet bedeli almaz.</li>
                  <li>İşbirliği bedeli, ödeme yöntemi ve zamanlaması taraflar arasında belirlenir; ödemeler Platform üzerinden yapılmaz. Platform&apos;daki ödeme teyidi yalnızca tarafların kendi beyanlarının kaydıdır.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">6. Fesih</h3>
                <p>
                  Kullanıcı, dilediği zaman hesabını kapatabilir. Ancak, devam eden bir İşbirliği varsa, bu yükümlülük tamamlanmadan hesap kapatılamaz.
                  Influmatch, kuralları ihlal eden kullanıcıların hesaplarını tazminatsız olarak kapatma hakkını saklı tutar.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">7. Yetkili Mahkeme</h3>
                <p> İşbu Sözleşme Türkiye Cumhuriyeti kanunlarına tabidir. İhtilaf halinde İstanbul (Çağlayan) Mahkemeleri yetkilidir.</p>
              </div>

            </div>
          </div>
        )
      case 'cookies':
        return (
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-ink">Çerez Politikası</h2>
            <div className="space-y-6 text-ink-muted">
              <p>
                Influmatch olarak, web sitemizdeki deneyiminizi kişiselleştirmek ve geliştirmek amacıyla çerezler (cookies) kullanmaktayız.
              </p>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">1. Çerez Nedir?</h3>
                <p>Tarayıcınız aracılığıyla cihazınıza kaydedilen ve siteyi tekrar ziyaret ettiğinizde sizi hatırlamamıza yarayan küçük veri dosyalarıdır.</p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">2. Hangi Çerezleri Kullanıyoruz?</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-gold">
                  <li><strong>Zorunlu Çerezler:</strong> Oturum açma, güvenli form gönderme gibi temel işlevler için gereklidir. Kapatılamaz.</li>
                  <li><strong>Analitik Çerezler:</strong> Ziyaretçi sayıları, en çok gezilen sayfalar gibi istatistikleri tutar (Google Analytics vb.).</li>
                  <li><strong>Pazarlama Çerezleri:</strong> İlgi alanlarınıza uygun reklamlar göstermek için kullanılır.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-ink mb-2">3. Çerez Yönetimi</h3>
                <p>
                  Tarayıcınızın ayarlarından çerezleri dilediğiniz zaman silebilir veya engelleyebilirsiniz. Ancak, zorunlu çerezlerin engellenmesi sitenin çalışmasını bozabilir.
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <LandingHeader />
      <main className="mx-auto max-w-[860px] px-4 py-10 sm:px-6 md:py-14">
        <Eyebrow>Hukuki metinler</Eyebrow>
        <h1 className="mb-2 mt-3 font-display text-[36px] font-normal leading-[1.1] md:text-[44px]">Yasal bilgiler</h1>
        <p className="mb-6 text-ink-muted">Platform kullanımına ilişkin sözleşme ve politikalar.</p>
        <Tabs
          className="mb-6"
          label="Yasal metin"
          value={activeTab}
          onSelect={(value) => setActiveTab(value as TabKey)}
          items={tabs.map((tab) => ({ value: tab.key, label: tab.label }))}
        />
        <Card padded className="p-6 text-[14.5px] leading-relaxed md:p-8">{getContent(activeTab)}</Card>
      </main>
      <LandingFooter />
    </div>
  )
}

export default function LegalPage() {
  return (
    <Suspense fallback={null}>
      <LegalPageContent />
    </Suspense>
  )
}
