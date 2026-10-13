import { redirect } from 'next/navigation'
import { worksHref } from '@/lib/works'

// Teklifler artık İşler sayfasında (docs/REDESIGN.md); eski bağlantılar ve bildirimler buraya düşer.
export default function DashboardOffersPage() {
  redirect(worksHref('offers'))
}
