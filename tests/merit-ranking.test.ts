import { describe, expect, it } from 'vitest'
import { MERIT_COLLAB_CAP, MERIT_COLLAB_POINTS, meritScore, meritTrust } from '@/lib/merit-ranking'
import { sortDiscoverProfiles, type FilterableProfile } from '@/lib/discover-filters'

const profile = { id: 'u1', full_name: 'Test', username: 'test', category: 'beauty', avatar_url: 'https://example.com/a.png' }
const account = { follower_count: 50_000, engagement_rate: 3, stats_payload: { avg_comments: 40 } }

describe('liyakat puanı', () => {
  it('güven skoru Spotlight puanı olmadan; hesapsız profil düşük', () => {
    expect(meritTrust(profile, [account])).toBe(90) // 20 + 30 + 5 + 5 + 20 + 10; Spotlight +10 yok
    expect(meritTrust(profile, [])).toBe(30)
  })

  it('tamamlanan iş birliği başına puan, üst sınırlı', () => {
    expect(meritScore(70, 2)).toBe(70 + 2 * MERIT_COLLAB_POINTS)
    expect(meritScore(70, 50)).toBe(70 + MERIT_COLLAB_CAP * MERIT_COLLAB_POINTS)
    expect(meritScore(70, -3)).toBe(70)
  })
})

describe('0₺ döneminde keşif sıralaması', () => {
  const p = (id: string, over: Partial<FilterableProfile>) => ({
    id,
    ...{ spotlight_active: false, availability_status: 'open' as const, accounts: [{ platform: 'instagram', follower_count: 1_000, engagement_rate: 1 }] },
    ...over,
  })
  const items = [
    p('spot-low', { spotlight_active: true, merit_score: 40 }),
    p('busy-high', { availability_status: 'busy', merit_score: 99 }),
    p('plain-high', { merit_score: 80 }),
    p('spot-mid', { spotlight_active: true, merit_score: 60, accounts: [{ platform: 'instagram', follower_count: 90_000, engagement_rate: 1 }] }),
  ]

  it('bayrak kapalı: sıra korunur (Spotlight önceliği yalnızca ölçüt seçilince)', () => {
    expect(sortDiscoverProfiles(items, {}, (x) => x).map((x) => x.id)).toEqual(['spot-low', 'plain-high', 'spot-mid', 'busy-high'])
    expect(sortDiscoverProfiles(items, { sort: 'followers_desc' }, (x) => x).map((x) => x.id)).toEqual(['spot-mid', 'spot-low', 'plain-high', 'busy-high'])
  })

  it('merit: ölçüt yoksa liyakat puanı, dolu profiller yine sonda', () => {
    expect(sortDiscoverProfiles(items, { merit: true }, (x) => x).map((x) => x.id)).toEqual(['plain-high', 'spot-mid', 'spot-low', 'busy-high'])
  })

  it('merit: ölçüt seçilince Spotlight önceliği yok', () => {
    expect(sortDiscoverProfiles(items, { merit: true, sort: 'followers_asc' }, (x) => x).map((x) => x.id)).toEqual(['spot-low', 'plain-high', 'spot-mid', 'busy-high'])
  })
})
