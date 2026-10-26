import { describe, expect, it } from 'vitest'
import { COOKIE_POLICY_VERSION, decodeCookieChoice, encodeCookieChoice } from '@/lib/consent-shared'

describe('çerez tercihi çerezi', () => {
  it('sürümle yazılır ve geri okunur', () => {
    expect(decodeCookieChoice(encodeCookieChoice('all'))).toBe('all')
    expect(decodeCookieChoice(encodeCookieChoice('essential'))).toBe('essential')
    expect(encodeCookieChoice('all')).toBe(`all.${COOKIE_POLICY_VERSION}`)
  })

  it('sürümsüz eski değer geçerli', () => {
    expect(decodeCookieChoice('all')).toBe('all')
    expect(decodeCookieChoice('essential')).toBe('essential')
  })

  it('politika sürümü değişince tercih yeniden sorulur', () => {
    expect(decodeCookieChoice('all.2025-01-01')).toBeNull()
    expect(decodeCookieChoice('all.2025-01-01', '2025-01-01')).toBe('all')
  })

  it('bilinmeyen değer tercih sayılmaz', () => {
    expect(decodeCookieChoice('')).toBeNull()
    expect(decodeCookieChoice(null)).toBeNull()
    expect(decodeCookieChoice('evet')).toBeNull()
  })
})
