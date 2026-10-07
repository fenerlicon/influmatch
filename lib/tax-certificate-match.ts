// Vergi levhası PDF metninin profildeki vergi bilgileriyle karşılaştırılması.
//
// Belge hiçbir dış servise gönderilmez: metin sunucuda PDF'ten çıkarılır (lib/tax-verification.ts)
// ve burada deterministik kurallarla değerlendirilir. GİB e-vergi levhalarında etiketler ve
// değerler metinde ayrı bloklar halinde gelebildiği için "etiketin yanındaki değeri oku" yerine
// "profildeki bilgi belgede geçiyor mu" yaklaşımı kullanılır.
//
// Otomatik onay için TÜM kontrollerin geçmesi gerekir; belirsiz her durum admin incelemesine düşer.

import { normalizeTaxNumber, validateTaxNumber } from '@/lib/tax-id'

export interface ExtractedTaxCertificate {
  /** Belgede okunabilir metin katmanı var mı (fotoğraf / tarama değil) */
  has_text: boolean
  is_tax_certificate: boolean
  /** Belgede geçen geçerli VKN / TCKN'ler */
  tax_numbers: string[]
  approval_code: string | null
  /** Belgede geçen en yeni yıl */
  year: number | null
  pdf_producer: string | null
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
}

/** Levhadaki en yeni yıl en fazla bu kadar eski olabilir (levha yıllık yenilenir). */
export const MAX_CERTIFICATE_AGE_YEARS = 2
/** Unvandaki anlamlı kelimelerin en az bu oranı belgede geçmeli. */
export const NAME_COVERAGE_THRESHOLD = 0.8
const MIN_TEXT_LENGTH = 40

/** Şirket türü kelimeleri: unvan karşılaştırmasında yok sayılır. */
const LEGAL_FORM_WORDS = new Set([
  'anonim', 'sirketi', 'sirket', 'as', 'a', 's', 'limited', 'ltd', 'sti', 've', 'kollektif', 'komandit', 'koop', 'kooperatifi',
])
const OFFICE_WORDS = new Set(['vergi', 'dairesi', 'daire', 'vd', 'v', 'd', 'mudurlugu', 'mal', 'malmudurlugu', 'baskanligi'])

/** PDF düzenleme / tasarım programları: GİB sisteminden çıkan bir levha bunlarla üretilmez. */
const EDITOR_PATTERN =
  /word|excel|libreoffice|openoffice|photoshop|illustrator|canva|ilovepdf|smallpdf|sejda|pdfescape|pdf ?candy|pdf24|nitro|foxit ?phantom|acrobat (pro|standard)|google docs|pages|keynote|inkscape|gimp|paint|pdf ?editor|pdffiller|docusign/i

/**
 * GİB PDF'lerinde Türkçe harfler Windows-1252 kodlamasıyla çıkabilir ("VERGÝ", "ÝÞ YERÝ").
 * Bu harfleri doğru Türkçe karşılıklarına çevirir.
 */
export function repairTurkishMojibake(value: string): string {
  return value.replace(/Ý/g, 'İ').replace(/ý/g, 'ı').replace(/Þ/g, 'Ş').replace(/þ/g, 'ş').replace(/Ð/g, 'Ğ').replace(/ð/g, 'ğ')
}

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir ("İSTANBUL Ş." -> "istanbul s"). */
export function foldTurkish(value: string): string {
  return repairTurkishMojibake(value)
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function significantTokens(value: string, stopWords: Set<string>): string[] {
  return Array.from(new Set(foldTurkish(value).split(' ').filter((token) => token && !stopWords.has(token))))
}

/**
 * Kelimelerin belgede geçme oranı (0-1). 3 harf ve üzeri kelimeler önek olarak eşleşir;
 * böylece "San." / "Tic." gibi kısaltmalar "SANAYİ" / "TİCARET" ile eşleşir.
 */
export function tokenCoverage(value: string, documentTokens: Set<string>, stopWords: Set<string> = LEGAL_FORM_WORDS): number {
  const wanted = significantTokens(value, stopWords)
  if (wanted.length === 0) return 0
  const docList = Array.from(documentTokens)
  const found = wanted.filter((token) =>
    documentTokens.has(token) || (token.length >= 3 && docList.some((docToken) => docToken.startsWith(token))),
  )
  return found.length / wanted.length
}

/** PDF metninden kontrol için gereken alanları çıkarır (metnin kendisi saklanmaz). */
export function parseTaxCertificateText(rawText: string, meta: { producer?: string | null; creator?: string | null }, currentYear: number): ExtractedTaxCertificate {
  const text = repairTurkishMojibake(rawText)
  const folded = foldTurkish(text)
  const has_text = folded.replace(/\s/g, '').length >= MIN_TEXT_LENGTH

  const is_tax_certificate =
    folded.includes('vergi levhasi') && folded.includes('vergi dairesi') && (folded.includes('kimlik no') || folded.includes('onay kodu'))

  const tax_numbers = Array.from(new Set(text.match(/(?<!\d)\d{10,11}(?!\d)/g) ?? [])).filter((n) => validateTaxNumber(n).isValid)

  const approvalMatch = text.match(/ONAY\s*KODU\s*[:：]?\s*([A-Z0-9]{8,32})/i)
  const approval_code = approvalMatch ? approvalMatch[1].toUpperCase() : null

  const years = (text.match(/(?<!\d)(19|20)\d{2}(?!\d)/g) ?? []).map(Number).filter((y) => y >= 2000 && y <= currentYear)
  const year = years.length ? Math.max(...years) : null

  const pdf_producer = [meta.producer, meta.creator].filter(Boolean).join(' / ') || null
  const suspicious_signs: string[] = []
  if (pdf_producer && EDITOR_PATTERN.test(pdf_producer)) {
    suspicious_signs.push(`PDF bir düzenleme / tasarım programıyla oluşturulmuş: ${pdf_producer}`)
  }

  return { has_text, is_tax_certificate, tax_numbers, approval_code, year, pdf_producer, suspicious_signs }
}

export function compareTaxCertificate(
  extracted: ExtractedTaxCertificate,
  documentText: string,
  profile: TaxProfile,
  currentYear: number,
): TaxMatchResult {
  const checks: TaxCheck[] = []
  const add = (key: TaxCheckKey, label: string, passed: boolean, detail: string) => checks.push({ key, label, passed, detail })
  const FAILURE_TEXT: Record<TaxCheckKey, string> = {
    document: 'Belge e-vergi levhası olarak doğrulanamadı',
    tax_number: 'Vergi numarası belgede bulunamadı',
    name: 'Unvan belgedekiyle eşleşmiyor',
    tax_office: 'Vergi dairesi belgede bulunamadı',
    city: 'İl belgede bulunamadı',
    year: 'Levha güncel değil',
    integrity: 'Belgede değişiklik izi olabilir',
  }

  if (!extracted.has_text) {
    add('document', 'Belgede okunabilir metin var', false, 'Fotoğraf veya taranmış belge')
    return {
      decision: 'needs_review',
      checks,
      reasons: [
        'Belge fotoğraf veya tarama olduğu için otomatik okunamadı; ekibimiz inceleyecek. Daha hızlı onay için e-Devlet / GİB İnternet Vergi Dairesi üzerinden indirdiğiniz vergi levhası PDF\'ini yükleyin.',
      ],
    }
  }

  add('document', 'Belge bir e-vergi levhası', extracted.is_tax_certificate, extracted.is_tax_certificate ? 'Vergi levhası tanındı' : 'Vergi levhası alanları bulunamadı')
  if (!extracted.is_tax_certificate) {
    return { decision: 'rejected', checks, reasons: ['Yüklenen belge vergi levhası olarak tanınmadı.'] }
  }

  const documentTokens = new Set(foldTurkish(documentText).split(' ').filter(Boolean))
  const profileNumber = profile.tax_id ? normalizeTaxNumber(profile.tax_id) : ''
  add(
    'tax_number',
    'Vergi numarası belgede geçiyor',
    !!profileNumber && extracted.tax_numbers.includes(profileNumber),
    extracted.tax_numbers.length ? `Belgedeki numaralar: ${extracted.tax_numbers.join(', ')}` : 'Belgede geçerli vergi numarası yok',
  )

  const nameCoverage = profile.company_legal_name ? tokenCoverage(profile.company_legal_name, documentTokens) : 0
  add(
    'name',
    'Unvan belgedekiyle eşleşiyor',
    nameCoverage >= NAME_COVERAGE_THRESHOLD,
    profile.company_legal_name ? `Profildeki unvanın %${Math.round(nameCoverage * 100)} kadarı belgede geçiyor` : 'Profilde unvan yok',
  )

  const officeCoverage = profile.tax_office ? tokenCoverage(profile.tax_office, documentTokens, OFFICE_WORDS) : 0
  add('tax_office', 'Vergi dairesi belgede geçiyor', officeCoverage === 1, profile.tax_office ? `Profilde: ${profile.tax_office}` : 'Profilde vergi dairesi yok')

  const cityCoverage = profile.tax_office_city ? tokenCoverage(profile.tax_office_city, documentTokens, new Set()) : 0
  add('city', 'İl belgede geçiyor', cityCoverage === 1, profile.tax_office_city ? `Profilde: ${profile.tax_office_city}` : 'Profilde il yok')

  const recent = !!extracted.year && extracted.year >= currentYear - MAX_CERTIFICATE_AGE_YEARS
  add('year', 'Levha güncel', recent, extracted.year ? `Belgedeki en yeni yıl: ${extracted.year}` : 'Belgede yıl bulunamadı')

  const clean = extracted.suspicious_signs.length === 0
  add('integrity', 'Belgede değişiklik izi yok', clean, clean ? 'Şüpheli iz bulunmadı' : extracted.suspicious_signs.join('; '))

  const failed = checks.filter((check) => !check.passed)
  return {
    decision: failed.length === 0 ? 'auto_approved' : 'needs_review',
    checks,
    reasons: failed.map((check) => `${FAILURE_TEXT[check.key]} (${check.detail})`),
  }
}
