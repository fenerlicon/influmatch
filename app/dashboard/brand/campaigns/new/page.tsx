import { ArrowLeft } from 'lucide-react'
import { ButtonLink, PageHeader } from '@/components/ui'
import CampaignForm from '@/components/campaigns/CampaignForm'

// Kampanya sihirbazı, 1-2. adım (brief + hedef). Kaydedince öneriler / davet adımına (/[id]/invite) geçer.
export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <ButtonLink href="/dashboard/brand/campaigns" variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2 mb-2">
        Kampanyalar
      </ButtonLink>
      <PageHeader title="Yeni kampanya" description="Brief ve hedefi yaz; ardından uygun profilleri seçip davet et." />
      <CampaignForm />
    </div>
  )
}
