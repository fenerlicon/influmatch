import { Lock } from 'lucide-react'
import { ButtonLink, Card, EmptyState } from '@/components/ui'

/**
 * Ücretsiz / Basic markada (sınırlar açıkken) kampanya önerileri ve toplu davet yerine gösterilen açıklama kartı.
 * Fiyat / iddia içermez. Kampanya açmak ve profilleri tek tek eklemek herkese açık.
 */
export default function CampaignProLockedCard({ compact = false }: { compact?: boolean }) {
  return (
    <Card>
      <EmptyState
        icon={Lock}
        className={compact ? 'py-6' : undefined}
        title="Kampanya önerileri ve toplu davet Spotlight Pro markalara özel"
        description="Kampanyanı yine oluşturabilir, profilleri tek tek ekleyebilirsin: profil sayfasındaki teklif penceresinden kampanyayı seç ya da mevcut tekliflerini kampanyaya bağla."
        action={
          <ButtonLink href="/dashboard/spotlight/brand" variant="primary" size="sm">
            Spotlight&apos;ı incele
          </ButtonLink>
        }
      />
    </Card>
  )
}
