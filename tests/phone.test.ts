import { describe, expect, it } from 'vitest'
import { formatPhone, normalizePhone } from '@/lib/phone-shared'

describe('telefon numarası', () => {
  it('Türkiye yazımları E.164 olur', () => {
    for (const v of ['0532 123 45 67', '5321234567', '+90 532 123 45 67', '905321234567', '00905321234567', '(0532) 123-45-67']) {
      expect(normalizePhone(v), v).toEqual({ phone: '+905321234567' })
    }
    expect(normalizePhone('0212 555 12 34')).toEqual({ phone: '+902125551234' })
  })
  it('yurt dışı + ile', () => {
    expect(normalizePhone('+44 20 7946 0958')).toEqual({ phone: '+442079460958' })
  })
  it('geçersizler reddedilir', () => {
    for (const v of ['', '123', 'abc', '+90 012 345 67 89', '0532 123 45', '+0123456789', '05321234567<script>']) {
      expect('error' in normalizePhone(v), v).toBe(true)
    }
  })
  it('gösterim', () => {
    expect(formatPhone('+905321234567')).toBe('+90 532 123 45 67')
    expect(formatPhone('+442079460958')).toBe('+442079460958')
  })
})
