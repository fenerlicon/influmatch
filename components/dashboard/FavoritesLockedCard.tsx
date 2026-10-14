import { Lock } from 'lucide-react'
import { ButtonLink, Card, EmptyState } from '@/components/ui'

/**
 * Ücretsiz markada (sınırlar açıkken) favoriler ve listeler yerine gösterilen açıklama kartı.
 * Fiyat / iddia içermez. Kayıtlı favoriler ve listeler silinmez; Spotlight ile geri gelir.
 */
export default function FavoritesLockedCard() {
  return (
    <Card>
      <EmptyState
        icon={Lock}
        title="Favoriler ve listeler Spotlight markalara özel"
        description="Daha önce kaydettiğin favoriler ve listeler silinmedi; Spotlight'a geçtiğinde olduğu gibi geri gelir."
        action={
          <ButtonLink href="/dashboard/spotlight/brand" variant="primary" size="sm">
            Spotlight&apos;ı incele
          </ButtonLink>
        }
      />
    </Card>
  )
}
