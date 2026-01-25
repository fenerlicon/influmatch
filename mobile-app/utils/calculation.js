export function parseMultiplier(str) {
    if (!str) return 0;
    // If it's already a number, return it
    if (typeof str === 'number') return str;

    const upper = str.toUpperCase().trim();
    const num = parseFloat(upper.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0;

    if (upper.includes('M')) return num * 1_000_000;
    if (upper.includes('K') || upper.includes('B')) return num * 1_000;
    return num;
}

export function parsePercentage(value) {
    if (value === null || value === undefined) return 0;

    // If it's already a number (e.g. 4.5 representing 4.5%)
    if (typeof value === 'number') {
        return value / 100;
    }

    const str = String(value);
    const num = parseFloat(str.replace('%', '').trim());
    if (isNaN(num)) return 0;
    return num / 100; // Return as decimal (e.g. 5% -> 0.05)
}

/**
 * Calculates a "Trust Score" (0-100) 
 */
export function calculateTrustScore(profile, socialStats) {
    let score = 20; // Base score

    // 1. Social Account Connection (+30)
    // Award points if they have successfully connected account and we have stats
    if (socialStats) score += 30;

    // 2. Spotlight Status (+10)
    if (profile?.is_showcase_visible || profile?.spotlight_active) score += 10;

    // 3. Completeness (+10)
    if (profile?.avatar_url) score += 5;
    if (profile?.full_name) score += 5;

    // 4. Engagement Health (+20) - The "Anti-Bot" check
    if (socialStats) {
        const eng = parsePercentage(socialStats.engagement_rate);

        // Healthy engagement is typically between 1% and 10%
        if (eng >= 0.01 && eng <= 0.10) {
            score += 20;
        } else if (eng > 0.30) {
            // Suspiciously high engagement (bot rings?)
            score -= 10;
        } else if (eng < 0.005) {
            // Dead account
            score -= 5;
        }

        // 5. Interaction Quality (+10)
        // If they have average comments data
        const avgComments = socialStats.stats_payload?.avg_comments || 0;
        // Parse if it's a string, though usually in payload it might be number
        const commentsVal = parseMultiplier(avgComments);

        if (commentsVal > 5) score += 10;
    }

    return Math.min(Math.max(Math.round(score), 0), 100);
}
