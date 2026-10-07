'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

const LIST_NAME_MAX = 50

export async function createList(name: string) {
    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName) return { error: 'Liste adı boş olamaz.' }
    if (trimmedName.length > LIST_NAME_MAX) return { error: `Liste adı en fazla ${LIST_NAME_MAX} karakter olabilir.` }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Check if user is a verified brand
    const { data: profile } = await supabase
        .from('users')
        .select('role, verification_status')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'brand') {
        return { error: 'Sadece markalar liste oluşturabilir.' }
    }

    if (profile.verification_status !== 'verified') {
        return { error: 'Liste oluşturabilmek için hesabınızın doğrulanmış olması gerekmektedir.' }
    }

    const { data, error } = await supabase
        .from('favorite_lists')
        .insert({ brand_id: user.id, name: trimmedName })
        .select()
        .single()

    if (error) {
        console.error('[createList] error:', error)
        return { error: 'Liste oluşturulamadı.' }
    }
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

    if (error) {
        console.error('[deleteList] error:', error)
        return { error: 'Liste silinemedi.' }
    }
    revalidatePath('/dashboard/brand/favorites')
    return { success: true }
}

export async function toggleInList(listId: string, influencerId: string) {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Check if user is a verified brand
    const { data: profile } = await supabase
        .from('users')
        .select('role, verification_status')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'brand') {
        return { error: 'Sadece markalar bu işlemi yapabilir.' }
    }

    if (profile.verification_status !== 'verified') {
        return { error: 'Influencerları listeye eklemek için hesabınızın doğrulanmış olması gerekmektedir.' }
    }

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

        if (error) {
            console.error('[toggleInList] delete error:', error)
            return { error: 'Listeden çıkarılamadı.' }
        }
        return { added: false }
    } else {
        // Add
        const { error } = await supabase
            .from('favorite_list_items')
            .insert({ list_id: listId, influencer_id: influencerId })

        if (error) {
            console.error('[toggleInList] insert error:', error)
            return { error: 'Listeye eklenemedi.' }
        }
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

    // GÜVENLİK: Auth kontrolü ve sahiplik doğrulaması
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

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
