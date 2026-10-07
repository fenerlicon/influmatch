// Profil fotoğrafı/logo adresi istemciden gelir; sunucu yalnızca kullanıcının kendi
// avatars/{kullanıcı-id}/ klasöründeki genel adresi (ya da zaten kayıtlı değeri) kabul eder.
// Böylece profile dışarıdan rastgele bir adres (izleme pikseli vb.) yazılamaz.

export function isAllowedAvatarUrl(url: string | null | undefined, userId: string, currentUrl?: string | null): boolean {
  if (url === null || url === undefined || url === '') return true
  if (currentUrl && url === currentUrl) return true
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '')
  if (!base) return false
  const prefix = `${base}/storage/v1/object/public/avatars/${userId}/`
  if (!url.startsWith(prefix)) return false
  const rest = url.slice(prefix.length).split('?')[0]
  return rest.length > 0 && !rest.includes('/') && !rest.includes('..')
}
