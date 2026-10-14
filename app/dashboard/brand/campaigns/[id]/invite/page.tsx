import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ButtonLink, Card, CardBody, Notice, PageHeader } from '@/components/ui'
import CampaignInvite from '@/components/campaigns/CampaignInvite'
import CampaignProLockedCard from '@/components/campaigns/CampaignProLockedCard'
import WizardSteps from '@/components/campaigns/WizardSteps'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { CAMPAIGN_OPEN_STATUSES, campaignFeaturesFor, getCampaignAs, suggestCampaignProfilesAs } from '@/lib/campaigns'
import { getBrandLimitContext, getOfferQuota, offerQuotaSummary } from '@/lib/brand-limits'

export const revalidate = 0

// Kampanya sihirbazı, 3-4. adım: önerilen profiller → toplu davet. Bayrak açıkken yalnızca Spotlight Pro (3.19).
export default async function CampaignInvitePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const campaign = await getCampaignAs(supabase, user.id, params.id)
  if (!campaign) notFound()

  const limitContext = await getBrandLimitContext(user.id)
  const features = await campaignFeaturesFor(user.id, limitContext)
  const open = CAMPAIGN_OPEN_STATUSES.includes(campaign.status)
  const suggestions = features.suggestions && open ? await suggestCampaignProfilesAs(supabase, user.id, campaign.id) : null
  const quotaText = offerQuotaSummary(await getOfferQuota(user.id, limitContext).catch(() => null))

  return (
    <div className="mx-auto max-w-5xl">
      <ButtonLink href={`/dashboard/brand/campaigns/${campaign.id}`} variant="ghost" size="sm" leftIcon={<ArrowLeft />} className="-ml-2 mb-2">
        Kampanya panosu
      </ButtonLink>
      <PageHeader title={campaign.name} description="Hedefe uyan profilleri seç, hepsine aynı teklifle davet gönder. Her davet ayrı bir teklif olarak gider." />
      {!open ? (
        <Notice tone="warning">Tamamlanan ya da arşivlenen kampanyaya davet gönderilemez.</Notice>
      ) : !features.suggestions ? (
        <div className="grid gap-4">
          <WizardSteps current={2} />
          <CampaignProLockedCard />
          <Card>
            <CardBody className="text-[13px] text-ink-muted">
              Kampanyan kaydedildi. Profilleri tek tek eklemek için keşifte bir profil aç, &quot;Teklif Gönder&quot; penceresinde bu kampanyayı seç.
            </CardBody>
          </Card>
          <div>
            <ButtonLink href="/dashboard/brand/discover" variant="primary">
              Keşfe git
            </ButtonLink>
          </div>
        </div>
      ) : suggestions && !suggestions.success ? (
        <Notice tone="danger">{suggestions.error}</Notice>
      ) : (
        <CampaignInvite
          campaignId={campaign.id}
          campaignName={campaign.name}
          totalBudget={campaign.total_budget}
          suggestions={suggestions?.success ? suggestions.suggestions : []}
          bulkInvite={features.bulkInvite}
          quotaText={quotaText}
        />
      )}
    </div>
  )
}
