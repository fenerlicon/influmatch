import { describe, expect, it } from 'vitest'
import { registrableDomain, validateCorporateEmail, websiteHost } from '@/lib/corporate-email'

describe('kurumsal e-posta', () => {
  it('web sitesinden alan adını çıkarır', () => {
    expect(websiteHost('https://www.Marka.com.tr/urunler?x=1')).toBe('marka.com.tr')
    expect(websiteHost('marka.com')).toBe('marka.com')
    expect(websiteHost('')).toBeNull()
  })

  it('iki parçalı uzantıları tanır', () => {
    expect(registrableDomain('shop.marka.com.tr')).toBe('marka.com.tr')
    expect(registrableDomain('mail.marka.com')).toBe('marka.com')
  })

  it('aynı alan adındaki adresi kabul eder (alt alan adı dahil)', () => {
    expect(validateCorporateEmail('Ad@Marka.com.tr', 'https://www.marka.com.tr').isValid).toBe(true)
    expect(validateCorporateEmail('ad@mail.marka.com.tr', 'marka.com.tr').isValid).toBe(true)
  })

  it('kişisel ve başka alan adlarını reddeder', () => {
    expect(validateCorporateEmail('ad@gmail.com', 'marka.com').isValid).toBe(false)
    expect(validateCorporateEmail('ad@baska.com.tr', 'marka.com.tr').isValid).toBe(false)
    // "com.tr" üstünden eşleşme olmamalı
    expect(validateCorporateEmail('ad@a.com.tr', 'b.com.tr').isValid).toBe(false)
    expect(validateCorporateEmail('ad@marka.com', null).isValid).toBe(false)
    expect(validateCorporateEmail('gecersiz', 'marka.com').isValid).toBe(false)
  })
})
