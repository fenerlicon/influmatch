// Vergi numarası biçim doğrulaması (istemci ve sunucu ortak kullanır).
//
// - Şirketler: 10 haneli Vergi Kimlik Numarası (VKN), GİB kontrol hanesi algoritması.
// - Şahıs şirketleri: vergi kimliği olarak 11 haneli T.C. Kimlik Numarası (TCKN) kullanılır.
//
// Bu kontrol numaranın gerçekten bu işletmeye ait olduğunu kanıtlamaz; sadece yazım hatalarını
// ve uydurma numaraları eler. Aynı kural veritabanında public.is_valid_tax_number() ile de uygulanır.

export type TaxNumberType = 'vkn' | 'tckn'

export type TaxNumberValidation =
  | { isValid: true; type: TaxNumberType; normalized: string }
  | { isValid: false; error: string }

/** Boşlukları, tireleri ve noktaları temizler ("123 456-78.90" -> "1234567890"). */
export function normalizeTaxNumber(raw: string): string {
  return raw.replace(/[\s.-]/g, '')
}

function digitsOf(value: string): number[] {
  return value.split('').map(Number)
}

export function isValidVkn(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false
  const d = digitsOf(value)

  let sum = 0
  for (let i = 0; i < 9; i++) {
    const shifted = (d[i] + 9 - i) % 10
    if (shifted === 0) continue
    sum += (shifted * 2 ** (9 - i)) % 9 || 9
  }

  return (10 - (sum % 10)) % 10 === d[9]
}

export function isValidTckn(value: string): boolean {
  if (!/^[1-9]\d{10}$/.test(value)) return false
  const d = digitsOf(value)

  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8]
  const evenSum = d[1] + d[3] + d[5] + d[7]
  const tenth = (((oddSum * 7 - evenSum) % 10) + 10) % 10
  const eleventh = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10

  return tenth === d[9] && eleventh === d[10]
}

export function validateTaxNumber(raw: string): TaxNumberValidation {
  const value = normalizeTaxNumber(raw)

  if (!/^\d+$/.test(value)) {
    return { isValid: false, error: 'Vergi numarası sadece rakamlardan oluşmalıdır.' }
  }
  if (value.length === 10) {
    return isValidVkn(value)
      ? { isValid: true, type: 'vkn', normalized: value }
      : { isValid: false, error: 'Geçersiz vergi kimlik numarası. Lütfen vergi levhanızdaki numarayı kontrol edin.' }
  }
  if (value.length === 11) {
    return isValidTckn(value)
      ? { isValid: true, type: 'tckn', normalized: value }
      : { isValid: false, error: 'Geçersiz T.C. kimlik numarası. Şahıs şirketleri vergi levhasındaki T.C. kimlik numarasını girmelidir.' }
  }
  return {
    isValid: false,
    error: 'Vergi numarası 10 haneli (şirketler) veya 11 haneli (şahıs şirketleri, T.C. kimlik no) olmalıdır.',
  }
}
