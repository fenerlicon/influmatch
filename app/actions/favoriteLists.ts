'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createList(name: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
        .from('favorite_lists')
        .insert({ brand_id: user.id, name })
        .select()
        .single()

    if (error) return { error: error.message }
    revalidatePath('/dashboard/brand/favorites')
    return { data }
}

export async function deleteList(listId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
        .from('favorite_lists')
        .delete()
        .eq('id', listId)
        .eq('brand_id', user.id)

    if (error) return { error: error.message }
    revalidatePath('/dashboard/brand/favorites')
    return { success: true }
}

export async function getLists() {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
        .from('favorite_lists')
        .select('*')
        .eq('brand_id', user.id)
        .order('created_at', { ascending: true })

    return data || []
}

export async function toggleInList(listId: string, influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Check if exists
    const { data: existing } = await supabase
        .from('favorite_list_items')
        .select('id')
        .eq('list_id', listId)
        .eq('influencer_id', influencerId)
        .maybeSingle()

    if (existing) {
        // Remove
        const { error } = await supabase
            .from('favorite_list_items')
            .delete()
            .eq('id', existing.id)

        if (error) return { error: error.message }
        return { added: false }
    } else {
        // Add
        // First ensure global favorite exists? No, independent logic or auto-add?
        // Let's keep them independent as per schema, BUT UI usually auto-hearts if added to list.
        // For now, independent.
        const { error } = await supabase
            .from('favorite_list_items')
            .insert({ list_id: listId, influencer_id: influencerId })

        if (error) return { error: error.message }
        return { added: true }
    }
}

export async function getInfluencerLists(influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Get all lists for user
    const { data: lists } = await supabase
        .from('favorite_lists')
        .select('id, name')
        .eq('brand_id', user.id)

    if (!lists) return []

    // Check which ones contain influencer
    const { data: items } = await supabase
        .from('favorite_list_items')
        .select('list_id')
        .eq('influencer_id', influencerId)
        .in('list_id', lists.map(l => l.id))

    const includedListIds = new Set(items?.map(i => i.list_id))

    return lists.map(list => ({
        ...list,
        hasInfluencer: includedListIds.has(list.id)
    }))
}

export async function getListItems(listId: string) {
    const supabase = createSupabaseServerClient()
    const { data } = await supabase.from('favorite_list_items').select('influencer_id').eq('list_id', listId)
    return data?.map(d => d.influencer_id) || []
}
