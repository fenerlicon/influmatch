'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'

export type AnalyticsEventType = 'view_advert' | 'click_profile' | 'view_profile'

export async function trackEvent(
    eventType: AnalyticsEventType,
    targetId: string,
    brandId: string,
    meta: Record<string, any> = {}
) {
    const supabase = createSupabaseServerClient()

    try {
        const { error } = await supabase.rpc('track_analytics_event', {
            p_event_type: eventType,
            p_target_id: targetId,
            p_brand_id: brandId,
            p_meta: meta,
        })

        if (error) {
            console.error('Error tracking analytics event via RPC:', error)
            // Fallback to direct insert if RPC fails or not found (though user applied migration)
            const { error: insertError } = await supabase.from('analytics_events').insert({
                event_type: eventType,
                target_id: targetId,
                brand_id: brandId,
                meta,
            })

            if (insertError) {
                console.error('Error tracking analytics event via insert:', insertError)
                return { success: false, error: insertError.message }
            }
        }

        return { success: true }
    } catch (error) {
        console.error('Error in trackEvent:', error)
        return { success: false, error: 'Internal Server Error' }
    }
}

export async function getAnalyticsStats(brandId: string, timeRange: '7d' | '30d' = '7d') {
    const supabase = createSupabaseServerClient()

    // Calculate date filter
    const date = new Date()
    date.setDate(date.getDate() - (timeRange === '7d' ? 7 : 30))
    const startDate = date.toISOString()

    const { data, error } = await supabase
        .from('analytics_events')
        .select('event_type, created_at, target_id')
        .eq('brand_id', brandId)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })

    if (error) {
        console.error('Error fetching analytics:', error)
        return { success: false, data: [] }
    }

    return { success: true, data }
}
