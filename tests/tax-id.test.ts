import { describe, expect, it } from 'vitest'
import { isValidTckn, isValidVkn, normalizeTaxNumber, validateTaxNumber } from '@/lib/tax-id'

// GİB'in yayımladığı VKN kontrol hanesi algoritmasının bağımsız yazımı (lib/tax-id.ts ile karşılaştırmak için).
function referenceVknCheckDigit(first9: string): number {
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const tmp = (Number(first9[i]) + 10 - (i + 1)) % 10
    sum += tmp === 9 ? 9 : (tmp * 2 ** (10 - (i + 1))) % 9
  }
  return (10 - (sum % 10)) % 10
}

describe('vergi numarası', () => {
  it('ayraçları temizler', () => {
    expect(normalizeTaxNumber('123 456-78.90')).toBe('1234567890')
  })

  it('VKN kontrol hanesi başvuru algoritmasıyla aynı', () => {
    let seed = 42
    for (let n = 0; n < 2000; n++) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      const first9 = String(seed % 1_000_000_000).padStart(9, '0')
      const check = referenceVknCheckDigit(first9)
      expect(isValidVkn(first9 + check)).toBe(true)
      expect(isValidVkn(first9 + ((check + 1) % 10))).toBe(false)
    }
  })

  it('TCKN kuralları', () => {
    expect(isValidTckn('10000000146')).toBe(true)
    expect(isValidTckn('10000000147')).toBe(false)
    expect(isValidTckn('00000000146')).toBe(false) // 0 ile başlayamaz
  })

  it('uzunluğa göre tür seçer', () => {
    const vkn = '123456789' + referenceVknCheckDigit('123456789')
    expect(validateTaxNumber(vkn)).toEqual({ isValid: true, type: 'vkn', normalized: vkn })
    expect(validateTaxNumber('100 000 001 46')).toEqual({ isValid: true, type: 'tckn', normalized: '10000000146' })
    expect(validateTaxNumber('12345').isValid).toBe(false)
    expect(validateTaxNumber('12a4567890').isValid).toBe(false)
  })
})
