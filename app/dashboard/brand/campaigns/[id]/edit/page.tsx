import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ButtonLink, PageHeader } from '@/components/ui'
import CampaignForm from '@/components/campaigns/CampaignForm'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { getCampaignAs } from '@/lib/campaigns'

export const revalidate = 0

export default async function EditCampaignPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // RLS'li okuma + brand_id eşleşmesi: başka markanın kampanyası bulunamaz.
  const campaign = await getCampaignAs(supabase, user.id, params.id)
  if (!campaign) notFound()

  return (
    <div className="mx-auto max-w-3xl">
      <ButtonLink href={`/dashboard/brand/campaigns/${campaign.id}`} variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2 mb-2">
        Kampanyaya dön
      </ButtonLink>
      <PageHeader title="Kampanyayı düzenle" description={campaign.name} />
      <CampaignForm initial={campaign} />
    </div>
  )
}
