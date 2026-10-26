// Supabase Storage kopyalama (bölge taşıma, docs/REGION_MOVE.md adım 5).
// Eski projedeki bütün kovaları ve dosyaları yeni projeye kopyalar. Var olan dosyanın üzerine yazar (upsert),
// tekrar çalıştırmak güvenlidir. Hiçbir şey SİLMEZ.
//
// Kullanım (anahtarlar yalnızca ortam değişkeninden; dosyaya, commit'e, sohbete yazma):
//   OLD_SUPABASE_URL=https://<eski>.supabase.co OLD_SERVICE_ROLE_KEY=... \
//   NEW_SUPABASE_URL=https://<yeni>.supabase.co NEW_SERVICE_ROLE_KEY=... \
//   node scripts/storage-copy.mjs [--dry-run] [--bucket avatars]
//
// Gereken paket: @supabase/supabase-js (repoda zaten var; önce `npm ci`).

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const onlyBucket = args.includes('--bucket') ? args[args.indexOf('--bucket') + 1] : null

function env(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Eksik ortam değişkeni: ${name}`)
    process.exit(1)
  }
  return value
}

const options = { auth: { persistSession: false, autoRefreshToken: false } }
const oldClient = createClient(env('OLD_SUPABASE_URL'), env('OLD_SERVICE_ROLE_KEY'), options)
const newClient = createClient(env('NEW_SUPABASE_URL'), env('NEW_SERVICE_ROLE_KEY'), options)

/** Kovadaki bütün dosya yollarını (alt klasörler dahil) döndürür. */
async function listAll(client, bucket, prefix = '') {
  const files = []
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } })
    if (error) throw new Error(`${bucket}/${prefix} listelenemedi: ${error.message}`)
    for (const item of data ?? []) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      // Klasörlerin id'si yoktur; içine inilir.
      if (item.id === null) files.push(...(await listAll(client, bucket, path)))
      else files.push({ path, contentType: item.metadata?.mimetype ?? undefined, size: item.metadata?.size ?? 0 })
    }
    if (!data || data.length < 1000) break
  }
  return files
}

async function ensureBucket(bucket) {
  const { data: existing } = await newClient.storage.getBucket(bucket.id)
  if (existing) return
  if (dryRun) return console.log(`[dry-run] kova oluşturulacak: ${bucket.id}`)
  const { error } = await newClient.storage.createBucket(bucket.id, {
    public: bucket.public,
    fileSizeLimit: bucket.file_size_limit ?? undefined,
    allowedMimeTypes: bucket.allowed_mime_types ?? undefined,
  })
  if (error) throw new Error(`${bucket.id} kovası oluşturulamadı: ${error.message}`)
  console.log(`kova oluşturuldu: ${bucket.id}`)
}

async function main() {
  const { data: buckets, error } = await oldClient.storage.listBuckets()
  if (error) throw new Error(`Kovalar okunamadı: ${error.message}`)
  const summary = []
  for (const bucket of buckets.filter((b) => !onlyBucket || b.id === onlyBucket)) {
    await ensureBucket(bucket)
    const files = await listAll(oldClient, bucket.id)
    let copied = 0
    let failed = 0
    for (const file of files) {
      if (dryRun) {
        copied++
        continue
      }
      const { data: blob, error: downloadError } = await oldClient.storage.from(bucket.id).download(file.path)
      if (downloadError || !blob) {
        failed++
        console.error(`indirilemedi: ${bucket.id}/${file.path}: ${downloadError?.message}`)
        continue
      }
      const { error: uploadError } = await newClient.storage
        .from(bucket.id)
        .upload(file.path, blob, { upsert: true, contentType: file.contentType ?? blob.type, cacheControl: '31536000' })
      if (uploadError) {
        failed++
        console.error(`yüklenemedi: ${bucket.id}/${file.path}: ${uploadError.message}`)
        continue
      }
      copied++
    }
    summary.push({ bucket: bucket.id, files: files.length, copied, failed })
    console.log(`${bucket.id}: ${files.length} dosya, ${copied} kopyalandı, ${failed} hata${dryRun ? ' (dry-run)' : ''}`)
  }
  console.table(summary)
  if (summary.some((row) => row.failed > 0)) process.exit(2)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
