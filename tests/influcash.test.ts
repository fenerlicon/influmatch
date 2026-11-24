import { describe, expect, it } from 'vitest'
import {
  DEFAULT_INFLUCASH_RULES,
  clawbackEntries,
  dailyLoginAwards,
  istanbulDay,
  loginStreak,
  normalizeInflucashRules,
  redeemBlocker,
  spendableBalance,
  taskAward,
  validateInflucashRulesInput,
  type CatalogItemLike,
  type LedgerLike,
} from '@/lib/influcash-shared'
import { validateCatalogInput } from '@/lib/influcash'

const rules = { ...DEFAULT_INFLUCASH_RULES, daily_login: 2, streak_7: 10, streak_30: 50, daily_monthly_cap: 100 }
const days = (end: string, count: number) =>
  Array.from({ length: count }, (_, i) => new Date(Date.parse(`${end}T00:00:00Z`) - i * 86_400_000).toISOString().slice(0, 10))

describe('günlük giriş', () => {
  it('İstanbul günü', () => {
    expect(istanbulDay(Date.parse('2026-11-23T20:59:00Z'))).toBe('2026-11-23')
    expect(istanbulDay(Date.parse('2026-11-23T21:00:00Z'))).toBe('2026-11-24')
  })

  it('günde bir kez', () => {
    expect(dailyLoginAwards(rules, [], '2026-11-24', 0)).toEqual([{ reason: 'daily_login', ref: '2026-11-24', amount: 2 }])
    expect(dailyLoginAwards(rules, ['2026-11-24'], '2026-11-24', 2)).toEqual([])
  })

  it('seri: kesintisiz 7. ve 30. gün', () => {
    expect(loginStreak(days('2026-11-24', 5), '2026-11-24')).toBe(5)
    expect(loginStreak(['2026-11-24', '2026-11-22'], '2026-11-24')).toBe(1)
    const six = days('2026-11-23', 6)
    expect(dailyLoginAwards(rules, six, '2026-11-24', 12).map((a) => a.reason)).toEqual(['daily_login', 'login_streak'])
    expect(dailyLoginAwards(rules, six, '2026-11-24', 12)[1]).toEqual({ reason: 'login_streak', ref: '7:2026-11-24', amount: 10 })
    expect(dailyLoginAwards(rules, days('2026-11-23', 29), '2026-11-24', 0).find((a) => a.reason === 'login_streak')?.ref).toBe('30:2026-11-24')
    // Ara verince seri sıfırlanır.
    expect(dailyLoginAwards(rules, days('2026-11-22', 6), '2026-11-24', 0).map((a) => a.reason)).toEqual(['daily_login'])
  })

  it('aylık üst sınır', () => {
    expect(dailyLoginAwards(rules, [], '2026-11-24', 100)).toEqual([])
    expect(dailyLoginAwards(rules, days('2026-11-23', 6), '2026-11-24', 95)).toEqual([
      { reason: 'daily_login', ref: '2026-11-24', amount: 2 },
      { reason: 'login_streak', ref: '7:2026-11-24', amount: 3 },
    ])
  })
})

describe('kurallar', () => {
  it('görev puanı türe göre', () => {
    expect(taskAward(rules, 'promo_video')).toBe(rules.task_promo_video)
    expect(taskAward(rules, 'invites')).toBe(rules.task_invites)
    expect(taskAward(rules, 'brand_first_steps')).toBe(rules.task_other)
  })

  it('bozuk ayar varsayılana düşer, admin girdisi doğrulanır', () => {
    expect(normalizeInflucashRules({ daily_login: -5, collab_completed: '120', redeem_hourly_limit: 0 })).toMatchObject({
      daily_login: DEFAULT_INFLUCASH_RULES.daily_login,
      collab_completed: 120,
      redeem_hourly_limit: 1,
    })
    expect('error' in validateInflucashRulesInput({ ...DEFAULT_INFLUCASH_RULES, daily_login: '' })).toBe(true)
    expect('error' in validateInflucashRulesInput({ ...DEFAULT_INFLUCASH_RULES, redeem_hourly_limit: 0 })).toBe(true)
    expect(validateInflucashRulesInput({ ...DEFAULT_INFLUCASH_RULES })).toEqual(DEFAULT_INFLUCASH_RULES)
  })
})

describe('geri alım', () => {
  const collab = 'c1'
  const ledger: LedgerLike[] = [
    { reason: 'collab_completed', ref: collab, amount: 100 },
    { reason: 'ontime_delivery', ref: 'd1', amount: 20 },
    { reason: 'ontime_delivery', ref: 'd2', amount: 20 },
    { reason: 'daily_login', ref: '2026-11-24', amount: 2 },
    { reason: 'clawback', ref: 'ontime_delivery:d2', amount: -20 },
  ]
  it('yalnızca o iş birliğinin kazanımları, bir kez', () => {
    expect(clawbackEntries(ledger, [collab, 'd1', 'd2'])).toEqual([
      { reason: 'clawback', ref: `collab_completed:${collab}`, amount: -100 },
      { reason: 'clawback', ref: 'ontime_delivery:d1', amount: -20 },
    ])
    expect(clawbackEntries(ledger, ['other'])).toEqual([])
  })
  it('eksi bakiye harcamada 0 sayılır', () => {
    expect(spendableBalance(-40)).toBe(0)
    expect(spendableBalance(55)).toBe(55)
  })
})

describe('harcama', () => {
  const item: CatalogItemLike = { active: true, audience: 'creator', cost: 100, stock: null, reward_type: 'discount_percent' }
  const ctx = { audience: 'creator' as const, balance: 150, partnerCouponsEnabled: false, recentRedemptions: 0, hourlyLimit: 5 }
  it('kurallar', () => {
    expect(redeemBlocker(item, ctx)).toBeNull()
    expect(redeemBlocker(item, { ...ctx, audience: 'brand' })).toBe('Bu ödül şu an alınamaz.')
    expect(redeemBlocker({ ...item, audience: 'all' }, { ...ctx, audience: 'brand' })).toBeNull()
    expect(redeemBlocker({ ...item, active: false }, ctx)).not.toBeNull()
    expect(redeemBlocker({ ...item, stock: 0 }, ctx)).toBe('Bu ödülün stoğu bitti.')
    expect(redeemBlocker(item, { ...ctx, balance: 99 })).toBe('Influcash bakiyen yetmiyor.')
    expect(redeemBlocker(item, { ...ctx, balance: -500 })).toBe('Influcash bakiyen yetmiyor.')
    expect(redeemBlocker(item, { ...ctx, recentRedemptions: 5 })).toMatch(/sık/)
    expect(redeemBlocker({ ...item, reward_type: 'partner_coupon' }, ctx)).toBe('Bu ödül şu an alınamaz.')
    expect(redeemBlocker({ ...item, reward_type: 'partner_coupon' }, { ...ctx, partnerCouponsEnabled: true })).toBeNull()
  })

  it('katalog girdisi', () => {
    expect('error' in validateCatalogInput({ title: 'x', cost: 10, audience: 'all', reward_type: 'discount_percent', percent: 20 })).toBe(true)
    expect('error' in validateCatalogInput({ title: 'İndirim', cost: 10, audience: 'all', reward_type: 'discount_percent', percent: 95 })).toBe(true)
    expect('error' in validateCatalogInput({ title: '7 gün', cost: 10, audience: 'creator', reward_type: 'spotlight_days', plan: 'gold', days: 7 })).toBe(true)
    const ok = validateCatalogInput({ title: '7 gün Basic', cost: '300', audience: 'creator', reward_type: 'spotlight_days', plan: 'basic', days: '7', stock: '', active: true })
    expect(ok).toEqual({
      row: expect.objectContaining({ cost: 300, plan: 'basic', days: 7, stock: null, active: true, percent: null }),
    })
  })
})
