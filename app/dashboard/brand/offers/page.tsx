import { redirect } from 'next/navigation'
import { worksHref } from '@/lib/works'

// Gönderilen teklifler artık İşler sayfasında (docs/REDESIGN.md); eski bağlantılar ve bildirimler buraya düşer.
export default function BrandOffersPage() {
  redirect(worksHref('offers'))
}
