'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const tabs = [
  { key: 'privacy', label: 'Gizlilik ve KVKK' },
  { key: 'terms', label: 'Kullanıcı Sözleşmesi' },
  { key: 'cookies', label: 'Çerez Politikası' },
] as const

type TabKey = (typeof tabs)[number]['key']

export default function LegalPage() {
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
            <h2 className="text-2xl font-semibold text-white">Gizlilik Politikası ve KVKK Aydınlatma Metni</h2>
            <div className="space-y-6 text-gray-300">
              <p className="text-sm text-gray-400 italic border-l-2 border-soft-gold pl-4">
                Son Güncelleme: 1 Ocak 2026<br />
                Veri Sorumlusu: Influmatch Teknoloji ve Medya Hizmetleri
              </p>

              <p>
                İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca,
                Influmatch platformunun kullanıcılarına ait kişisel verilerin toplanması, işlenmesi, aktarılması ve korunması süreçlerini şeffaflıkla açıklamak üzere hazırlanmıştır.
              </p>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">1. İşlenen Kişisel Veriler</h3>
                <p className="mb-2">Platform üzerinden sunduğumuz hizmetlerin doğası gereği, aşağıdaki veri kategorileri işlenmektedir:</p>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li><strong>Kimlik Verileri:</strong> Ad, soyad, doğum tarihi, T.C. kimlik numarası (fatura/ödeme işlemleri için).</li>
                  <li><strong>İletişim Verileri:</strong> E-posta adresi, telefon numarası, ikamet adresi.</li>
                  <li><strong>Mesleki Veriler:</strong> Sosyal medya hesapları, takipçi istatistikleri, içerik kategorileri, marka işbirlikleri geçmişi.</li>
                  <li><strong>Finansal Veriler:</strong> IBAN, banka hesap bilgileri, vergi numarası.</li>
                  <li><strong>İşlem Güvenliği:</strong> IP adresleri, giriş-çıkış logları, cihaz bilgileri.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">2. Veri İşleme Amaçları</h3>
                <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li>Üyelik işlemlerinin gerçekleştirilmesi ve hesap güvenliğinin sağlanması.</li>
                  <li>Marka ve Influencer arasındaki eşleşme algoritmasının çalıştırılması (Spotlight vb.).</li>
                  <li>İşbirliği süreçlerinin yönetimi, tekliflerin iletilmesi.</li>
                  <li>Ödeme hizmetlerinin sağlanması ve finansal mutabakatların yapılması.</li>
                  <li>Yasal mevzuattan kaynaklanan yükümlülüklerin yerine getirilmesi (Fatura kesimi, vergi bildirimi vb.).</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">3. Veri Aktarımı</h3>
                <p>
                  Kişisel verileriniz, açık rızanız olmaksızın üçüncü kişilerle paylaşılmaz. Ancak aşağıdaki durumlarda paylaşım yapılabilir:
                </p>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li><strong>Markalar/Influencerlar ile:</strong> Bir işbirliği teklifi kabul edildiğinde, ilgili tarafın iletişim bilgileri karşı tarafla paylaşılabilir.</li>
                  <li><strong>Hizmet Sağlayıcılar:</strong> Ödeme altyapısı (örn. Iyzico, Stripe), bulut sunucu hizmetleri.</li>
                  <li><strong>Yasal Kurumlar:</strong> Mahkemeler, icra daireleri ve yetkili kamu kurumlarının yasal talepleri doğrultusunda.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">4. Haklarınız</h3>
                <p className="mb-2">KVKK Madde 11 uyarınca, info@influmatch.net adresine başvurarak:</p>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
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
            <h2 className="text-2xl font-semibold text-white">Kullanıcı Sözleşmesi</h2>
            <div className="space-y-6 text-gray-300">
              <p className="text-sm text-gray-400 italic border-l-2 border-soft-gold pl-4">
                Yürürlük Tarihi: 1 Ocak 2026
              </p>
              <p>
                İşbu Kullanıcı Sözleşmesi ("Sözleşme"), Influmatch ("Platform") ile Platform'a üye olan gerçek veya tüzel kişi ("Kullanıcı") arasında akdedilmiştir.
                Platform'a kayıt olarak, bu sözleşmenin tüm hükümlerini okuduğunuzu, anladığınızı ve kabul ettiğinizi beyan edersiniz.
              </p>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">1. Tanımlar</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li><strong>Platform:</strong> Influmatch mobil uygulaması ve web sitesi.</li>
                  <li><strong>Marka:</strong> Ürün veya hizmetlerini tanıtmak amacıyla Influencer arayan kullanıcı.</li>
                  <li><strong>Influencer:</strong> Sosyal medya hesapları üzerinden içerik üreterek tanıtım hizmeti sunan kullanıcı.</li>
                  <li><strong>İşbirliği:</strong> Marka ve Influencer arasında Platform üzerinden kurulan hizmet ilişkisi.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">2. Üyelik Şartları</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li>Üyelik, Platform üzerindeki kayıt formunun doldurulması ve e-posta doğrulamasının yapılmasıyla başlar.</li>
                  <li>Kullanıcı, 18 yaşından büyük olduğunu ve yasal ehliyete sahip olduğunu beyan eder.</li>
                  <li>Kullanıcı, profilinde beyan ettiği tüm bilgilerin (takipçi sayısı, etkileşim oranı vb.) doğruluğundan sorumludur. Yanıltıcı beyanlar üyeliğin iptaline sebep olur.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">3. Tarafların Hak ve Yükümlülükleri</h3>
                <p className="mb-2 font-semibold text-white">3.1. Influencer'ın Yükümlülükleri:</p>
                <ul className="list-disc pl-6 mb-4 space-y-1 marker:text-soft-gold">
                  <li>Anlaşılan İşbirliği şartlarına (zamanlama, içerik formatı) tam olarak uymak.</li>
                  <li>İçeriklerde ilgili yasal düzenlemelere (Reklam Kurulu kararları, #reklam etiketi kullanımı vb.) riayet etmek.</li>
                  <li>İçeriği anlaşılan süre boyunca sosyal medya hesabında yayında tutmak.</li>
                </ul>

                <p className="mb-2 font-semibold text-white">3.2. Marka'nın Yükümlülükleri:</p>
                <ul className="list-disc pl-6 mb-4 space-y-1 marker:text-soft-gold">
                  <li>İşbirliği bedelini zamanında ve eksiksiz ödemek.</li>
                  <li>Influencer'a gerekli materyalleri (brief, görsel vb.) zamanında sağlamak.</li>
                  <li>Genel ahlaka ve yasalara aykırı tanıtım taleplerinde bulunmamak.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">4. Platformun Rolü ve Sorumluluk Reddi</h3>
                <p>
                  Influmatch, Marka ve Influencer'ı bir araya getiren bir <strong>yer sağlayıcıdır</strong>.
                  İşbirliklerinin içeriğinden, ürünlerin kalitesinden veya Influencer'ın performansından Platform sorumlu tutulamaz.
                  Taraflar arasındaki ticari ve hukuki ilişki, tarafların kendi sorumluluğundadır.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">5. Ödeme ve Komisyon</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li>Platform, sağladığı aracılık hizmeti karşılığında belirli oranlarda hizmet bedeli veya komisyon talep edebilir.</li>
                  <li>Ödemeler, Platform'un güvenli ödeme altyapısı üzerinden gerçekleştirilir.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">6. Fesih</h3>
                <p>
                  Kullanıcı, dilediği zaman hesabını kapatabilir. Ancak, devam eden bir İşbirliği varsa, bu yükümlülük tamamlanmadan hesap kapatılamaz.
                  Influmatch, kuralları ihlal eden kullanıcıların hesaplarını tazminatsız olarak kapatma hakkını saklı tutar.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">7. Yetkili Mahkeme</h3>
                <p> İşbu Sözleşme Türkiye Cumhuriyeti kanunlarına tabidir. İhtilaf halinde İstanbul (Çağlayan) Mahkemeleri yetkilidir.</p>
              </div>

            </div>
          </div>
        )
      case 'cookies':
        return (
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-white">Çerez Politikası</h2>
            <div className="space-y-6 text-gray-300">
              <p>
                Influmatch olarak, web sitemizdeki deneyiminizi kişiselleştirmek ve geliştirmek amacıyla çerezler (cookies) kullanmaktayız.
              </p>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">1. Çerez Nedir?</h3>
                <p>Tarayıcınız aracılığıyla cihazınıza kaydedilen ve siteyi tekrar ziyaret ettiğinizde sizi hatırlamamıza yarayan küçük veri dosyalarıdır.</p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">2. Hangi Çerezleri Kullanıyoruz?</h3>
                <ul className="list-disc pl-6 space-y-1 marker:text-soft-gold">
                  <li><strong>Zorunlu Çerezler:</strong> Oturum açma, güvenli form gönderme gibi temel işlevler için gereklidir. Kapatılamaz.</li>
                  <li><strong>Analitik Çerezler:</strong> Ziyaretçi sayıları, en çok gezilen sayfalar gibi istatistikleri tutar (Google Analytics vb.).</li>
                  <li><strong>Pazarlama Çerezleri:</strong> İlgi alanlarınıza uygun reklamlar göstermek için kullanılır.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-2">3. Çerez Yönetimi</h3>
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
    <main className="min-h-screen bg-background px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Hukuki Metinler</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Yasal Bilgiler</h1>
          <p className="mt-2 text-gray-300">Platform kullanımına ilişkin resmi sözleşme ve politikalar.</p>

          <div className="mt-8 flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-[120px] rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive
                      ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                      : 'text-gray-400 hover:text-white'
                    }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 max-h-[800px] overflow-y-auto custom-scrollbar">
            <div className="prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-white prose-strong:text-white">
              {getContent(activeTab)}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
