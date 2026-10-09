'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { areFavoritesLocked, createListAs, deleteListAs, toggleInListAs } from '@/lib/favorites'

// Yazımlar ortak kodda (lib/favorites.ts): doğrulanmış marka + ücretsiz markada (bayrak açıkken) kilit.

export async function createList(name: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const result = await createListAs(supabase, user.id, name)
    if (result.error !== undefined) return { error: result.error }
    revalidatePath('/dashboard/brand/favorites')
    return { data: result.data }
}

export async function deleteList(listId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const result = await deleteListAs(supabase, user.id, listId)
    if (result.error !== undefined) return { error: result.error }
    revalidatePath('/dashboard/brand/favorites')
    return { success: true }
}

export async function toggleInList(listId: string, influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const result = await toggleInListAs(supabase, user.id, listId, influencerId)
    if (result.error !== undefined) return { error: result.error }
    return { added: result.added }
}

export async function getInfluencerLists(influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    if (await areFavoritesLocked(user.id)) return []

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

    // GÜVENLİK: Auth kontrolü ve sahiplik doğrulaması
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    if (await areFavoritesLocked(user.id)) return []

    // Listenin bu kullanıcıya ait olduğunu doğrula
    const { data: list } = await supabase
        .from('favorite_lists')
        .select('id')
        .eq('id', listId)
        .eq('brand_id', user.id)
        .maybeSingle()

    if (!list) return [] // Liste mevcut değil ya da bu kullanıcıya ait değil

    const { data } = await supabase
        .from('favorite_list_items')
        .select('influencer_id')
        .eq('list_id', listId)

    return data?.map(d => d.influencer_id) || []
}
