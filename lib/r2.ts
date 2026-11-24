// Cloudflare R2 dosya deposu (S3 uyumlu API; ROADMAP "R2 Drive", 2026-11-24 kararı: sohbet görselleri ve teslimat dosyaları).
// Supabase Storage trafik/alan sınırlarına takılmamak için büyük ve sık açılan dosyalar R2'de tutulur; çıkış trafiği ücretsiz.
//
// - Kova gizli. Yükleme ve görüntüleme kısa süreli imzalı adreslerle (SigV4 sorgu imzası, aws4fetch); dosya Vercel'den geçmez.
// - Yükleme adresi Content-Length ve Content-Type ile imzalanır: istemci bildirdiği boyuttan farklı dosya yükleyemez,
//   sunucu boyut sınırını adres üretmeden önce uygular.
// - Ortam değişkenleri (Vercel, yalnızca sunucu): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
//   Eksikse `isR2Configured()` false döner ve çağıranlar eski yola (Supabase Storage) düşer ya da özelliği kapalı gösterir.
// - Kovada CORS kuralı gerekir (PUT/GET, influmatch.net ve önizleme alan adları); kurulum docs/SETUP.md "Cloudflare R2".
//
// Kişisel veri dışarı gönderilmez (kural 1): R2 bizim depomuz; dosyalar işlenmez, yalnızca saklanır.
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { AwsClient } from 'aws4fetch'
import { isSafeR2Key } from '@/lib/r2-shared'

export { R2_REF_PREFIX, isSafeR2Key, parseR2Ref, r2Ref, r2FileStem } from '@/lib/r2-shared'

let cached: { client: AwsClient; base: string } | null | undefined

function config(): { client: AwsClient; base: string } | null {
  if (cached !== undefined) return cached
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    cached = null
    return cached
  }
  cached = {
    client: new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' }),
    base: `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
  }
  return cached
}

export function isR2Configured(): boolean {
  return config() !== null
}

function objectUrl(base: string, key: string): string {
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`
}

/** Tarayıcıdan / mobilden doğrudan yükleme için imzalı PUT adresi. İstemci aynı Content-Type ve tam olarak `size` bayt göndermeli. */
export async function createR2UploadUrl(key: string, contentType: string, size: number, expiresSeconds = 15 * 60): Promise<string | null> {
  const cfg = config()
  if (!cfg || !isSafeR2Key(key) || !Number.isInteger(size) || size <= 0) return null
  const url = new URL(objectUrl(cfg.base, key))
  url.searchParams.set('X-Amz-Expires', String(expiresSeconds))
  const signed = await cfg.client.sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'Content-Length': String(size) },
    aws: { signQuery: true, allHeaders: true },
  })
  return signed.url
}

/**
 * Görüntüleme / indirme için imzalı GET adresi. `downloadName` verilirse tarayıcı dosyayı indirir (Content-Disposition: attachment);
 * verilmezse satır içi açılır (önizleme).
 */
export async function createR2ViewUrl(key: string, opts: { expiresSeconds?: number; downloadName?: string } = {}): Promise<string | null> {
  const cfg = config()
  if (!cfg || !isSafeR2Key(key)) return null
  const url = new URL(objectUrl(cfg.base, key))
  url.searchParams.set('X-Amz-Expires', String(opts.expiresSeconds ?? 60 * 60))
  const name = opts.downloadName?.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  url.searchParams.set('response-content-disposition', name ? `attachment; filename="${name}"` : 'inline')
  const signed = await cfg.client.sign(url.toString(), { method: 'GET', aws: { signQuery: true } })
  return signed.url
}

/** Nesnenin varlığı ve boyutu (yükleme bittikten sonra kayıt öncesi kontrol). Yoksa null. */
export async function headR2Object(key: string): Promise<{ size: number; contentType: string | null } | null> {
  const cfg = config()
  if (!cfg || !isSafeR2Key(key)) return null
  try {
    const res = await cfg.client.fetch(objectUrl(cfg.base, key), { method: 'HEAD' })
    if (!res.ok) return null
    return { size: Number(res.headers.get('content-length') ?? 0), contentType: res.headers.get('content-type') }
  } catch (error) {
    console.error('[r2] head failed', error instanceof Error ? error.message : error)
    return null
  }
}

export async function deleteR2Object(key: string): Promise<boolean> {
  const cfg = config()
  if (!cfg || !isSafeR2Key(key)) return false
  try {
    const res = await cfg.client.fetch(objectUrl(cfg.base, key), { method: 'DELETE' })
    return res.ok || res.status === 404
  } catch (error) {
    console.error('[r2] delete failed', error instanceof Error ? error.message : error)
    return false
  }
}

/** Öneki taşıyan bütün anahtarlar (ListObjectsV2; en fazla `limit`). Hesap silmede kullanılır. */
export async function listR2Keys(prefix: string, limit = 5000): Promise<string[]> {
  const cfg = config()
  if (!cfg || !prefix || !isSafeR2Key(prefix.replace(/\/$/, ''))) return []
  const keys: string[] = []
  let token: string | null = null
  try {
    do {
      const url = new URL(cfg.base)
      url.searchParams.set('list-type', '2')
      url.searchParams.set('prefix', prefix)
      url.searchParams.set('max-keys', '1000')
      if (token) url.searchParams.set('continuation-token', token)
      const res = await cfg.client.fetch(url.toString(), { method: 'GET' })
      if (!res.ok) break
      const xml = await res.text()
      for (const m of Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g))) keys.push(decodeXml(m[1]))
      const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      const next = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)
      token = truncated && next ? decodeXml(next[1]) : null
    } while (token && keys.length < limit)
  } catch (error) {
    console.error('[r2] list failed', error instanceof Error ? error.message : error)
  }
  return keys.slice(0, limit)
}

/** Öneki taşıyan bütün nesneleri siler; silinen sayısını döner. */
export async function deleteR2Prefix(prefix: string): Promise<number> {
  const keys = await listR2Keys(prefix)
  let deleted = 0
  for (const key of keys) if (await deleteR2Object(key)) deleted++
  return deleted
}

function decodeXml(value: string): string {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}
