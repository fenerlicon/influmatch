'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleFavorite(influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Check if already favorited
    const { data: existing, error: checkError } = await supabase
        .from('favorites')
        .select('id')
        .eq('brand_id', user.id)
        .eq('influencer_id', influencerId)
        .single()

    if (existing) {
        // Remove
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('id', existing.id)

        if (error) return { error: error.message }

        revalidatePath('/dashboard/brand')
        revalidatePath('/dashboard/brand/favorites')
        return { success: true, isFavorited: false }
    } else {
        // Add
        const { error } = await supabase
            .from('favorites')
            .insert({
                brand_id: user.id,
                influencer_id: influencerId
            })

        if (error) return { error: error.message }

        revalidatePath('/dashboard/brand')
        revalidatePath('/dashboard/brand/favorites')
        return { success: true, isFavorited: true }
    }
}

export async function getFavoriteCount(influencerId: string) {
    const supabase = createSupabaseServerClient()

    const { count, error } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('influencer_id', influencerId)

    if (error) {
        console.error('Error fetching favorite count:', error)
        return 0
    }

    return count || 0
}
