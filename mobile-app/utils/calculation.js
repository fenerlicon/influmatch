export function parseMultiplier(str) {
    if (!str) return 0;
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
    if (typeof value === 'number') return value / 100;

    const str = String(value);
    const num = parseFloat(str.replace('%', '').trim());
    if (isNaN(num)) return 0;
    return num / 100;
}

/**
 * Calculates a "Trust Score" (0-100)
 */
export function calculateTrustScore(profile, socialStats) {
    let score = 20; // Base score

    if (socialStats) score += 30;
    if (profile?.is_showcase_visible || profile?.spotlight_active) score += 10;
    if (profile?.avatar_url) score += 5;
    if (profile?.full_name) score += 5;

    if (socialStats) {
        const eng = parsePercentage(socialStats.engagement_rate);
        if (eng >= 0.01 && eng <= 0.10) {
            score += 20;
        } else if (eng > 0.30) {
            score -= 10;
        } else if (eng < 0.005) {
            score -= 5;
        }

        const avgComments = socialStats.stats_payload?.avg_comments || 0;
        const commentsVal = parseMultiplier(avgComments);
        if (commentsVal > 5) score += 10;
    }

    return Math.min(Math.max(Math.round(score), 0), 100);
}

/**
 * Calculates profile completion percentage (0-100)
 * Mirrors the web app's profileCompletion.ts logic
 */
export function calculateProfileCompletion(profile, socialStats) {
    if (!profile) return 0;

    const checks = [
        !!profile.full_name,
        !!profile.username,
        !!profile.avatar_url,
        !!profile.bio,
        !!profile.city,
        !!profile.category,
        !!socialStats, // Instagram connected
        !!(profile.social_links?.instagram || profile.social_links?.website),
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
}
