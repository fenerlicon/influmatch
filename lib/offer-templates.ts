// Teklif şablonları (yol haritası, 2026-10-10): marka bir teklifi şablon olarak kaydeder, teklif formunda
// şablon seçer ya da son teklifini kopyalayıp başka bir influencer'a gönderir.
//
// Tablo `offer_templates` istemcilere yalnızca okunur (RLS: yalnızca sahibi). Yazımlar burada, rol ve
// sahiplik kontrolünden sonra service role ile yapılır (collaborations / rate_cards ile aynı desen).
// Web sunucu aksiyonları ve mobil uç (/api/mobile/offer-templates) aynı fonksiyonları çağırır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { fetchAccountRole } from '@/lib/viewer-role'
import { validateOfferFields } from '@/lib/offers'
import { OFFER_TEMPLATE_LIMIT } from '@/lib/offer-shared'

// eslint-disable-next-line @typescript-eslint/ban-types
type Result<T = {}> = ({ success: true; error?: undefined } & T) | { error: string; success?: undefined }

export interface OfferTemplate {
  id: string
  name: string
  campaign_name: string
  campaign_type: string | null
  budget: number | null
  payment_type: 'cash' | 'barter'
  message: string | null
  updated_at: string
}

/** Forma doldurulacak taslak (şablon ya da son teklif). */
export interface OfferDraft {
  campaign_name: string
  campaign_type: string | null
  budget: number | null
  payment_type: 'cash' | 'barter'
  message: string | null
}

export interface SaveOfferTemplateInput {
  id?: string | null
  name?: string | null
  campaignName?: string | null
  campaignType?: string | null
  budget?: string | number | null
  paymentType?: 'cash' | 'barter' | null
  message?: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const TEMPLATE_COLUMNS = 'id, name, campaign_name, campaign_type, budget, payment_type, message, updated_at'

async function requireBrand(supabase: SupabaseClient, userId: string): Promise<string | null> {
  return (await fetchAccountRole(supabase, userId)) === 'brand' ? null : 'Teklif şablonlarını yalnızca marka hesapları kullanabilir.'
}

export async function listOfferTemplatesAs(supabase: SupabaseClient, userId: string): Promise<Result<{ templates: OfferTemplate[] }>> {
  const roleError = await requireBrand(supabase, userId)
  if (roleError) return { error: roleError }
  const { data, error } = await supabase
    .from('offer_templates')
    .select(TEMPLATE_COLUMNS)
    .eq('brand_id', userId)
    .order('updated_at', { ascending: false })
    .limit(OFFER_TEMPLATE_LIMIT)
  if (error) {
    console.error('[offer-templates] list error', error.message)
    return { error: 'Şablonlar yüklenemedi.' }
  }
  return { success: true, templates: (data ?? []) as OfferTemplate[] }
}

export async function saveOfferTemplateAs(
  supabase: SupabaseClient,
  userId: string,
  input: SaveOfferTemplateInput,
): Promise<Result<{ template: OfferTemplate }>> {
  const roleError = await requireBrand(supabase, userId)
  if (roleError) return { error: roleError }

  if (input.id && !UUID_RE.test(String(input.id))) return { error: 'Şablon bulunamadı.' }
  const name = input.name?.toString().trim() ?? ''
  if (!name || name.length > 60) return { error: 'Şablon adı 1-60 karakter olmalı.' }

  const fields = validateOfferFields({
    campaignName: input.campaignName ?? '',
    campaignType: input.campaignType,
    budget: input.budget,
    paymentType: input.paymentType,
    message: input.message,
  })
  if ('error' in fields) return { error: fields.error }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }

  const row = {
    brand_id: userId,
    name,
    campaign_name: fields.campaignName,
    campaign_type: fields.campaignType,
    budget: fields.budgetValue,
    payment_type: fields.paymentType,
    message: fields.message,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data, error } = await admin
      .from('offer_templates')
      .update(row)
      .eq('id', input.id)
      .eq('brand_id', userId)
      .select(TEMPLATE_COLUMNS)
    if (error) {
      console.error('[offer-templates] update error', error.message)
      return { error: error.code === '23505' ? 'Bu adla bir şablonunuz zaten var.' : 'Şablon kaydedilemedi.' }
    }
    if (!data?.length) return { error: 'Şablon bulunamadı.' }
    return { success: true, template: data[0] as OfferTemplate }
  }

  const { count, error: countError } = await admin
    .from('offer_templates')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', userId)
  if (countError) return { error: 'Şablon kaydedilemedi.' }
  if ((count ?? 0) >= OFFER_TEMPLATE_LIMIT) {
    return { error: `En fazla ${OFFER_TEMPLATE_LIMIT} şablon kaydedebilirsiniz. Yenisi için birini silin.` }
  }

  const { data, error } = await admin.from('offer_templates').insert(row).select(TEMPLATE_COLUMNS).single()
  if (error || !data) {
    console.error('[offer-templates] insert error', error?.message)
    return { error: error?.code === '23505' ? 'Bu adla bir şablonunuz zaten var.' : 'Şablon kaydedilemedi.' }
  }
  return { success: true, template: data as OfferTemplate }
}

export async function deleteOfferTemplateAs(supabase: SupabaseClient, userId: string, templateId: string): Promise<Result> {
  const roleError = await requireBrand(supabase, userId)
  if (roleError) return { error: roleError }
  if (!templateId || !UUID_RE.test(templateId)) return { error: 'Şablon bulunamadı.' }
  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası.' }
  const { data, error } = await admin.from('offer_templates').delete().eq('id', templateId).eq('brand_id', userId).select('id')
  if (error) {
    console.error('[offer-templates] delete error', error.message)
    return { error: 'Şablon silinemedi.' }
  }
  if (!data?.length) return { error: 'Şablon bulunamadı.' }
  return { success: true }
}

/** Markanın en son gönderdiği teklif (formu doldurmak için); hiç yoksa null. */
export async function lastOfferDraftAs(supabase: SupabaseClient, userId: string): Promise<Result<{ draft: OfferDraft | null }>> {
  const roleError = await requireBrand(supabase, userId)
  if (roleError) return { error: roleError }
  const { data, error } = await supabase
    .from('offers')
    .select('campaign_name, campaign_type, budget, payment_type, message')
    .eq('sender_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.error('[offer-templates] last offer error', error.message)
    return { error: 'Son teklif okunamadı.' }
  }
  if (!data) return { success: true, draft: null }
  return {
    success: true,
    draft: {
      campaign_name: (data.campaign_name as string | null) ?? '',
      campaign_type: (data.campaign_type as string | null) ?? null,
      budget: data.budget === null || data.budget === undefined ? null : Number(data.budget),
      payment_type: data.payment_type === 'barter' ? 'barter' : 'cash',
      message: (data.message as string | null) ?? null,
    },
  }
}
