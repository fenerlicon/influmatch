// iyzico abonelik ürünleri ve fiyatlandırma planlarını lib/spotlight-plans.ts fiyatlarından oluşturur (docs/PAYMENTS.md).
// Tekrar çalıştırmak güvenlidir: ürün ve plan ADA göre aranır, yoksa oluşturulur, varsa dokunulmaz. Hiçbir şey SİLMEZ.
// iyzico plan fiyatı sonradan değiştirilemez; fiyatı farklı mevcut plan "UYUŞMAZLIK" olarak yazılır (çözüm: docs/PAYMENTS.md).
//
// Kullanım (anahtarlar yalnızca ortam değişkeninden; dosyaya, commit'e, sohbete yazma):
//   IYZICO_API_KEY=... IYZICO_SECRET_KEY=... [IYZICO_BASE_URL=https://sandbox-api.iyzipay.com] \
//   node scripts/iyzico-sync-plans.mjs [--dry-run] [--discounts=20,50]
//
// Oluşan adlar (sunucu bunları ada göre bulur, lib/payments/billing-shared.ts ile aynı olmalı):
//   Ürünler: "Influmatch Spotlight Influencer", "Influmatch Spotlight Marka"
//   Planlar: IM-<plan>-<mo|yr> ve indirimli ilk dönem için IM-<plan>-<mo|yr>-D<yüzde>

import { createHmac, randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const discountArg = args.find((a) => a.startsWith('--discounts='))
const DISCOUNTS = (discountArg ? discountArg.split('=')[1] : '20,50')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isInteger(n) && n > 0 && n < 100)

const PRODUCT_NAMES = { influencer: 'Influmatch Spotlight Influencer', brand: 'Influmatch Spotlight Marka' }
const PLAN_ROLE = { ibasic: 'influencer', ipro: 'influencer', mbasic: 'brand', mpro: 'brand' }

function env(name, fallback) {
  const value = process.env[name]?.trim() || fallback
  if (!value) {
    console.error(`Eksik ortam değişkeni: ${name}`)
    process.exit(1)
  }
  return value
}

const API_KEY = env('IYZICO_API_KEY')
const SECRET_KEY = env('IYZICO_SECRET_KEY')
const BASE_URL = env('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com').replace(/\/+$/, '')

// Fiyatlar tek kaynaktan: lib/spotlight-plans.ts içindeki SPOTLIGHT_PLAN_AMOUNTS.
function readAmounts() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const src = readFileSync(join(root, 'lib', 'spotlight-plans.ts'), 'utf8')
  const block = /SPOTLIGHT_PLAN_AMOUNTS[^=]*=\s*\{([\s\S]*?)\n\}/.exec(src)
  if (!block) throw new Error('SPOTLIGHT_PLAN_AMOUNTS bulunamadı.')
  const out = {}
  for (const m of block[1].matchAll(/(ibasic|ipro|mbasic|mpro):\s*\{\s*mo:\s*([\d.]+),\s*yr:\s*([\d.]+)\s*\}/g)) {
    out[m[1]] = { mo: Number(m[2]), yr: Number(m[3]) }
  }
  if (Object.keys(out).length !== 4) throw new Error('Dört planın fiyatı okunamadı.')
  return out
}

// Resmi SDK biçimi: 149 → "149.0".
function formatPrice(value) {
  const s = String(parseFloat(String(value)))
  return s.includes('.') ? s : `${s}.0`
}

function authHeaders(path, body) {
  const rnd = `${Date.now()}${randomInt(100_000_000, 999_999_999)}`
  const uriPath = path.split('?')[0]
  const signature = createHmac('sha256', SECRET_KEY).update(rnd + uriPath + body).digest('hex')
  const token = Buffer.from(`apiKey:${API_KEY}&randomKey:${rnd}&signature:${signature}`).toString('base64')
  return { Authorization: `IYZWSv2 ${token}`, 'x-iyzi-rnd': rnd }
}

async function call(method, path, payload) {
  const body = method === 'GET' || !payload ? '' : JSON.stringify(payload)
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...authHeaders(path, body) },
    body: body || undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (json.status !== 'success') throw new Error(`${method} ${path}: ${json.errorCode ?? res.status} ${json.errorMessage ?? ''}`)
  return json.data ?? json
}

async function listAll(path) {
  const items = []
  for (let page = 1; page <= 10; page++) {
    const data = await call('GET', `${path}${path.includes('?') ? '&' : '?'}page=${page}&count=100`)
    const batch = Array.isArray(data) ? data : data.items ?? []
    items.push(...batch)
    if (!batch.length || !data.pageCount || page >= data.pageCount) break
  }
  return items
}

async function main() {
  const amounts = readAmounts()
  console.log(`iyzico: ${BASE_URL}${dryRun ? ' (deneme: hiçbir şey oluşturulmaz)' : ''}`)
  console.log(`İndirimli plan yüzdeleri: ${DISCOUNTS.join(', ') || 'yok'}`)

  const products = await listAll('/v2/subscription/products')
  const report = { created: 0, existing: 0, mismatch: 0 }

  for (const [role, productName] of Object.entries(PRODUCT_NAMES)) {
    let product = products.find((p) => p.name === productName)
    if (!product) {
      console.log(`+ ürün: ${productName}`)
      if (!dryRun) product = await call('POST', '/v2/subscription/products', { locale: 'tr', conversationId: `product-${role}`, name: productName, description: 'Influmatch Spotlight aboneliği' })
      report.created++
    }
    const plans = product?.referenceCode ? await listAll(`/v2/subscription/products/${encodeURIComponent(product.referenceCode)}/pricing-plans`) : []

    for (const plan of Object.keys(PLAN_ROLE).filter((p) => PLAN_ROLE[p] === role)) {
      for (const interval of ['mo', 'yr']) {
        for (const pct of [null, ...DISCOUNTS]) {
          const name = `IM-${plan}-${interval}${pct ? `-D${pct}` : ''}`
          const base = amounts[plan][interval]
          const price = Math.round((pct ? (base * (100 - pct)) / 100 : base) * 100) / 100
          const existing = plans.find((p) => p.name === name)
          if (existing) {
            if (Math.abs(Number(existing.price) - price) > 0.009) {
              console.log(`! UYUŞMAZLIK: ${name} iyzico=${existing.price} beklenen=${price} (referans ${existing.referenceCode})`)
              report.mismatch++
            } else report.existing++
            continue
          }
          console.log(`+ plan: ${name} ${formatPrice(price)} TRY ${interval === 'yr' ? 'YEARLY' : 'MONTHLY'}`)
          report.created++
          if (dryRun || !product?.referenceCode) continue
          await call('POST', `/v2/subscription/products/${encodeURIComponent(product.referenceCode)}/pricing-plans`, {
            locale: 'tr',
            conversationId: name,
            name,
            price: formatPrice(price),
            currencyCode: 'TRY',
            paymentInterval: interval === 'yr' ? 'YEARLY' : 'MONTHLY',
            paymentIntervalCount: 1,
            planPaymentType: 'RECURRING',
          })
        }
      }
    }
  }
  console.log(`Bitti: ${report.created} yeni${dryRun ? ' (oluşturulmadı)' : ''}, ${report.existing} mevcut, ${report.mismatch} uyuşmazlık.`)
  if (report.mismatch) process.exitCode = 2
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
