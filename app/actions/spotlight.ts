'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { DiscoverInfluencer } from '@/types/influencer'

export async function getSimilarInfluencers(baseInfluencerId: string): Promise<{ data: DiscoverInfluencer[], error: string | null }> {
    const supabase = createSupabaseServerClient()

    // 1. Get Base Influencer Data
    const { data: baseUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', baseInfluencerId)
        .single()

    if (fetchError || !baseUser) {
        return { data: [], error: 'Referans profil bulunamadı' }
    }

    // Parse stats
    let followerCount = 0
    if (baseUser.instagram_stats?.followers) {
        const raw = baseUser.instagram_stats.followers.toString().toUpperCase()
        if (raw.includes('K')) followerCount = parseFloat(raw) * 1000
        else if (raw.includes('M')) followerCount = parseFloat(raw) * 1000000
        else followerCount = parseFloat(raw)
    }

    const minFollowers = followerCount * 0.7 // Tighter range (+/- 30%)
    const maxFollowers = followerCount * 1.3

    // 2. Find Similars
    // Logic: Same Category AND Similar Follower Count (+/- 30%) AND Showcase Visible
    let query = supabase
        .from('users')
        .select('*')
        .neq('id', baseInfluencerId) // Exclude self
        .eq('role', 'influencer')
        .eq('is_showcase_visible', true) // Only visible profiles
        .order('spotlight_active', { ascending: false }) // Prioritize Spotlight members
        .limit(5) // Fetch a few more to filter down

    // Category Filter
    if (baseUser.category) {
        query = query.eq('category', baseUser.category)
    }

    const { data: similars, error: searchError } = await query

    if (searchError) {
        return { data: [], error: 'Benzer profiller aranırken hata oluştu' }
    }

    // Filter by follower count manually (since stored as JSON/string often, hard to SQL filter efficiently without casting)
    // For production, this should be done in SQL with computed columns.
    const filtered = (similars || []).filter((u: any) => {
        let count = 0
        if (u.instagram_stats?.followers) {
            const r = u.instagram_stats.followers.toString().toUpperCase()
            if (r.includes('K')) count = parseFloat(r) * 1000
            else if (r.includes('M')) count = parseFloat(r) * 1000000
            else count = parseFloat(r)
        }
        return count >= minFollowers && count <= maxFollowers
    })

    // Map to DiscoverInfluencer type
    const enriched: DiscoverInfluencer[] = filtered.slice(0, 3).map((u: any) => ({ // Return top 3 matches
        id: u.id,
        full_name: u.full_name,
        username: u.username,
        category: u.category,
        avatar_url: u.avatar_url,
        spotlight_active: u.spotlight_active,
        verification_status: u.verification_status,
        stats: u.instagram_stats ? {
            followers: u.instagram_stats.followers || '0',
            engagement: u.instagram_stats.engagement || '0%',
            avg_likes: u.instagram_stats.avg_likes,
            avg_comments: u.instagram_stats.avg_comments
        } : undefined,
        displayed_badges: u.displayed_badges // Assuming this column exists or needs join
    }))

    // If filtration removed too many, fallback to just category match or spotlight
    if (enriched.length === 0 && similars?.length) {
        // Fallback: return the category matches even if follower count is off
        return {
            data: similars.slice(0, 3).map((u: any) => ({
                id: u.id,
                full_name: u.full_name,
                username: u.username,
                category: u.category,
                avatar_url: u.avatar_url,
                spotlight_active: u.spotlight_active,
                verification_status: u.verification_status,
                stats: u.instagram_stats ? {
                    followers: u.instagram_stats.followers || '0',
                    engagement: u.instagram_stats.engagement || '0%',
                    avg_likes: u.instagram_stats.avg_likes,
                    avg_comments: u.instagram_stats.avg_comments
                } : undefined
            })),
            error: null
        }
    }

    return { data: enriched, error: null }
}

export async function activateSpotlightPlan(
    userId: string,
    planTier: 'ibasic' | 'ipro' | 'mbasic' | 'mpro',
    interval: 'mo' | 'yr'
): Promise<{ success: boolean; error: string | null }> {
    const supabase = createSupabaseServerClient()

    // calculate expiration
    const now = new Date()
    let expiresAt = new Date(now)

    if (interval === 'mo') {
        expiresAt.setDate(expiresAt.getDate() + 30) // 30 days for monthly
    } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1) // 1 year for yearly
    }

    // Update user
    const { error } = await supabase
        .from('users')
        .update({
            spotlight_active: true,
            spotlight_plan: planTier,
            spotlight_expires_at: expiresAt.toISOString()
        })
        .eq('id', userId)

    if (error) {
        console.error('Error activating spotlight:', error)
        return { success: false, error: 'Üyelik aktifleştirilemedi.' }
    }

    return { success: true, error: null }
}

export async function checkSpotlightStatus(userId: string): Promise<void> {
    const supabase = createSupabaseServerClient()

    const { data } = await supabase
        .from('users')
        .select('spotlight_active, spotlight_expires_at')
        .eq('id', userId)
        .single()

    if (data && data.spotlight_active && data.spotlight_expires_at) {
        const expires = new Date(data.spotlight_expires_at)
        if (expires < new Date()) {
            await supabase
                .from('users')
                .update({ spotlight_active: false })
                .eq('id', userId)
        }
    }
}


