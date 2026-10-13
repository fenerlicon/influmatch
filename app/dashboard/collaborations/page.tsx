import { redirect } from 'next/navigation'
import { worksHref } from '@/lib/works'

// İş birlikleri artık İşler sayfasında (docs/REDESIGN.md); detay sayfası /dashboard/collaborations/[id] yerinde kalır.
export default function CollaborationsPage() {
  redirect(worksHref('active'))
}
