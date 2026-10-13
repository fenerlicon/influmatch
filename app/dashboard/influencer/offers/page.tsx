import { redirect } from 'next/navigation'
import { worksHref } from '@/lib/works'

export default function InfluencerOffersPage() {
  redirect(worksHref('offers'))
}
