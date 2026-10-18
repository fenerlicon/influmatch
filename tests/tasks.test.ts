import { describe, expect, it } from 'vitest'
import {
  applySpotlightReward,
  autoTaskProgress,
  hasAdTag,
  isTaskOpen,
  isTaskTargeted,
  requiredPromoViews,
  rewardText,
  spotlightPlanCode,
  validateTaskInput,
  type TaskFacts,
} from '@/lib/tasks-shared'
import { evaluateBlueTick } from '@/lib/blue-tick-rules'
import * as webTasks from '@/lib/tasks-shared'
import * as mobileTasks from '@/mobile-app/constants/tasks.js'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-10-19T12:00:00Z')

const facts = (over: Partial<TaskFacts> = {}): TaskFacts => ({
  verifiedInvites: 0,
  profilePercent: 0,
  hasRatePrice: false,
  completedCollabs: 0,
  adverts: 0,
  offersSent: 0,
  ...over,
})

describe('tanıtım videosu eşiği', () => {
  it('takipçinin %10\'u, en az 500', () => {
    expect(requiredPromoViews(100_000)).toBe(10_000)
    expect(requiredPromoViews(2_000)).toBe(500)
    expect(requiredPromoViews(null)).toBe(500)
    expect(requiredPromoViews(12_345, { view_ratio: 0.2, min_views: 100 })).toBe(2_469)
  })

  it('reklam etiketi', () => {
    expect(hasAdTag('Harika platform #işbirliği @influmatch')).toBe(true)
    expect(hasAdTag('#REKLAM')).toBe(true)
    expect(hasAdTag('#isbirligi')).toBe(true)
    expect(hasAdTag('reklam değil')).toBe(false)
    expect(hasAdTag('#reklamcılık')).toBe(false)
    expect(hasAdTag(null)).toBe(false)
  })
})

describe('otomatik görev ilerlemesi', () => {
  it('davet turları her tur için 3 davet ister', () => {
    expect(autoTaskProgress('invites', facts({ verifiedInvites: 4 }), 1)[0]).toMatchObject({ met: true, target: 3 })
    expect(autoTaskProgress('invites', facts({ verifiedInvites: 4 }), 2)[0]).toMatchObject({ met: false, current: 4, target: 6 })
  })

  it('profil + ilk iş', () => {
    const ok = autoTaskProgress('creator_first_collab', facts({ profilePercent: 100, hasRatePrice: true, completedCollabs: 1 }), 1)
    expect(ok.every((p) => p.met)).toBe(true)
    const missing = autoTaskProgress('creator_first_collab', facts({ profilePercent: 90, hasRatePrice: true, completedCollabs: 1 }), 1)
    expect(missing.every((p) => p.met)).toBe(false)
  })

  it('marka ilk adımlar', () => {
    expect(autoTaskProgress('brand_first_steps', facts({ adverts: 1, offersSent: 3 }), 1).every((p) => p.met)).toBe(true)
    expect(autoTaskProgress('brand_first_steps', facts({ adverts: 1, offersSent: 2 }), 1).every((p) => p.met)).toBe(false)
    expect(autoTaskProgress('promo_video', facts(), 1)).toEqual([])
  })
})

describe('görev açıklığı ve hedef', () => {
  it('aktiflik ve tarih aralığı', () => {
    expect(isTaskOpen({ is_active: false, starts_at: null, ends_at: null }, NOW)).toBe(false)
    expect(isTaskOpen({ is_active: true, starts_at: null, ends_at: null }, NOW)).toBe(true)
    expect(isTaskOpen({ is_active: true, starts_at: new Date(NOW + DAY).toISOString(), ends_at: null }, NOW)).toBe(false)
    expect(isTaskOpen({ is_active: true, starts_at: null, ends_at: new Date(NOW - 1).toISOString() }, NOW)).toBe(false)
  })
  it('hedef listesi', () => {
    expect(isTaskTargeted({ target_user_ids: null }, 'a')).toBe(true)
    expect(isTaskTargeted({ target_user_ids: ['b'] }, 'a')).toBe(false)
  })
})

describe('ödüller', () => {
  it('metin ve plan kodu', () => {
    expect(rewardText({ reward_type: 'spotlight_days', reward_plan: 'pro', reward_days: 30, reward_percent: null })).toBe('+30 gün Spotlight Pro')
    expect(rewardText({ reward_type: 'discount_percent', reward_plan: null, reward_days: null, reward_percent: 20 })).toBe('%20 indirim kodu')
    expect(spotlightPlanCode('brand', 'basic')).toBe('mbasic')
    expect(spotlightPlanCode('influencer', 'pro')).toBe('ipro')
    expect(spotlightPlanCode('admin', 'pro')).toBeNull()
  })

  it('Spotlight süresi: planın yükseği, mevcut bitişten itibaren', () => {
    const noPlan = applySpotlightReward({ spotlight_active: false, spotlight_plan: null, spotlight_expires_at: null }, 'ibasic', 30, NOW)
    expect(noPlan).toEqual({ plan: 'ibasic', expiresAt: new Date(NOW + 30 * DAY).toISOString() })

    const proActive = applySpotlightReward(
      { spotlight_active: true, spotlight_plan: 'ipro', spotlight_expires_at: new Date(NOW + 10 * DAY).toISOString() },
      'ibasic',
      30,
      NOW,
    )
    expect(proActive).toEqual({ plan: 'ipro', expiresAt: new Date(NOW + 40 * DAY).toISOString() })

    const expired = applySpotlightReward(
      { spotlight_active: true, spotlight_plan: 'ipro', spotlight_expires_at: new Date(NOW - DAY).toISOString() },
      'ibasic',
      30,
      NOW,
    )
    expect(expired).toEqual({ plan: 'ibasic', expiresAt: new Date(NOW + 30 * DAY).toISOString() })

    expect(applySpotlightReward({ spotlight_active: true, spotlight_plan: 'mpro', spotlight_expires_at: null }, 'mbasic', 30, NOW)).toBeNull()
  })
})

describe('admin görev formu', () => {
  const base = { kind: 'promo_video', title: 'Tanıtım', rewardType: 'spotlight_days', rewardPlan: 'pro', rewardDays: '30', maxRounds: '1' }

  it('geçerli görev', () => {
    const r = validateTaskInput({ ...base, params: { view_ratio: '0,1', min_views: '500', hold_days: '7' }, isActive: true })
    expect('error' in r).toBe(false)
    if (!('error' in r)) {
      expect(r.audience).toBe('creator')
      expect(r.params).toEqual({ view_ratio: 0.1, min_views: 500, hold_days: 7 })
      expect(r.reward_percent).toBeNull()
    }
  })

  it('hatalı alanlar', () => {
    expect('error' in validateTaskInput({ ...base, kind: 'x' })).toBe(true)
    expect('error' in validateTaskInput({ ...base, title: 'a' })).toBe(true)
    expect('error' in validateTaskInput({ ...base, rewardDays: '0' })).toBe(true)
    expect('error' in validateTaskInput({ ...base, rewardType: 'discount_percent', rewardPercent: '95' })).toBe(true)
    expect('error' in validateTaskInput({ ...base, targetUserIds: 'not-a-uuid' })).toBe(true)
    expect('error' in validateTaskInput({ ...base, params: { view_ratio: 5 } })).toBe(true)
    expect('error' in validateTaskInput({ ...base, startsAt: '2026-10-20T00:00:00Z', endsAt: '2026-10-19T00:00:00Z' })).toBe(true)
  })

  it('hedef kullanıcılar virgülle', () => {
    const r = validateTaskInput({
      ...base,
      targetUserIds: '11111111-1111-1111-1111-111111111111, 22222222-2222-2222-2222-222222222222',
    })
    expect('error' in r ? null : r.target_user_ids).toHaveLength(2)
  })
})

describe('0₺ döneminde mavi tik', () => {
  const profile = {
    id: 'u1',
    full_name: 'Test',
    username: 'test',
    avatar_url: 'https://example.com/a.png',
    category: 'beauty',
    spotlight_active: true,
    spotlight_expires_at: new Date(NOW + 10 * DAY).toISOString(),
  }
  const account = {
    platform: 'instagram',
    is_verified: true,
    has_stats: true,
    follower_count: 50_000,
    engagement_rate: 3,
    stats_payload: { avg_comments: 40 },
    last_scraped_at: new Date(NOW - DAY).toISOString(),
  }

  it('dönem kapalıyken mevcut kural', () => {
    expect(evaluateBlueTick(profile, [account], NOW, null).eligible).toBe(true)
  })

  it('dönem açıkken görev ve iş birliği şart; Spotlight güven puanı sayılmaz', () => {
    const without = evaluateBlueTick(profile, [account], NOW, { enabled: true, promoTaskDone: false, completedCollabs: 0 })
    expect(without.eligible).toBe(false)
    expect(without.criteria.map((c) => c.key)).toEqual(expect.arrayContaining(['promo_task', 'collab']))
    const closed = evaluateBlueTick(profile, [account], NOW, null)
    expect(without.trustScore).toBe(closed.trustScore - 10)

    const withTasks = evaluateBlueTick(profile, [account], NOW, { enabled: true, promoTaskDone: true, completedCollabs: 1 })
    expect(withTasks.criteria.find((c) => c.key === 'promo_task')?.met).toBe(true)
    expect(withTasks.criteria.find((c) => c.key === 'collab')?.met).toBe(true)
  })
})

describe('web ↔ mobil görev sabitleri', () => {
  it('etiketler aynı', () => {
    expect(mobileTasks.TASK_SUBMISSION_STATUS_LABELS).toEqual(webTasks.TASK_SUBMISSION_STATUS_LABELS)
    expect(mobileTasks.TASK_REWARD_STATUS_LABELS).toEqual(webTasks.TASK_REWARD_STATUS_LABELS)
    expect(mobileTasks.TASK_STATE_CHIPS).toEqual(webTasks.TASK_STATE_CHIPS)
    expect(mobileTasks.TASK_PROOF_BUCKET).toBe(webTasks.TASK_PROOF_BUCKET)
    expect(mobileTasks.TASK_PROOF_MAX_BYTES).toBe(webTasks.TASK_PROOF_MAX_BYTES)
  })
})
