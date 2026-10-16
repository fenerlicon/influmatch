import { describe, expect, it } from 'vitest'
import { DEFAULT_PLATFORM_SETTINGS, normalizePlatformSettings, validatePlatformSettingsInput } from '@/lib/platform-settings-shared'
import { campaignBudgetPerCreator, deliverablesText } from '@/lib/campaigns-shared'
import { validateUsername } from '@/utils/usernameValidation'
import { categoryMatchLevel, influencerCategoriesForBrand, normalizeInfluencerCategory } from '@/lib/category-map'

describe('platform ayarları (ücretsiz marka sınırları)', () => {
  it('bayrak varsayılan olarak kapalı', () => {
    expect(DEFAULT_PLATFORM_SETTINGS.free_brand_limits_enabled).toBe(false)
    expect(normalizePlatformSettings({}).free_brand_limits_enabled).toBe(false)
    expect(normalizePlatformSettings({ free_brand_limits_enabled: 'true' }).free_brand_limits_enabled).toBe(false)
  })

  it('varsayılanlar 2026-10-10 ve 2026-10-15 kararlarıyla aynı', () => {
    expect(DEFAULT_PLATFORM_SETTINGS).toMatchObject({
      wheel_profiles_per_day: 10,
      wheel_window_hours: 24,
      free_offers_per_day: 3,
      free_offers_per_month: 15,
      free_active_adverts: 1,
      basic_offers_per_day: 10,
      basic_offers_per_month: 60,
      basic_active_adverts: 3,
    })
  })

  it('bozuk değerleri sınırlar ya da varsayılana döner', () => {
    const s = normalizePlatformSettings({ wheel_profiles_per_day: 999, wheel_window_hours: 'x', free_offers_per_day: null })
    expect(s.wheel_profiles_per_day).toBe(50)
    expect(s.wheel_window_hours).toBe(24)
    expect(s.free_offers_per_day).toBeNull()
  })

  it('admin formu doğrulaması', () => {
    const ok = { free_brand_limits_enabled: false, wheel_profiles_per_day: 10, wheel_window_hours: 24, free_offers_per_day: '' }
    expect('error' in validatePlatformSettingsInput(ok)).toBe(false)
    expect('error' in validatePlatformSettingsInput({ ...ok, free_offers_per_day: '2.5' })).toBe(true)
    expect('error' in validatePlatformSettingsInput({ ...ok, wheel_profiles_per_day: 0 })).toBe(true)
    expect('error' in validatePlatformSettingsInput({ ...ok, free_brand_limits_enabled: 'yes' })).toBe(true)
  })
})

describe('kampanya bütçesi', () => {
  it('kişi başı > planlanan > toplam', () => {
    expect(campaignBudgetPerCreator({ total_budget: 100_000, per_creator_budget: 7_000, planned_creators: 10 })).toEqual({ amount: 7_000, basis: 'per_creator' })
    expect(campaignBudgetPerCreator({ total_budget: 100_000, per_creator_budget: null, planned_creators: 3 })).toEqual({ amount: 33_333, basis: 'planned' })
    expect(campaignBudgetPerCreator({ total_budget: 100_000, per_creator_budget: null, planned_creators: 0 })).toEqual({ amount: 100_000, basis: 'total' })
    expect(campaignBudgetPerCreator({ total_budget: null, per_creator_budget: null, planned_creators: 5 })).toBeNull()
  })

  it('teslimat metni', () => {
    expect(deliverablesText([{ kind: 'reel', quantity: 2 }, { kind: 'story', quantity: 3 }])).toBe('2 × Reels, 3 × Story')
    expect(deliverablesText([])).toBeNull()
  })
})

describe('kullanıcı adı', () => {
  it('geçerli adlar', () => {
    for (const name of ['ayse', 'ayse.yilmaz', 'ayse_', 'a1b2c3']) expect(validateUsername(name).isValid).toBe(true)
  })
  it('geçersiz adlar', () => {
    for (const name of ['', 'ab', 'Ayse', '.ayse', '_ayse', 'ayse.', 'ay..se', 'ay__se', 'ay._se', 'ayşe', 'ay se', 'a'.repeat(31)]) {
      expect(validateUsername(name).isValid, name).toBe(false)
    }
  })
})

describe('kategori eşlemesi', () => {
  it('eski mobil etiketlerini ve web etiketlerini anahtara çevirir', () => {
    expect(normalizeInfluencerCategory('Moda')).toBe('fashion')
    expect(normalizeInfluencerCategory('beauty, fashion')).toBe('beauty')
    expect(normalizeInfluencerCategory('bilinmeyen')).toBeNull()
  })
  it('marka sektörü → influencer kategorileri', () => {
    expect(influencerCategoriesForBrand('food')).toContain('food')
    expect(influencerCategoriesForBrand('agency')).toEqual([])
    expect(categoryMatchLevel('food', 'food')).toBe('primary')
    expect(categoryMatchLevel('food', 'travel')).toBe('related')
    expect(categoryMatchLevel('food', 'gaming')).toBeNull()
  })
})
