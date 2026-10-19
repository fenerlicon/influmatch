import Link from 'next/link'
import { redirect } from 'next/navigation'
import ProductStageHeader from '@/components/landing/ProductStageHeader'
import RevealOnScroll from '@/components/landing/RevealOnScroll'
import '@/components/landing/landing.css'

// Ana sayfa (2026-10-19): OpenDesign "Influmatch Ana Sayfa Yönleri" → Yön B · Ürün sahnesi. Örnek arayüz parçaları
// gerçek akışların sadeleştirilmiş görünümüdür; rakam yerine gizli değer çubuğu kullanılır (uydurma sayı yok).
export const dynamic = 'force-dynamic'

interface HomeProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  )
}

function TickIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 9.5 7.5 13 14 5.5" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="m4.5 7 4.5 4.5L13.5 7" />
    </svg>
  )
}

function VerifiedMark() {
  return (
    <span className="vb">
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M2.5 6.2 5 8.5l4.5-5" />
      </svg>
      Doğrulandı
    </span>
  )
}

const Redact = ({ size, ink }: { size?: 'lg'; ink?: boolean }) => (
  <span className={['redact', size, ink && 'ink'].filter(Boolean).join(' ')} aria-label="örnek değer" />
)

const FAQS = [
  { q: 'Kayıt olmak ücretli mi?', a: 'Hayır, kayıt ücretsizdir. Spotlight isteğe bağlı, ücretli bir görünürlük paketidir.' },
  {
    q: 'Doğrulama nasıl yapılıyor?',
    a: 'İçerik üreticileri panelde verilen kodu Instagram ya da TikTok biyografilerine ekler. Markalar vergi levhası, kurumsal kimlik ve şirket alan adlı kurumsal e-postayla doğrulanır.',
  },
  { q: 'Marka ile içerik üreticisi arasında aracı var mı?', a: 'Yok. Taraflar birbirini doğrudan bulur, teklifleşir ve platform içinden mesajlaşır.' },
  {
    q: 'Sonuç raporundaki veriler nereden geliyor?',
    a: 'İş birliğine kaydedilen yayın linkinden: beğeni, yorum ve izlenme. 1000 izlenme başı maliyet bu verilerden ve anlaşılan ücretten hesaplanır.',
  },
  { q: 'Hangi platformlar destekleniyor?', a: 'Instagram ve TikTok.' },
]

export default function Home({ searchParams }: HomeProps) {
  // Supabase e-posta doğrulama bağlantısından gelen hata parametreleri giriş sayfasına yönlendirilir.
  const error = typeof searchParams.error === 'string' ? searchParams.error : null
  const errorCode = typeof searchParams.error_code === 'string' ? searchParams.error_code : null
  if (error || errorCode) {
    let errorMessage = 'verification_failed'
    if (errorCode === 'otp_expired') errorMessage = 'email_link_expired'
    else if (error === 'access_denied') errorMessage = 'verification_denied'
    redirect(`/login?error=${errorMessage}`)
  }

  return (
    <div className="lp">
      <ProductStageHeader />
      <RevealOnScroll />

      <main>
        <section className="hero">
          <div className="wrap">
            <div>
              <span className="eyebrow">Instagram &amp; TikTok iş birlikleri</span>
              <h1>
                İş birliğinin tamamı, <em>tek ekranda.</em>
              </h1>
              <p className="lede">
                Doğrulanmış influencer ve UGC üreticilerini bul, teklifini gönder, içeriği takip et, sonucu gör. Marka ile içerik
                üreticisi arasında aracı yok.
              </p>
              <div className="cta-row">
                <Link className="btn btn-primary" href="/signup">
                  Ücretsiz hesap oluştur
                  <ArrowIcon />
                </Link>
                <a className="btn btn-ghost" href="#urun">
                  Ürünü gez
                </a>
              </div>
              <p className="note">Kayıt ücretsiz.</p>
            </div>

            <div className="scene" role="img" aria-label="Influmatch arayüzünden örnek görünüm: İşler listesi, yeni teklif kartı, sohbet ve iş akışı aşamaları">
              <span className="label" aria-hidden="true">
                Örnek arayüz
              </span>
              <div className="win s-jobs rv" aria-hidden="true">
                <div className="win-bar">
                  <span className="t">İşler</span>
                  <div className="tabs">
                    <span className="on">Aktif</span>
                    <span>Teklifler</span>
                    <span>Tamamlanan</span>
                  </div>
                </div>
                <div className="row">
                  <span className="av" />
                  <div>
                    <div className="tt">Bahar koleksiyonu · Reels</div>
                    <div className="ss">Örnek marka · Instagram</div>
                  </div>
                  <span className="chip prep">
                    <i className="d" />
                    İçerik hazırlanıyor
                  </span>
                </div>
                <div className="row">
                  <span className="av" />
                  <div>
                    <div className="tt">Ürün inceleme videosu</div>
                    <div className="ss">Örnek marka · TikTok</div>
                  </div>
                  <span className="chip live">
                    <i className="d" />
                    Yayında
                  </span>
                </div>
                <div className="row">
                  <span className="av" />
                  <div>
                    <div className="tt">Kahvaltı menüsü · Story</div>
                    <div className="ss">Örnek marka · Instagram</div>
                  </div>
                  <span className="chip">
                    <i className="d" />
                    Anlaşıldı
                  </span>
                </div>
                <div className="row">
                  <span className="av" />
                  <div>
                    <div className="tt">Cilt bakımı UGC seti</div>
                    <div className="ss">Örnek marka · UGC</div>
                  </div>
                  <span className="chip ok">
                    <i className="d" />
                    Tamamlandı
                  </span>
                </div>
              </div>
              <div className="win s-offer rv d1" aria-hidden="true">
                <div className="k">Yeni teklif</div>
                <h3>Yaz kampanyası için kısa video</h3>
                <div className="kv">
                  <span>Platform</span>
                  <span>TikTok</span>
                </div>
                <div className="kv">
                  <span>Teslimat</span>
                  <span>Video + kapak</span>
                </div>
                <div className="kv">
                  <span>Bütçe</span>
                  <Redact />
                </div>
                <div className="acts">
                  <span className="mbtn solid">Teklifi incele</span>
                  <span className="mbtn">Markayla görüş</span>
                </div>
              </div>
              <div className="win s-chat rv d2" aria-hidden="true">
                <div className="k">Mesajlar</div>
                <div className="bub in">Taslağı yükledim, göz atabilir misin?</div>
                <div className="bub out">Harika olmuş. Ürünü ilk saniyede gösterelim.</div>
                <div className="seen">Görüldü</div>
                <div className="typing">
                  <span className="dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  yazıyor…
                </div>
              </div>
              <div className="win s-flow rv d3" aria-hidden="true">
                <div className="k">İş akışı</div>
                <p className="cur">Şu an: İçerik hazırlanıyor</p>
                <div className="stages">
                  <span className="stg done">Anlaşıldı</span>
                  <span className="stg now">İçerik</span>
                  <span className="stg">Yayında</span>
                  <span className="stg">Bitti</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="nasil">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Nasıl çalışır</span>
              <h2>
                Doğrula, bul, anlaş, <em>ölç.</em>
              </h2>
            </div>
            <ol className="steps">
              <li className="rv">
                <div className="n">1</div>
                <h3>Hesabını doğrula</h3>
                <p>İçerik üreticisi biyografi koduyla, marka vergi levhası, kurumsal kimlik ve kurumsal e-postayla.</p>
              </li>
              <li className="rv d1">
                <div className="n">2</div>
                <h3>Keşfet ya da ilan aç</h3>
                <p>Kategori, şehir, takipçi aralığı, etkileşim ve bütçeye göre süz.</p>
              </li>
              <li className="rv d2">
                <div className="n">3</div>
                <h3>Teklif gönder, anlaş</h3>
                <p>Doğrudan teklif, ilan başvurusu ya da kampanyayla toplu davet.</p>
              </li>
              <li className="rv d3">
                <div className="n">4</div>
                <h3>Yayını takip et</h3>
                <p>Aşamaları izle, yayın linkini kaydet, sonuç raporunu gör.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="sec" id="urun">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Ürünün içinden</span>
              <h2>
                Her adımın <em>kendi ekranı</em> var.
              </h2>
              <p>Aşağıdaki parçalar Influmatch&apos;teki gerçek akışların sadeleştirilmiş görünümleridir.</p>
            </div>

            <div className="feat">
              <div className="copy rv">
                <span className="eyebrow">Keşfet</span>
                <h3>
                  Aradığın profili <em>filtrelerle</em> bul.
                </h3>
                <p>Kategori, şehir, takipçi aralığı, etkileşim ve bütçe. Listede yalnızca doğrulanmış profiller yer alır.</p>
              </div>
              <div className="stage-ui rv d1" aria-hidden="true">
                <div className="win">
                  <div className="filters">
                    <span className="chip sel">Kategori: Güzellik</span>
                    <span className="chip sel">Şehir: İstanbul</span>
                    <span className="chip">Takipçi aralığı</span>
                    <span className="chip">Etkileşim</span>
                    <span className="chip">Bütçe</span>
                  </div>
                  <div className="grid-res">
                    {[0, 1, 2].map((i) => (
                      <div className="res" key={i}>
                        <div className="img">
                          <span>Profil görseli</span>
                        </div>
                        <div className="m">
                          <b>Örnek profil</b>
                          <VerifiedMark />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="feat flip">
              <div className="copy rv">
                <span className="eyebrow">Teklif, ilan, kampanya</span>
                <h3>
                  Tek profile teklif, <em>çok profile</em> davet.
                </h3>
                <ul className="ticks">
                  <li>
                    <TickIcon />
                    Doğrudan teklif gönder.
                  </li>
                  <li>
                    <TickIcon />
                    İlan aç, gelen başvuruları değerlendir.
                  </li>
                  <li>
                    <TickIcon />
                    Kampanyada bir brief&apos;i seçtiğin profillere toplu gönder.
                  </li>
                </ul>
              </div>
              <div className="stage-ui rv d1" aria-hidden="true">
                <div className="win">
                  <div className="seg">
                    <span>Doğrudan teklif</span>
                    <span>İlan</span>
                    <span className="on">Kampanya</span>
                  </div>
                  <div className="brief">
                    <div className="eyebrow">Brief</div>
                    <h4>Yeni sezon ürün tanıtımı</h4>
                    <div className="kv">
                      <span>Platform</span>
                      <span>Instagram, TikTok</span>
                    </div>
                    <div className="kv">
                      <span>Bütçe / profil</span>
                      <Redact />
                    </div>
                    <div className="pick">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i}>
                          <i className="av" />
                          Örnek profil
                        </span>
                      ))}
                    </div>
                    <span className="mbtn solid">Toplu davet gönder</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat">
              <div className="copy rv">
                <span className="eyebrow">İş birliği akışı</span>
                <h3>
                  Anlaşmadan ödemeye, <em>hiçbir şey</em> kaybolmaz.
                </h3>
                <p>
                  Anlaşıldı, İçerik hazırlanıyor, Yayında, Tamamlandı. Her aşamada anlaşma özeti, teslimatlar, revize sayacı, yayın
                  linki ve ödeme teyidi aynı yerde.
                </p>
              </div>
              <div className="stage-ui rv d1" aria-hidden="true">
                <div className="win deal">
                  <div className="h">
                    <b>Bahar koleksiyonu · Reels</b>
                    <span className="chip live">
                      <i className="d" />
                      Yayında
                    </span>
                  </div>
                  <div className="stages">
                    <span className="stg done">Anlaşıldı</span>
                    <span className="stg done">İçerik hazırlanıyor</span>
                    <span className="stg now">Yayında</span>
                    <span className="stg">Tamamlandı</span>
                  </div>
                  <div className="cols">
                    <div className="box">
                      <div className="k">Anlaşma özeti</div>
                      <div className="kv">
                        <span>Platform</span>
                        <span>Instagram</span>
                      </div>
                      <div className="kv">
                        <span>Ücret</span>
                        <Redact />
                      </div>
                    </div>
                    <div className="box">
                      <div className="k">Teslimatlar</div>
                      <div className="chk on">
                        <i />
                        Reels videosu
                      </div>
                      <div className="chk on">
                        <i />
                        Kapak görseli
                      </div>
                      <div className="chk">
                        <i />
                        Story paylaşımı
                      </div>
                    </div>
                    <div className="box">
                      <div className="k">Revize sayacı</div>
                      <div style={{ fontSize: 13 }}>1 / 2 revize kullanıldı</div>
                      <div className="rev">
                        <i className="u" />
                        <i />
                      </div>
                    </div>
                    <div className="box">
                      <div className="k">Yayın ve ödeme</div>
                      <div className="kv">
                        <span>Yayın linki</span>
                        <span>instagram.com/reel/…</span>
                      </div>
                      <div className="kv" style={{ border: 0 }}>
                        <span>Ödeme teyidi</span>
                        <span>Bekleniyor</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat flip">
              <div className="copy rv">
                <span className="eyebrow">Sonuç raporu</span>
                <h3>
                  Yayın linkinden, <em>net</em> sonuç.
                </h3>
                <p>Beğeni, yorum ve izlenme yayın linkinden gelir. Harcamanın karşılığını 1000 izlenme başı maliyetle görürsün.</p>
              </div>
              <div className="stage-ui rv d1" aria-hidden="true">
                <div className="win">
                  <div className="win-bar">
                    <span className="t">Sonuç raporu</span>
                    <span className="chip ok" style={{ marginLeft: 'auto' }}>
                      <i className="d" />
                      Tamamlandı
                    </span>
                  </div>
                  <div className="metrics">
                    <div className="metric">
                      <div className="k">Beğeni</div>
                      <div className="v">
                        <Redact size="lg" />
                      </div>
                    </div>
                    <div className="metric">
                      <div className="k">Yorum</div>
                      <div className="v">
                        <Redact size="lg" />
                      </div>
                    </div>
                    <div className="metric">
                      <div className="k">İzlenme</div>
                      <div className="v">
                        <Redact size="lg" />
                      </div>
                    </div>
                    <div className="metric">
                      <div className="k">Kaynak</div>
                      <div className="v" style={{ fontSize: 13 }}>
                        Yayın linki
                      </div>
                    </div>
                    <div className="metric wide">
                      <div className="k">1000 izlenme başı maliyet</div>
                      <Redact size="lg" ink />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="feat">
              <div className="copy rv">
                <span className="eyebrow">Mesajlaşma</span>
                <h3>
                  Karşı tarafa <em>doğrudan</em> ulaş.
                </h3>
                <p>
                  Teklif ya da ilan başvurusundan sonra sohbet açılır. Brief, taslak ve yayın tarihi aracı olmadan, işin hemen yanında
                  konuşulur.
                </p>
              </div>
              <div className="stage-ui rv d1" aria-hidden="true">
                <div className="win">
                  <div className="chat-h">
                    <span className="av" style={{ width: 28, height: 28 }} />
                    Örnek profil
                    <span className="st">Bahar koleksiyonu · Reels</span>
                  </div>
                  <div className="chat">
                    <div className="bub in">Revizeyi yükledim, müzik değişti.</div>
                    <div className="bub out">Teşekkürler, bu hali çok iyi. Yayın tarihini onaylıyorum.</div>
                    <div className="seen">Görüldü</div>
                    <div className="typing">
                      <span className="dots">
                        <i />
                        <i />
                        <i />
                      </span>
                      yazıyor…
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="dogrulama">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">Doğrulama ve güven</span>
              <h2>
                Herkes <em>doğrulanmış.</em> İki taraf da.
              </h2>
              <p>Keşfet&apos;te yalnızca doğrulanmış profiller görünür; markalar da şirket bilgileriyle doğrulanır.</p>
            </div>
            <div className="vgrid">
              <div className="win vcard rv">
                <span className="eyebrow">Influencer ve UGC üreticisi</span>
                <h3>Biyografine bir kod ekle.</h3>
                <p>Panelde sana özel bir kod oluşur. Instagram ya da TikTok biyografine eklediğinde hesabın doğrulanır.</p>
                <div className="code">
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Doğrulama kodun (örnek)</span>
                  <b>IM-7K2Q</b>
                </div>
                <div className="bio" aria-hidden="true">
                  Biyografi: İçerik üreticisi · İstanbul <mark>IM-7K2Q</mark>
                </div>
              </div>
              <div className="win vcard rv d1">
                <span className="eyebrow">Marka</span>
                <h3>Şirketin, belgeleriyle.</h3>
                <p>Marka hesapları üç adımda doğrulanır.</p>
                <div className="chk on">
                  <i />
                  Vergi levhası
                </div>
                <div className="chk on">
                  <i />
                  Kurumsal kimlik
                </div>
                <div className="chk on">
                  <i />
                  Şirket alan adlı kurumsal e-posta (ad@sirketiniz.com)
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="spot" id="spotlight">
          <div className="wrap">
            <div className="spot-card rv">
              <div>
                <span className="eyebrow">Ücretli görünürlük paketi</span>
                <h2>
                  <em>Spotlight</em>
                </h2>
              </div>
              <ul>
                <li>
                  <b>Keşifte öncelik</b>
                  <span>Aramalarda daha üstte görün.</span>
                </li>
                <li>
                  <b>Eşleşme önerileri</b>
                  <span>Sana uygun profiller ya da markalar önerilir.</span>
                </li>
                <li>
                  <b>Sonuç raporları</b>
                  <span>İş birliklerinin sonuçlarını ayrıntılı izle.</span>
                </li>
              </ul>
              <div>
                <div className="p">Influencer ve marka paketleri</div>
                <small>Aylık ya da yıllık; ayrıntılar paket sayfasında.</small>
                <Link className="btn btn-ghost" href="/spotlight">
                  Spotlight&apos;ı incele
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="sss">
          <div className="wrap">
            <div className="sec-head">
              <span className="eyebrow">S.S.S.</span>
              <h2>Sık sorulanlar</h2>
            </div>
            <div className="faq">
              {FAQS.map((item) => (
                <details key={item.q}>
                  <summary>
                    {item.q}
                    <ChevronIcon />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="close">
          <div className="wrap">
            <h2>
              İlk iş birliğini <em>bugün</em> kur.
            </h2>
            <p>Marka ya da içerik üreticisi olarak ücretsiz kaydol, hesabını doğrula, ilk teklifini gönder ya da al.</p>
            <Link className="btn btn-primary" href="/signup">
              Ücretsiz başla
              <ArrowIcon />
            </Link>
          </div>
        </section>
      </main>

      <footer className="ftr">
        <div className="wrap">
          <span>© {new Date().getFullYear()} Influmatch</span>
          <nav aria-label="Alt bilgi">
            <Link href="/spotlight">Spotlight</Link>
            <Link href="/legal">Yasal</Link>
            <Link href="/legal?tab=privacy">Gizlilik</Link>
            <Link href="/feedback">Geri bildirim</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
