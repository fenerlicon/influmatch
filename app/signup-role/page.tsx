import { redirect } from 'next/navigation'

// Rol seçimi kayıt formunun içinde; eski bağlantılar (e-postalar, paylaşılan adresler) kırılmasın diye yönlenir.
export default function SignupRolePage({ searchParams }: { searchParams: { role?: string; creator_type?: string } }) {
  const params = new URLSearchParams()
  if (searchParams.role === 'brand' || searchParams.role === 'influencer') params.set('role', searchParams.role)
  if (searchParams.creator_type === 'ugc' || searchParams.creator_type === 'influencer') params.set('creator_type', searchParams.creator_type)
  const query = params.toString()
  redirect(query ? `/signup?${query}` : '/signup')
}
