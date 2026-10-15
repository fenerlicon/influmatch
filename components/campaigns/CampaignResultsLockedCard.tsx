import { Lock } from 'lucide-react'
import { ButtonLink, Card, EmptyState } from '@/components/ui'

/**
 * Ücretsiz / Basic markada (sınırlar açıkken) kampanya sonuç raporu yerine gösterilen açıklama kartı (3.20).
 * Fiyat / iddia içermez. İş birliği başına gönderi ölçümleri herkese açık kalır.
 */
export default function CampaignResultsLockedCard() {
  return (
    <Card>
      <EmptyState
        icon={Lock}
        className="py-6"
        title="Kampanya sonuç raporu Spotlight Pro markalara özel"
        description="Her gönderinin ölçümlerini iş birliği sayfasında görmeye devam edersin. Kampanya toplamları, maliyet hesapları ve yazdırılabilir rapor Pro pakette."
        action={
          <ButtonLink href="/dashboard/spotlight/brand" variant="primary" size="sm">
            Spotlight&apos;ı incele
          </ButtonLink>
        }
      />
    </Card>
  )
}
