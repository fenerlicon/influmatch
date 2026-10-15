// Yanıttan sonra arka planda iş (Vercel `waitUntil`). Next 14'te `after()` yok; Vercel çalışma ortamı istek bağlamını
// `globalThis[Symbol.for('@vercel/request-context')]` üzerinden verir (@vercel/functions paketinin `waitUntil`'i de bunu kullanır).
// Bağlam yoksa (yerel geliştirme, build) iş beklenerek çalıştırılır. İş fonksiyonun süre sınırı içinde kalmalı
// (Hobby: işi kendi süre bütçesiyle sınırla). Hata yanıtı bozmaz, yalnızca kayda yazılır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

type RequestContext = { waitUntil?: (promise: Promise<unknown>) => void }

function requestContext(): RequestContext | undefined {
  const holder = (globalThis as Record<symbol, unknown>)[Symbol.for('@vercel/request-context')] as { get?: () => RequestContext | undefined } | undefined
  try {
    return holder?.get?.()
  } catch {
    return undefined
  }
}

export async function runInBackground(label: string, task: () => Promise<unknown>): Promise<void> {
  const promise = Promise.resolve()
    .then(task)
    .catch((error) => console.error(`[background:${label}]`, error instanceof Error ? error.message : error))
  const ctx = requestContext()
  if (typeof ctx?.waitUntil === 'function') {
    ctx.waitUntil(promise)
    return
  }
  await promise
}
