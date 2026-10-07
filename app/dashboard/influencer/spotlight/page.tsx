import { redirect } from 'next/navigation'

// Eski Spotlight tanıtım sayfası sahte istatistikler gösteriyordu ve menüde yoktu.
// Influencer Spotlight planları tek yerde: /dashboard/spotlight/influencer.
export default function InfluencerSpotlightPage() {
  redirect('/dashboard/spotlight/influencer')
}
