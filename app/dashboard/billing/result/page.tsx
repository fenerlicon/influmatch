import { ButtonLink, Notice, PageHeader } from '@/components/ui'

export const metadata = { title: 'Ödeme sonucu | Influmatch' }

const COPY: Record<string, { tone: 'success' | 'danger' | 'info'; title: string; text: string }> = {
  tamam: { tone: 'success', title: 'Aboneliğin başladı', text: 'Spotlight üyeliğin aktif. Ayrıntılar ve ödeme geçmişin Ayarlar > Üyelik ve ödemeler bölümünde.' },
  hata: { tone: 'danger', title: 'Ödeme tamamlanmadı', text: 'Kartından tahsilat yapılmadı. Bilgilerini kontrol edip tekrar deneyebilirsin.' },
  beklemede: { tone: 'info', title: 'Ödeme kontrol ediliyor', text: 'Sonuç birkaç dakika içinde hesabına yansır; bildirim alacaksın.' },
}

/** iyzico dönüşünden sonraki sonuç sayfası (sonuç sunucuda iyzico'dan okunmuştur; burası yalnızca bilgi verir). */
export default function BillingResultPage({ searchParams }: { searchParams: { durum?: string } }) {
  const copy = COPY[searchParams.durum ?? ''] ?? COPY.beklemede
  return (
    <div className="grid gap-5">
      <PageHeader title="Ödeme" />
      <Notice
        tone={copy.tone}
        title={copy.title}
        action={<ButtonLink href="/dashboard/billing" size="sm" variant={copy.tone === 'success' ? 'primary' : 'secondary'}>Üyelik ve ödemeler</ButtonLink>}
      >
        {copy.text}
      </Notice>
    </div>
  )
}
