import { describe, expect, it } from 'vitest'
import { hasActiveSpotlight } from '@/lib/spotlight-access'
import { resolveSubscriptionTier } from '@/lib/subscription-tier'
import { effectiveOfferStatus, OFFER_EXPIRY_MS } from '@/lib/offer-shared'

const future = new Date(Date.now() + 86_400_000).toISOString()
const past = new Date(Date.now() - 86_400_000).toISOString()

describe('Spotlight erişimi ve seviye', () => {
  it('bitiş tarihi geçmişse kapalı sayılır', () => {
    expect(hasActiveSpotlight({ spotlight_active: true, spotlight_expires_at: past })).toBe(false)
    expect(hasActiveSpotlight({ spotlight_active: true, spotlight_expires_at: null })).toBe(true)
    expect(hasActiveSpotlight(null)).toBe(false)
  })

  it('plan koduna göre seviye', () => {
    const base = { verification_status: 'verified', spotlight_active: true, spotlight_expires_at: future }
    expect(resolveSubscriptionTier({ ...base, role: 'brand', spotlight_plan: 'mpro' })).toBe('BRAND_PRO')
    expect(resolveSubscriptionTier({ ...base, role: 'brand', spotlight_plan: 'mbasic' })).toBe('SPOTLIGHT')
    expect(resolveSubscriptionTier({ ...base, role: 'influencer', spotlight_plan: 'ipro' })).toBe('SPOTLIGHT_PLUS')
    expect(resolveSubscriptionTier({ ...base, role: 'influencer', spotlight_plan: 'ibasic' })).toBe('SPOTLIGHT')
  })

  it('onaysız, süresi dolmuş ya da admin hesabı FREE', () => {
    const base = { role: 'brand', spotlight_plan: 'mpro', spotlight_active: true, spotlight_expires_at: future }
    expect(resolveSubscriptionTier({ ...base, verification_status: 'pending' })).toBe('FREE')
    expect(resolveSubscriptionTier({ ...base, verification_status: 'verified', spotlight_expires_at: past })).toBe('FREE')
    expect(resolveSubscriptionTier({ ...base, verification_status: 'verified', role: 'admin' })).toBe('FREE')
  })
})

describe('teklif süresi', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')

  it('7 gün dolunca bekleyen teklif "expired" görünür', () => {
    expect(effectiveOfferStatus({ status: 'pending', created_at: new Date(now - OFFER_EXPIRY_MS).toISOString() }, now)).toBe('expired')
    expect(effectiveOfferStatus({ status: 'pending', created_at: new Date(now - OFFER_EXPIRY_MS + 1000).toISOString() }, now)).toBe('pending')
  })

  it('diğer durumlara dokunmaz', () => {
    expect(effectiveOfferStatus({ status: 'accepted', created_at: '2020-01-01' }, now)).toBe('accepted')
    expect(effectiveOfferStatus({ status: null }, now)).toBe('pending')
  })
})
