'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function toggleFavorite(influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return { error: 'Unauthorized' }
    }

    // Check if user is a brand (Security fix)
    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'brand') {
        return { error: 'Sadece markalar favorilere ekleme yapabilir.' }
    }

    // Tüm eşleşen satırlar okunur: .single() birden fazla satırda hata verip kaydı "yok" sanıyor
    // ve yeni bir kopya ekliyordu (çift tıklama vb.).
    const { data: existing, error: checkError } = await supabase
        .from('favorites')
        .select('id')
        .eq('brand_id', user.id)
        .eq('influencer_id', influencerId)

    if (checkError) return { error: checkError.message }

    if (existing && existing.length > 0) {
        // Remove
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('brand_id', user.id)
            .eq('influencer_id', influencerId)

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

        // 23505: aynı anda gelen ikinci istek; kayıt zaten var.
        if (error && error.code !== '23505') return { error: error.message }

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
