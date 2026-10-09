'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { toggleFavoriteAs } from '@/lib/favorites'

// Ortak kod: lib/favorites.ts (mobil /api/mobile/favorites ile aynı). Ücretsiz markada (bayrak açıkken) kilitli.
export async function toggleFavorite(influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    const result = await toggleFavoriteAs(supabase, user.id, influencerId)
    if (result.error !== undefined) return { error: result.error }

    revalidatePath('/dashboard/brand')
    revalidatePath('/dashboard/brand/favorites')
    return { success: true, isFavorited: result.isFavorited }
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
