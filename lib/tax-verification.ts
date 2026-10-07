// Vergi levhası doğrulama süreci: PDF metnini SUNUCUDA okur (hiçbir dış servise / yapay zekaya
// gönderilmez), profildeki bilgilerle karşılaştırır, sonucu tax_verifications tablosuna yazar ve
// tüm kontroller geçerse vergi numarasını otomatik onaylar.
//
// Fotoğraf ve taranmış belgeler otomatik okunmaz; doğrudan admin incelemesine düşer.
// Otomatik onay TAX_AUTO_APPROVE=false ortam değişkeniyle kapatılabilir.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'
import { extractText, getDocumentProxy, getMeta } from 'unpdf'
import {
  compareTaxCertificate,
  parseTaxCertificateText,
  type ExtractedTaxCertificate,
  type TaxDecision,
} from '@/lib/tax-certificate-match'

export const TAX_DOCUMENTS_BUCKET = 'tax-documents'
export const MAX_TAX_DOCUMENT_BYTES = 5 * 1024 * 1024
export const MAX_SUBMISSIONS_PER_DAY = 5
const PARSER_VERSION = 'local-pdf-v1'
const OFFICIAL_BADGE = 'official-business'
const MAX_DISPLAYED_BADGES = 3

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function isAutoApproveEnabled() {
  return process.env.TAX_AUTO_APPROVE?.trim().toLowerCase() !== 'false'
}

export function guessMimeType(path: string, blobType?: string | null) {
  if (blobType && Object.values(MIME_BY_EXTENSION).includes(blobType)) return blobType
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXTENSION[extension] ?? null
}

/** PDF metnini ve üretici bilgisini sunucuda çıkarır. */
export async function readPdf(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes)
  const [{ text }, { info }] = await Promise.all([extractText(pdf, { mergePages: true }), getMeta(pdf)])
  const meta = (info ?? {}) as Record<string, unknown>
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  return { text: Array.isArray(text) ? text.join('\n') : text, producer: str(meta.Producer), creator: str(meta.Creator) }
}

const EMPTY_EXTRACTION: ExtractedTaxCertificate = {
  has_text: false,
  is_tax_certificate: false,
  tax_numbers: [],
  approval_code: null,
  year: null,
  pdf_producer: null,
  suspicious_signs: [],
}

/** Vergi numarasını onaylar ve Resmi İşletme (sarı tik) rozetini vitrinin başına ekler. */
export async function grantOfficialBusiness(admin: SupabaseClient, userId: string, extra: Record<string, unknown> = {}) {
  const { data: profile } = await admin.from('users').select('displayed_badges').eq('id', userId).maybeSingle()
  const displayed = ((profile?.displayed_badges as string[] | null) ?? []).filter((badge) => badge !== OFFICIAL_BADGE)

  const { error: updateError } = await admin
    .from('users')
    .update({ ...extra, tax_id_verified: true, displayed_badges: [OFFICIAL_BADGE, ...displayed].slice(0, MAX_DISPLAYED_BADGES) })
    .eq('id', userId)
  if (updateError) throw new Error(`Vergi numarası onaylanamadı: ${updateError.message}`)

  const { error: badgeError } = await admin
    .from('user_badges')
    .upsert({ user_id: userId, badge_id: OFFICIAL_BADGE, earned_at: new Date().toISOString() }, { onConflict: 'user_id,badge_id' })
  if (badgeError) throw new Error(`Resmi İşletme rozeti verilemedi: ${badgeError.message}`)
}

export interface TaxVerificationOutcome {
  id: string
  status: TaxDecision
  reasons: string[]
}

/**
 * Yüklenmiş bir vergi levhasını işler. Çağıran taraf kullanıcının yetkisini ve dosya yolunun
 * kullanıcıya ait olduğunu kontrol etmiş olmalıdır.
 */
export async function processTaxCertificate(admin: SupabaseClient, userId: string, filePath: string): Promise<TaxVerificationOutcome> {
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('tax_id, company_legal_name, tax_office, tax_office_city')
    .eq('id', userId)
    .single()
  if (profileError || !profile) throw new Error('Profil bulunamadı.')

  const { data: blob, error: downloadError } = await admin.storage.from(TAX_DOCUMENTS_BUCKET).download(filePath)
  if (downloadError || !blob) throw new Error('Yüklenen belge okunamadı. Lütfen tekrar yükleyin.')
  if (blob.size > MAX_TAX_DOCUMENT_BYTES) throw new Error('Belge en fazla 5 MB olabilir.')
  const mimeType = guessMimeType(filePath, blob.type)
  if (!mimeType) throw new Error('Sadece PDF, JPG, PNG veya WEBP yükleyebilirsiniz.')

  const { data: row, error: insertError } = await admin
    .from('tax_verifications')
    .insert({
      user_id: userId,
      file_path: filePath,
      file_type: mimeType,
      status: 'processing',
      submitted_tax_id: profile.tax_id,
      submitted_legal_name: profile.company_legal_name,
      submitted_tax_office: profile.tax_office,
      submitted_city: profile.tax_office_city,
      model: PARSER_VERSION,
    })
    .select('id')
    .single()
  if (insertError || !row) throw new Error(`Doğrulama kaydı oluşturulamadı: ${insertError?.message ?? ''}`)

  const finish = async (status: TaxDecision, fields: Record<string, unknown>) => {
    const { error } = await admin
      .from('tax_verifications')
      .update({ ...fields, status, updated_at: new Date().toISOString() })
      .eq('id', row.id)
    if (error) console.error('[tax-verification] Sonuç kaydedilemedi:', error.message)
  }

  const currentYear = Number(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric' }))

  let extracted = EMPTY_EXTRACTION
  let documentText = ''
  if (mimeType === 'application/pdf') {
    try {
      const pdf = await readPdf(new Uint8Array(await blob.arrayBuffer()))
      documentText = pdf.text
      extracted = parseTaxCertificateText(pdf.text, pdf, currentYear)
    } catch (error) {
      // Bozuk / şifreli PDF: belge kaybolmaz, admin elle inceler.
      console.error('[tax-verification] PDF okunamadı:', error)
      const reasons = ['PDF otomatik okunamadı (bozuk veya şifreli olabilir); ekibimiz inceleyecek.']
      await finish('needs_review', { reasons })
      return { id: row.id, status: 'needs_review', reasons }
    }
  }

  const result = compareTaxCertificate(extracted, documentText, profile, currentYear)
  let status: TaxDecision = result.decision
  const reasons = [...result.reasons]

  if (status === 'auto_approved' && !isAutoApproveEnabled()) {
    status = 'needs_review'
    reasons.push('Tüm kontroller geçti; otomatik onay kapalı olduğu için admin onayı bekleniyor.')
  }

  if (status === 'auto_approved') {
    try {
      await grantOfficialBusiness(admin, userId)
    } catch (error) {
      console.error('[tax-verification] Otomatik onay uygulanamadı:', error)
      status = 'needs_review'
      reasons.push('Kontroller geçti ancak onay kaydedilemedi; admin onayı bekleniyor.')
    }
  }

  await finish(status, { extracted, checks: result.checks, reasons })
  return { id: row.id, status, reasons }
}

export interface AdminTaxVerification {
  id: string
  status: 'processing' | 'auto_approved' | 'needs_review' | 'approved' | 'rejected'
  reasons: string[]
  extracted: ExtractedTaxCertificate | null
  checks: { key: string; label: string; passed: boolean; detail: string }[] | null
  review_note: string | null
  created_at: string
}

/** Admin ekranı için her kullanıcının en son vergi levhası doğrulaması. */
export async function loadLatestTaxVerifications(admin: SupabaseClient, userIds: string[]) {
  const latest: Record<string, AdminTaxVerification> = {}
  for (let i = 0; i < userIds.length; i += 200) {
    const { data, error } = await admin
      .from('tax_verifications')
      .select('id, user_id, status, reasons, extracted, checks, review_note, created_at')
      .in('user_id', userIds.slice(i, i + 200))
      .order('created_at', { ascending: false })
    if (error) {
      // Tablo henüz yoksa (migration çalışmadıysa) admin ekranı yine açılır.
      console.error('[tax-verification] Doğrulamalar okunamadı:', error.message)
      return latest
    }
    for (const { user_id, ...row } of data ?? []) {
      if (!latest[user_id as string]) latest[user_id as string] = row as AdminTaxVerification
    }
  }
  return latest
}
