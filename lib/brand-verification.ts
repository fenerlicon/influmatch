// Marka doğrulamasının ortak çekirdeği: kurumsal kimlik (unvan, vergi no, daire, il), vergi levhası ve
// kurumsal e-posta durumu. Web sunucu aksiyonları ve mobil uç (/api/mobile/brand-verification) aynı fonksiyonları çağırır.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır. Çağıran taraf kullanıcıyı doğrular.
// Vergi belgeleri yalnızca kendi sunucumuzda işlenir; hiçbir dış servise gönderilmez (CLAUDE.md kural 1).

import type { SupabaseClient } from '@supabase/supabase-js'
import { validateTaxNumber } from '@/lib/tax-id'
import { MAX_SUBMISSIONS_PER_DAY, processTaxCertificate } from '@/lib/tax-verification'

export interface BrandIdentityInput {
  companyLegalName?: string | null
  taxId?: string | null
  taxOffice?: string | null
  taxOfficeCity?: string | null
}

export type TaxSubmitResult =
  | { success: true; status: 'auto_approved' | 'needs_review' | 'rejected'; reasons: string[] }
  | { success: false; error: string }

/** Kurumsal kimlik alanlarının kuralları (web profil formuyla aynı). Geçerliyse yazılacak değerleri döner. */
export function normalizeBrandIdentity(input: BrandIdentityInput):
  | {
      ok: true
      values: { company_legal_name: string | null; tax_id: string | null; tax_office: string | null; tax_office_city: string | null }
    }
  | { ok: false; error: string } {
  let taxId: string | null = null
  if (input.taxId?.trim()) {
    const validation = validateTaxNumber(input.taxId)
    if (!validation.isValid) return { ok: false, error: validation.error }
    taxId = validation.normalized
    if (!input.taxOffice?.trim()) return { ok: false, error: 'Vergi numarası girildiğinde vergi dairesi girmek zorunludur.' }
    if (!input.taxOfficeCity?.trim()) return { ok: false, error: 'Vergi numarası girildiğinde şirketin bağlı olduğu il seçilmelidir.' }
  }
  const legalName = input.companyLegalName?.trim() || null
  if (legalName && legalName.length > 200) return { ok: false, error: 'Resmi unvan en fazla 200 karakter olabilir.' }
  return {
    ok: true,
    values: {
      company_legal_name: legalName,
      tax_id: taxId,
      tax_office: input.taxOffice?.trim() || null,
      tax_office_city: input.taxOfficeCity?.trim() || null,
    },
  }
}

/** Markanın kurumsal kimlik bilgilerini kaydeder. Onaylı marka değiştirirse onayı veritabanı tetikleyicisi düşürür. */
export async function saveBrandIdentityAs(
  supabase: SupabaseClient,
  userId: string,
  input: BrandIdentityInput,
): Promise<{ success: true } | { success: false; error: string }> {
  const { data: profile } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
  if (profile?.role !== 'brand') return { success: false, error: 'Bu işlem sadece markalar içindir.' }

  const normalized = normalizeBrandIdentity(input)
  if (!normalized.ok) return { success: false, error: normalized.error }

  const { error } = await supabase.from('users').update(normalized.values).eq('id', userId)
  if (error) {
    console.error('[saveBrandIdentity]', error.message)
    return { success: false, error: 'Kurumsal bilgiler kaydedilemedi. Lütfen tekrar deneyin.' }
  }
  return { success: true }
}

/**
 * Marka, vergi levhasını tax-documents/{userId}/... yoluna yükledikten sonra çağrılır.
 * admin: service role istemcisi (belgeyi okuyup sonucu yazmak için).
 */
export async function submitTaxCertificateAs(admin: SupabaseClient, userId: string, filePath: string): Promise<TaxSubmitResult> {
  // Dosya sadece kullanıcının kendi klasöründe olabilir (depolama politikası da bunu zorlar).
  const parts = typeof filePath === 'string' ? filePath.split('/') : []
  if (parts.length !== 2 || parts[0] !== userId || !parts[1] || parts[1].startsWith('.')) {
    return { success: false, error: 'Geçersiz dosya.' }
  }

  const { data: profile } = await admin
    .from('users')
    .select('role, tax_id, tax_office, tax_office_city, company_legal_name, tax_id_verified')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.role !== 'brand') return { success: false, error: 'Bu işlem sadece markalar içindir.' }
  if (profile.tax_id_verified) return { success: false, error: 'Vergi numaranız zaten doğrulanmış.' }
  if (
    !profile.tax_id ||
    !validateTaxNumber(profile.tax_id).isValid ||
    !profile.tax_office ||
    !profile.tax_office_city ||
    !profile.company_legal_name?.trim()
  ) {
    return { success: false, error: 'Önce Kurumsal Kimlik bölümünde resmi unvan, vergi numarası, vergi dairesi ve ili kaydedin.' }
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('tax_verifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_SUBMISSIONS_PER_DAY) {
    return { success: false, error: `Günde en fazla ${MAX_SUBMISSIONS_PER_DAY} belge yükleyebilirsiniz. Lütfen yarın tekrar deneyin.` }
  }

  try {
    const outcome = await processTaxCertificate(admin, userId, filePath)
    return { success: true, status: outcome.status, reasons: outcome.reasons }
  } catch (error) {
    console.error('[submitTaxCertificate]', error)
    return { success: false, error: error instanceof Error ? error.message : 'Belge işlenemedi.' }
  }
}

export interface BrandVerificationState {
  role: string | null
  verificationStatus: string | null
  companyLegalName: string
  taxId: string
  taxOffice: string
  taxOfficeCity: string
  taxIdVerified: boolean
  website: string
  corporateEmail: string | null
  corporateEmailVerified: boolean
  latestTaxVerification: { status: string; reasons: string[] | null; created_at: string } | null
}

/** Doğrulama ekranının ihtiyaç duyduğu durum. Gizli kolonlar yalnızca sahibi için, sunucuda okunur. */
export async function loadBrandVerificationState(admin: SupabaseClient, userId: string): Promise<BrandVerificationState | null> {
  const [{ data: user }, { data: latest }] = await Promise.all([
    admin
      .from('users')
      .select(
        'role, verification_status, company_legal_name, tax_id, tax_office, tax_office_city, tax_id_verified, social_links, corporate_email, corporate_email_verified_at',
      )
      .eq('id', userId)
      .maybeSingle(),
    admin
      .from('tax_verifications')
      .select('status, reasons, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (!user) return null
  const links = (user.social_links as Record<string, string | null> | null) ?? {}
  return {
    role: user.role ?? null,
    verificationStatus: user.verification_status ?? null,
    companyLegalName: user.company_legal_name ?? '',
    taxId: user.tax_id ?? '',
    taxOffice: user.tax_office ?? '',
    taxOfficeCity: user.tax_office_city ?? '',
    taxIdVerified: !!user.tax_id_verified,
    website: links.website ?? '',
    corporateEmail: user.corporate_email ?? null,
    corporateEmailVerified: !!user.corporate_email_verified_at,
    latestTaxVerification: (latest as BrandVerificationState['latestTaxVerification']) ?? null,
  }
}
