// Vergi levhasından okunan bilgilerin profildeki vergi bilgileriyle karşılaştırılması.
//
// Karar burada, deterministik kurallarla verilir; yapay zeka sadece belgeyi okur.
// Otomatik onay için TÜM kontrollerin geçmesi gerekir; belirsiz her durum admin incelemesine düşer.

import { normalizeTaxNumber, validateTaxNumber } from '@/lib/tax-id'

export interface ExtractedTaxCertificate {
  is_tax_certificate: boolean
  legibility: 'clear' | 'partial' | 'unreadable'
  tax_number: string | null
  taxpayer_name: string | null
  tax_office: string | null
  city: string | null
  year: number | null
  approval_code: string | null
  suspicious_signs: string[]
}

export interface TaxProfile {
  tax_id: string | null
  company_legal_name: string | null
  tax_office: string | null
  tax_office_city: string | null
}

export type TaxCheckKey = 'document' | 'tax_number' | 'name' | 'tax_office' | 'city' | 'year' | 'integrity'

export interface TaxCheck {
  key: TaxCheckKey
  label: string
  passed: boolean
  detail: string
}

export type TaxDecision = 'auto_approved' | 'needs_review' | 'rejected'

export interface TaxMatchResult {
  decision: TaxDecision
  checks: TaxCheck[]
  reasons: string[]
  /** Profilde unvan boşsa levhadan okunan unvan önerilir. */
  legalNameFromCertificate: string | null
}

/** Levha yılı en fazla bu kadar eski olabilir (yıllık yenilenir). */
export const MAX_CERTIFICATE_AGE_YEARS = 2
export const NAME_SIMILARITY_THRESHOLD = 0.6

const LEGAL_FORM_WORDS = new Set([
  'anonim', 'sirketi', 'sirket', 'as', 'a', 's', 'limited', 'ltd', 'sti', 'ticaret', 'tic', 'sanayi', 'san', 've',
  'pazarlama', 'paz', 'ithalat', 'ihracat', 'ith', 'ihr', 'dis', 'ic', 'hizmetleri', 'hiz', 'tur', 'turizm',
  'insaat', 'ins', 'gida', 'tekstil', 'teks', 'kollektif', 'komandit', 'koop', 'kooperatifi',
])

const OFFICE_WORDS = new Set(['vergi', 'dairesi', 'daire', 'vd', 'mudurlugu', 'mal', 'malmudurlugu', 'baskanligi', 'mudurluk'])

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir ("İSTANBUL Ş." -> "istanbul s"). */
export function foldTurkish(value: string): string {
  return value
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value: string, stopWords: Set<string>): string[] {
  return foldTurkish(value).split(' ').filter((token) => token && !stopWords.has(token))
}

/** Sırasız kelime benzerliği (Dice katsayısı, 0-1). Şirket türü kelimeleri (A.Ş., Ltd. Şti. ...) yok sayılır. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(tokens(a, LEGAL_FORM_WORDS))
  const tb = new Set(tokens(b, LEGAL_FORM_WORDS))
  if (ta.size === 0 || tb.size === 0) return 0
  let common = 0
  ta.forEach((token) => {
    if (tb.has(token)) common++
  })
  return (2 * common) / (ta.size + tb.size)
}

export function sameTaxOffice(a: string, b: string): boolean {
  const ta = tokens(a, OFFICE_WORDS).join(' ')
  const tb = tokens(b, OFFICE_WORDS).join(' ')
  if (!ta || !tb) return false
  return ta === tb || ta.includes(tb) || tb.includes(ta)
}

export function compareTaxCertificate(
  extracted: ExtractedTaxCertificate,
  profile: TaxProfile,
  currentYear: number,
): TaxMatchResult {
  const checks: TaxCheck[] = []
  const add = (key: TaxCheckKey, label: string, passed: boolean, detail: string) => checks.push({ key, label, passed, detail })
  const FAILURE_TEXT: Record<TaxCheckKey, string> = {
    document: 'Belge tam okunamadı',
    tax_number: 'Vergi numarası profildekiyle eşleşmiyor',
    name: 'Unvan profildekiyle eşleşmiyor',
    tax_office: 'Vergi dairesi profildekiyle eşleşmiyor',
    city: 'İl profildekiyle eşleşmiyor',
    year: 'Levha güncel değil',
    integrity: 'Belgede değişiklik izi olabilir',
  }

  const isDocument = extracted.is_tax_certificate && extracted.legibility !== 'unreadable'
  add(
    'document',
    'Belge okunabilir bir vergi levhası',
    isDocument && extracted.legibility === 'clear',
    !extracted.is_tax_certificate
      ? 'Belge vergi levhası olarak tanınmadı'
      : extracted.legibility === 'clear'
        ? 'Vergi levhası tanındı'
        : 'Belge kısmen okunabiliyor',
  )

  // Belge hiç vergi levhası değilse veya okunamıyorsa diğer kontroller anlamsızdır.
  if (!isDocument) {
    return {
      decision: 'rejected',
      checks,
      reasons: [
        extracted.is_tax_certificate
          ? 'Belge okunamadı. Lütfen net bir fotoğraf veya e-Devlet / GİB üzerinden indirilen PDF yükleyin.'
          : 'Yüklenen belge vergi levhası olarak tanınmadı.',
      ],
      legalNameFromCertificate: null,
    }
  }

  const extractedNumber = extracted.tax_number ? normalizeTaxNumber(extracted.tax_number) : ''
  const profileNumber = profile.tax_id ? normalizeTaxNumber(profile.tax_id) : ''
  add(
    'tax_number',
    'Vergi numarası profildekiyle aynı',
    !!extractedNumber && extractedNumber === profileNumber && validateTaxNumber(extractedNumber).isValid,
    extractedNumber ? `Levhada: ${extractedNumber}` : 'Levhada vergi numarası okunamadı',
  )

  let legalNameFromCertificate: string | null = null
  if (profile.company_legal_name?.trim()) {
    const similarity = extracted.taxpayer_name ? nameSimilarity(extracted.taxpayer_name, profile.company_legal_name) : 0
    add(
      'name',
      'Unvan profildekiyle uyumlu',
      similarity >= NAME_SIMILARITY_THRESHOLD,
      extracted.taxpayer_name ? `Levhada: ${extracted.taxpayer_name}` : 'Levhada unvan okunamadı',
    )
  } else {
    legalNameFromCertificate = extracted.taxpayer_name?.trim() || null
    add(
      'name',
      'Unvan',
      !!legalNameFromCertificate,
      legalNameFromCertificate ? `Profilde unvan yok; levhadan alınacak: ${legalNameFromCertificate}` : 'Levhada unvan okunamadı',
    )
  }

  add(
    'tax_office',
    'Vergi dairesi profildekiyle aynı',
    !!extracted.tax_office && !!profile.tax_office && sameTaxOffice(extracted.tax_office, profile.tax_office),
    extracted.tax_office ? `Levhada: ${extracted.tax_office}` : 'Levhada vergi dairesi okunamadı',
  )

  // İl her levhada açıkça yazmayabilir; yazıyorsa tutmalıdır.
  const cityMatches = !extracted.city || !profile.tax_office_city || foldTurkish(extracted.city) === foldTurkish(profile.tax_office_city)
  add('city', 'İl profildekiyle aynı', cityMatches, extracted.city ? `Levhada: ${extracted.city}` : 'Levhada il belirtilmemiş')

  const recent = !!extracted.year && extracted.year >= currentYear - MAX_CERTIFICATE_AGE_YEARS && extracted.year <= currentYear
  add('year', 'Levha güncel', recent, extracted.year ? `Levha yılı: ${extracted.year}` : 'Levha yılı okunamadı')

  const clean = extracted.suspicious_signs.length === 0
  add('integrity', 'Belgede değişiklik izi yok', clean, clean ? 'Şüpheli iz bulunmadı' : extracted.suspicious_signs.join('; '))

  const failed = checks.filter((check) => !check.passed)
  return {
    decision: failed.length === 0 ? 'auto_approved' : 'needs_review',
    checks,
    reasons: failed.map((check) => `${FAILURE_TEXT[check.key]} (${check.detail})`),
    legalNameFromCertificate,
  }
}
