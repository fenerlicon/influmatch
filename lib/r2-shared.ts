// R2 referansları için istemci + sunucu ortak yardımcılar (sunucu bağımlılığı yok). İmzalama lib/r2.ts'de, yalnızca sunucuda.

/** Mesajlarda / kayıtlarda R2 anahtarını Supabase yolundan ayıran önek. */
export const R2_REF_PREFIX = 'r2://'

/** Anahtar yalnızca güvenli karakterlerden oluşur ve `..` / `//` içermez (yol kaçışı yok). */
export function isSafeR2Key(key: string): boolean {
  return /^[a-z0-9][a-z0-9/_.-]{0,400}$/i.test(key) && !key.includes('..') && !key.includes('//')
}

/** `r2://anahtar` → anahtar; R2 referansı değilse null. */
export function parseR2Ref(value: string | null | undefined): string | null {
  if (!value || !value.startsWith(R2_REF_PREFIX)) return null
  const key = value.slice(R2_REF_PREFIX.length)
  return isSafeR2Key(key) ? key : null
}

export function r2Ref(key: string): string {
  return `${R2_REF_PREFIX}${key}`
}

/** Rastgele dosya adı parçası (zaman + rastgele). */
export function r2FileStem(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}
