import { describe, expect, it } from 'vitest'
import { BLUE_TICK_RULES, evaluateBlueTick, type BlueTickAccount, type BlueTickProfile } from '@/lib/blue-tick-rules'

const NOW = Date.parse('2026-10-16T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

const profile = (over: Partial<BlueTickProfile> = {}): BlueTickProfile => ({
  id: 'u1',
  full_name: 'Test Kullanıcı',
  username: 'test',
  avatar_url: 'https://example.com/a.png',
  category: 'beauty',
  spotlight_active: true,
  spotlight_expires_at: new Date(NOW + 10 * DAY).toISOString(),
  ...over,
})

const account = (over: Partial<BlueTickAccount> = {}): BlueTickAccount => ({
  platform: 'instagram',
  is_verified: true,
  has_stats: true,
  follower_count: 50_000,
  engagement_rate: 3,
  stats_payload: { avg_comments: 40 },
  last_scraped_at: new Date(NOW - 2 * DAY).toISOString(),
  ...over,
})

describe('mavi tik', () => {
  it('tüm şartları sağlayan uygun', () => {
    const r = evaluateBlueTick(profile(), [account()], NOW)
    expect(r.eligible).toBe(true)
    expect(r.trustScore).toBeGreaterThanOrEqual(BLUE_TICK_RULES.minTrustScore)
  })

  it('Spotlight yoksa ya da süresi geçmişse uygun değil', () => {
    expect(evaluateBlueTick(profile({ spotlight_active: false }), [account()], NOW).eligible).toBe(false)
    const expired = profile({ spotlight_expires_at: new Date(NOW - DAY).toISOString() })
    expect(evaluateBlueTick(expired, [account()], NOW).eligible).toBe(false)
  })

  it('takipçi, tazelik ve doğrulama şartları', () => {
    expect(evaluateBlueTick(profile(), [account({ follower_count: 9_999 })], NOW).eligible).toBe(false)
    const stale = account({ last_scraped_at: new Date(NOW - 31 * DAY).toISOString() })
    expect(evaluateBlueTick(profile(), [stale], NOW).eligible).toBe(false)
    expect(evaluateBlueTick(profile(), [account({ is_verified: false })], NOW).eligible).toBe(false)
    expect(evaluateBlueTick(profile(), [], NOW).eligible).toBe(false)
  })

  it('en çok takipçili doğrulanmış hesabı esas alır', () => {
    const r = evaluateBlueTick(profile(), [account({ platform: 'tiktok', follower_count: 2_000 }), account({ follower_count: 80_000 })], NOW)
    expect(r.primaryPlatform).toBe('instagram')
  })
})
