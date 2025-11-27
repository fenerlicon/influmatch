'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

const tabs = [
  { key: 'privacy', label: 'Aydınlatma Metni' },
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
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white">Aydınlatma Metni</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca hazırlanmıştır.
              </p>
              <p>
                Influmatch olarak, kişisel verilerinizin güvenliği ve gizliliği bizim için önemlidir. Bu metin, hangi
                kişisel verilerinizin toplandığı, bu verilerin nasıl işlendiği, saklandığı ve paylaşıldığı hakkında sizi
                bilgilendirmek amacıyla hazırlanmıştır.
              </p>
              <h3 className="text-xl font-semibold text-white">1. Veri Sorumlusu</h3>
              <p>
                Kişisel verilerinizin işlenmesinden sorumlu olan veri sorumlusu, Influmatch platformunu işleten
                şirkettir.
              </p>
              <h3 className="text-xl font-semibold text-white">2. Toplanan Kişisel Veriler</h3>
              <p>Platformumuzda aşağıdaki kişisel veriler toplanmaktadır:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Kimlik bilgileri (ad, soyad, kullanıcı adı)</li>
                <li>İletişim bilgileri (e-posta adresi, telefon numarası)</li>
                <li>Profil bilgileri (profil fotoğrafı, biyografi, sosyal medya bağlantıları)</li>
                <li>Kullanım verileri (platform kullanım geçmişi, tercihler)</li>
                <li>Teknik veriler (IP adresi, tarayıcı bilgileri, cihaz bilgileri)</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">3. Kişisel Verilerin İşlenme Amaçları</h3>
              <p>Kişisel verileriniz aşağıdaki amaçlarla işlenmektedir:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Platform hizmetlerinin sunulması ve yönetilmesi</li>
                <li>Kullanıcı hesaplarının oluşturulması ve yönetilmesi</li>
                <li>İşbirliği tekliflerinin ve başvurularının yönetilmesi</li>
                <li>İletişim ve mesajlaşma hizmetlerinin sağlanması</li>
                <li>Güvenlik ve dolandırıcılık önleme</li>
                <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">4. Kişisel Verilerin Paylaşılması</h3>
              <p>
                Kişisel verileriniz, yasal yükümlülüklerimiz ve hizmetlerimizin sunulması amacıyla, yalnızca gerekli
                durumlarda ve yasal çerçeve dahilinde üçüncü taraflarla paylaşılabilir.
              </p>
              <h3 className="text-xl font-semibold text-white">5. Kişisel Verilerin Korunması</h3>
              <p>
                Kişisel verilerinizin güvenliği için teknik ve idari önlemler alınmaktadır. Verileriniz, güvenli
                sunucularda saklanmakta ve şifrelenmiş bağlantılar üzerinden iletilmektedir.
              </p>
              <h3 className="text-xl font-semibold text-white">6. Haklarınız</h3>
              <p>KVKK kapsamında aşağıdaki haklara sahipsiniz:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
                <li>İşlenen kişisel verileriniz hakkında bilgi talep etme</li>
                <li>Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme</li>
                <li>Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme</li>
                <li>Kişisel verilerinizin eksik veya yanlış işlenmiş olması halinde bunların düzeltilmesini isteme</li>
                <li>Kişisel verilerinizin silinmesini veya yok edilmesini isteme</li>
                <li>İşlenen verilerin münhasıran otomatik sistemler ile analiz edilmesi suretiyle kişinin kendisi
                  aleyhine bir sonucun ortaya çıkmasına itiraz etme</li>
                <li>Kişisel verilerinizin kanuna aykırı olarak işlenmesi sebebiyle zarara uğramanız halinde zararın
                  giderilmesini talep etme</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">7. İletişim</h3>
              <p>
                KVKK kapsamındaki haklarınızı kullanmak için bizimle iletişime geçebilirsiniz. İletişim bilgilerimiz
                platform üzerinden paylaşılmaktadır.
              </p>
            </div>
          </div>
        )
      case 'terms':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white">Kullanıcı Sözleşmesi</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Bu Kullanıcı Sözleşmesi ("Sözleşme"), Influmatch platformunu ("Platform") kullanarak hizmetlerimizden
                yararlanmak isteyen kullanıcılar ("Kullanıcı") ile Influmatch arasındaki hak ve yükümlülükleri
                düzenlemektedir.
              </p>
              <h3 className="text-xl font-semibold text-white">1. Genel Hükümler</h3>
              <p>
                Bu Sözleşme, Platform'a kayıt olan ve hizmetlerimizi kullanan tüm kullanıcılar için geçerlidir.
                Platform'u kullanarak bu Sözleşme'yi kabul etmiş sayılırsınız.
              </p>
              <h3 className="text-xl font-semibold text-white">2. Hizmetler</h3>
              <p>
                Influmatch, influencerlar ve markalar arasında işbirliği fırsatları sunan bir platformdur. Platform
                üzerinden:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Influencerlar profil oluşturabilir ve işbirliği teklifleri alabilir</li>
                <li>Markalar influencerları keşfedebilir ve işbirliği teklifleri gönderebilir</li>
                <li>İşbirliği süreçleri yönetilebilir</li>
                <li>Mesajlaşma ve iletişim sağlanabilir</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">3. Kullanıcı Yükümlülükleri</h3>
              <p>Kullanıcılar olarak aşağıdaki yükümlülüklere uymakla yükümlüsünüz:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Doğru, güncel ve eksiksiz bilgi sağlamak</li>
                <li>Hesap güvenliğini sağlamak ve şifrenizi gizli tutmak</li>
                <li>Platform'u yasalara ve ahlak kurallarına uygun şekilde kullanmak</li>
                <li>Başkalarının haklarına saygı göstermek</li>
                <li>Spam, dolandırıcılık veya yanıltıcı içerik paylaşmamak</li>
                <li>Telif hakları ve fikri mülkiyet haklarına saygı göstermek</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">4. Platform Kuralları</h3>
              <p>Platform'da aşağıdaki davranışlar yasaktır:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Yanıltıcı veya sahte bilgi paylaşmak</li>
                <li>Başkalarını rahatsız etmek veya taciz etmek</li>
                <li>Spam veya istenmeyen içerik göndermek</li>
                <li>Yasadışı faaliyetlerde bulunmak</li>
                <li>Platform'un güvenliğini tehdit eden eylemlerde bulunmak</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">5. Hesap İptali ve Fesih</h3>
              <p>
                Platform kurallarını ihlal eden kullanıcıların hesapları, önceden uyarı yapılmaksızın askıya alınabilir
                veya iptal edilebilir. Kullanıcılar, hesap iptali için herhangi bir neden göstermeksizin hesabınızı
                kapatabilirsiniz.
              </p>
              <h3 className="text-xl font-semibold text-white">6. Fikri Mülkiyet</h3>
              <p>
                Platform'un tüm içeriği, tasarımı ve yazılımı Influmatch'a aittir ve telif hakları ile korunmaktadır.
                Kullanıcılar, Platform içeriğini izinsiz kopyalayamaz, dağıtamaz veya kullanamaz.
              </p>
              <h3 className="text-xl font-semibold text-white">7. Sorumluluk Reddi</h3>
              <p>
                Influmatch, Platform üzerinden gerçekleştirilen işbirliklerinden veya anlaşmalardan sorumlu değildir.
                Platform, sadece bir buluşma ortamı sağlar ve kullanıcılar arasındaki ilişkilerden sorumlu tutulamaz.
              </p>
              <h3 className="text-xl font-semibold text-white">8. Değişiklikler</h3>
              <p>
                Influmatch, bu Sözleşme'yi herhangi bir zamanda değiştirme hakkını saklı tutar. Değişiklikler Platform
                üzerinden duyurulacak ve yürürlüğe girdikten sonra geçerli olacaktır.
              </p>
              <h3 className="text-xl font-semibold text-white">9. Uygulanacak Hukuk</h3>
              <p>
                Bu Sözleşme, Türkiye Cumhuriyeti yasalarına tabidir. Herhangi bir uyuşmazlık durumunda, Türkiye
                Cumhuriyeti mahkemeleri yetkilidir.
              </p>
            </div>
          </div>
        )
      case 'cookies':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-white">Çerez Politikası</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Bu Çerez Politikası, Influmatch platformunda ("Platform") kullanılan çerezler hakkında bilgi vermek
                amacıyla hazırlanmıştır.
              </p>
              <h3 className="text-xl font-semibold text-white">1. Çerez Nedir?</h3>
              <p>
                Çerezler, web sitelerini ziyaret ettiğinizde cihazınıza (bilgisayar, tablet, telefon) kaydedilen küçük
                metin dosyalarıdır. Çerezler, web sitelerinin daha iyi çalışmasını sağlar ve kullanıcı deneyimini
                iyileştirir.
              </p>
              <h3 className="text-xl font-semibold text-white">2. Çerez Türleri</h3>
              <p>Platform'da aşağıdaki çerez türleri kullanılmaktadır:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong>Zorunlu Çerezler:</strong> Platform'un temel işlevlerinin çalışması için gerekli olan
                  çerezlerdir. Bu çerezler olmadan Platform düzgün çalışmaz.
                </li>
                <li>
                  <strong>Performans Çerezleri:</strong> Platform'un performansını analiz etmek ve kullanıcı deneyimini
                  iyileştirmek için kullanılan çerezlerdir.
                </li>
                <li>
                  <strong>İşlevsellik Çerezleri:</strong> Kullanıcı tercihlerini hatırlamak ve kişiselleştirilmiş bir
                  deneyim sunmak için kullanılan çerezlerdir.
                </li>
                <li>
                  <strong>Hedefleme Çerezleri:</strong> Kullanıcıların ilgi alanlarına göre içerik ve reklam
                  göstermek için kullanılan çerezlerdir.
                </li>
              </ul>
              <h3 className="text-xl font-semibold text-white">3. Çerez Kullanım Amaçları</h3>
              <p>Çerezler aşağıdaki amaçlarla kullanılmaktadır:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Kullanıcı oturumlarını yönetmek</li>
                <li>Kullanıcı tercihlerini hatırlamak</li>
                <li>Platform performansını analiz etmek</li>
                <li>Güvenliği sağlamak</li>
                <li>Kişiselleştirilmiş içerik sunmak</li>
              </ul>
              <h3 className="text-xl font-semibold text-white">4. Çerez Yönetimi</h3>
              <p>
                Tarayıcı ayarlarınızı kullanarak çerezleri yönetebilirsiniz. Ancak, bazı çerezleri devre dışı bırakmak
                Platform'un bazı özelliklerinin çalışmamasına neden olabilir.
              </p>
              <h3 className="text-xl font-semibold text-white">5. Üçüncü Taraf Çerezler</h3>
              <p>
                Platform'da, analiz ve reklam amaçlı üçüncü taraf çerezler de kullanılabilir. Bu çerezler, ilgili
                üçüncü tarafların gizlilik politikalarına tabidir.
              </p>
              <h3 className="text-xl font-semibold text-white">6. Çerez Politikası Güncellemeleri</h3>
              <p>
                Bu Çerez Politikası, gerektiğinde güncellenebilir. Güncellemeler Platform üzerinden duyurulacaktır.
              </p>
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
          <p className="mt-2 text-gray-300">Platform kullanımına ilişkin hukuki metinleri buradan inceleyebilirsiniz.</p>

          {/* Tabs */}
          <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8">
            <div className="prose prose-invert max-w-none">{getContent(activeTab)}</div>
          </div>
        </div>
      </div>
    </main>
  )
}

