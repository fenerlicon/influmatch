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
        // GÜVENLİK: Sadece oturum açmış kullanıcılar (özellikle Brand rolündekiler) veri basabilmeli.
        // brandId dışarıdan gelse bile, bunu atan kişinin o brandId olduğundan emin olmalıyız? 
        // Genellikle ANALYTICS brand tarafından tetiklenir (izleme).
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: 'Unauthorized' }

        const { error } = await supabase.rpc('track_analytics_event', {
            p_event_type: eventType,
            p_target_id: targetId,
            p_brand_id: brandId,
            p_meta: { ...meta, trigger_user_id: user.id },
        })

        if (error) {
            console.error('Error tracking analytics event via RPC:', error)
            const { error: insertError } = await supabase.from('analytics_events').insert({
                event_type: eventType,
                target_id: targetId,
                brand_id: brandId,
                meta: { ...meta, trigger_user_id: user.id },
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

    // GÜVENLİK: Bir marka sadece KENDİ istatistiklerini görebilir. 
    // Başkasının brandId'sini yollayarak onun verilerini çalmaya çalışanlara engel oluyoruz.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== brandId) {
        return { success: false, data: [], error: 'Sadece kendi istatistiklerinizi görüntüleyebilirsiniz.' }
    }

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
