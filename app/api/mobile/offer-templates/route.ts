import { getBearerContext, mobileJson } from '@/lib/mobile-auth'
import { deleteOfferTemplateAs, lastOfferDraftAs, listOfferTemplatesAs, saveOfferTemplateAs } from '@/lib/offer-templates'

export const dynamic = 'force-dynamic'

/** Markanın teklif şablonları ve son teklif taslağı: { templates, lastOffer }. Yalnızca marka. */
export async function GET(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const list = await listOfferTemplatesAs(ctx.supabase, ctx.user.id)
  if (!list.success) return mobileJson({ error: list.error }, 403)
  const last = await lastOfferDraftAs(ctx.supabase, ctx.user.id)
  return mobileJson({ templates: list.templates, lastOffer: last.success ? last.draft : null })
}

/** Şablon kaydeder (id verilirse günceller). Gövde: { id?, name, campaignName, campaignType?, budget?, paymentType?, message? } */
export async function POST(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return mobileJson({ error: 'Geçersiz istek.' }, 400)

  const result = await saveOfferTemplateAs(ctx.supabase, ctx.user.id, {
    id: typeof body.id === 'string' ? body.id : null,
    name: typeof body.name === 'string' ? body.name : '',
    campaignName: typeof body.campaignName === 'string' ? body.campaignName : '',
    campaignType: typeof body.campaignType === 'string' ? body.campaignType : null,
    budget: typeof body.budget === 'string' || typeof body.budget === 'number' ? body.budget : null,
    paymentType: body.paymentType === 'barter' ? 'barter' : 'cash',
    message: typeof body.message === 'string' ? body.message : null,
  })
  return mobileJson(result, result.success ? 200 : 400)
}

/** Şablon siler: ?id= */
export async function DELETE(request: Request) {
  const ctx = await getBearerContext(request)
  if (!ctx) return mobileJson({ error: 'Oturum gerekli.' }, 401)

  const id = new URL(request.url).searchParams.get('id') ?? ''
  const result = await deleteOfferTemplateAs(ctx.supabase, ctx.user.id, id)
  return mobileJson(result, result.success ? 200 : 400)
}
