import { type DiscoverInfluencer } from '@/types/influencer'

function parseMultiplier(str: string): number {
    if (!str) return 0
    const upper = str.toUpperCase().trim()
    const num = parseFloat(upper.replace(/[^0-9.]/g, ''))
    if (isNaN(num)) return 0

    if (upper.includes('M')) return num * 1_000_000
    if (upper.includes('K') || upper.includes('B')) return num * 1_000
    return num
}

function parsePercentage(str: string): number {
    if (!str) return 0
    const num = parseFloat(str.replace('%', '').trim())
    if (isNaN(num)) return 0
    return num / 100 // Return as decimal (e.g. 5% -> 0.05)
}

export interface MatchingCriteria {
    targetCategory?: string
    minEngagement?: number
}

/**
 * Calculates a match score (0-100) for an influencer based on "Effective Reach" logic.
 * 
 * Logic (The "Bot Filter"):
 * 1. Category Match (40 pts): Essential.
 * 2. Effective Reach (40 pts): Followers * Engagement Rate.
 *    - This penalizes high-follower/low-activity accounts.
 *    - Example: 
 *       User A: 500k * 0.1% = 500 active users -> Low Score
 *       User B: 50k * 5.0% = 2500 active users -> High Score
 * 3. Completeness/Quality (20 pts): Verification, Avatar, Bio.
 */
export function calculateMatchScore(influencer: DiscoverInfluencer, criteria: MatchingCriteria): number {
    let score = 0
    const stats = influencer.stats

    // 1. Category Match (+40)
    if (criteria.targetCategory && influencer.category) {
        if (influencer.category.toLowerCase() === criteria.targetCategory.toLowerCase()) {
            score += 40
        } else if (influencer.category.toLowerCase().includes(criteria.targetCategory.toLowerCase())) {
            score += 20 // Partial match
        }
    } else {
        // If no category selected, give generic points to not ruin sort
        score += 10
    }

    // 2. Effective Reach (The "Bot Shield") (+40)
    if (stats) {
        const followers = parseMultiplier(stats.followers)
        const engagement = parsePercentage(stats.engagement)
        const activeAudience = followers * engagement

        // Normalize: Assume 10,000 active audience is "Perfect" (10/10 scale * 4 multiplier) for this platform scale
        // This can be adjusted. 
        // 5k active = 20 pts
        // 10k active = 40 pts (max)
        const effectiveScore = Math.min((activeAudience / 5000) * 40, 40)
        score += effectiveScore
    }

    // 3. Quality & Badges (+20)
    if (influencer.verification_status === 'verified') score += 10
    if (influencer.avatar_url) score += 5
    if (influencer.spotlight_active) score += 5

    return Math.min(Math.round(score), 100)
}

export function getMatchReason(influencer: DiscoverInfluencer, criteria: MatchingCriteria): string[] {
    const reasons: string[] = []
    const stats = influencer.stats

    // Category
    if (criteria.targetCategory && influencer.category) {
        if (influencer.category.toLowerCase() === criteria.targetCategory.toLowerCase()) {
            reasons.push('Kategori Eşleşmesi')
        }
    }

    // Engagement/Reach
    if (stats) {
        const followers = parseMultiplier(stats.followers)
        const engagement = parsePercentage(stats.engagement)
        const activeAudience = followers * engagement

        // Thresholds (arbitrary for now, can be tuned)
        if (engagement > 0.05) reasons.push('Yüksek Etkileşim') // >5%
        if (activeAudience > 50000) reasons.push('Geniş Aktif Kitle')
    }

    // Quality
    if (influencer.spotlight_active) reasons.push('Spotlight Üyesi')
    if (influencer.verification_status === 'verified') reasons.push('Doğrulanmış Hesap')

    return reasons
}
