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
/**
 * Calculates a "Trust Score" (0-100) as a proxy for Sentiment Analysis.
 * This analyzes account metadata to estimate credibility.
 */
export function calculateTrustScore(influencer: DiscoverInfluencer): number {
    let score = 50 // Base score

    // 1. Verification (+20)
    if (influencer.verification_status === 'verified') score += 20

    // 2. Spotlight Status (+15) - paying/verified members are more trustworthy
    if (influencer.spotlight_active) score += 15

    // 3. Completeness (+10)
    if (influencer.avatar_url) score += 5
    if (influencer.full_name) score += 5

    // 4. Engagement Health (+20) - The "Anti-Bot" check
    if (influencer.stats) {
        const eng = parsePercentage(influencer.stats.engagement)
        // Healthy engagement is typically between 1% and 10%
        if (eng >= 0.01 && eng <= 0.10) {
            score += 20
        } else if (eng > 0.30) {
            // Suspiciously high engagement (bot rings?)
            score -= 20
        } else if (eng < 0.005) {
            // Dead account
            score -= 10
        }

        // 5. Interaction Quality (+15)
        // If they have average comments data, it implies real activity
        const avgComments = parseMultiplier(influencer.stats.avg_comments || '0')
        if (avgComments > 5) score += 15
    }

    return Math.min(Math.max(Math.round(score), 0), 100)
}

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
        score += 10
    }

    // 2. Effective Reach (The "Bot Shield") (+30)
    if (stats) {
        const followers = parseMultiplier(stats.followers)
        const engagement = parsePercentage(stats.engagement)
        const activeAudience = followers * engagement

        const effectiveScore = Math.min((activeAudience / 5000) * 30, 30)
        score += effectiveScore
    }

    // 3. Trust Factor (+30) - Integrating the new Trust Score
    const trust = calculateTrustScore(influencer)
    score += (trust / 100) * 30

    return Math.min(Math.round(score), 100)
}

export function getMatchReason(influencer: DiscoverInfluencer, criteria: MatchingCriteria): string[] {
    const reasons: string[] = []
    const stats = influencer.stats
    const trust = calculateTrustScore(influencer)

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

        if (engagement > 0.05 && engagement < 0.30) reasons.push('Yüksek Etkileşim')
        if (activeAudience > 50000) reasons.push('Geniş Aktif Kitle')
        if (trust > 80) reasons.push('Güvenilir Profil')
        if (trust < 40) reasons.push('Düşük Güven')
    }

    // Quality
    if (influencer.spotlight_active) reasons.push('Spotlight Üyesi')
    if (influencer.verification_status === 'verified') reasons.push('Doğrulanmış Hesap')

    return reasons
}
