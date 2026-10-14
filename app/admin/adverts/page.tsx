import AdvertsAdminPanel from '@/components/admin/AdvertsAdminPanel'

export const revalidate = 0

// Yetki: app/admin/layout.tsx (yalnızca admin). Liste admin sunucu eylemleriyle yüklenir.
export default function AdminAdvertsPage() {
  return <AdvertsAdminPanel />
}
