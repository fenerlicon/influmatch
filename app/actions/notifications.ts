'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { markNotificationsReadAs } from '@/lib/notification-reads'

export type NotificationType = 'system' | 'info' | 'warning' | 'success'

const MAX_RECIPIENTS = 5000
const INSERT_CHUNK = 500

export async function sendNotification(
    userIds: string[],
    title: string,
    message: string,
    type: NotificationType = 'info',
    link?: string
) {
    const supabase = createSupabaseServerClient()

    // GÜVENLİK: Sadece adminler bildirim gönderebilir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Yetkisiz erişim.' }

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'admin') {
        return { success: false, error: 'Sadece admin yetkisi olanlar bildirim gönderebilir.' }
    }

    const cleanTitle = title?.trim() ?? ''
    const cleanMessage = message?.trim() ?? ''
    if (!cleanTitle || cleanTitle.length > 120) {
        return { success: false, error: 'Başlık 1-120 karakter olmalı.' }
    }
    if (!cleanMessage || cleanMessage.length > 1000) {
        return { success: false, error: 'Mesaj 1-1000 karakter olmalı.' }
    }
    if (!['system', 'info', 'warning', 'success'].includes(type)) {
        return { success: false, error: 'Geçersiz bildirim türü.' }
    }
    // Bağlantı yalnızca site içi bir yol olabilir (dış adres veya javascript: kabul edilmez).
    const cleanLink = link?.trim() || null
    if (cleanLink && (!cleanLink.startsWith('/') || cleanLink.startsWith('//') || /[\s<>"']/.test(cleanLink))) {
        return { success: false, error: 'Bağlantı site içi bir yol olmalı (ör. /dashboard/offers).' }
    }
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const recipients = Array.from(new Set(userIds)).filter((id) => uuidPattern.test(id))
    if (recipients.length === 0) {
        return { success: false, error: 'Alıcı seçilmedi.' }
    }
    if (recipients.length > MAX_RECIPIENTS) {
        return { success: false, error: `Tek seferde en fazla ${MAX_RECIPIENTS} kişiye gönderilebilir.` }
    }

    try {
        for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
            const notifications = recipients.slice(i, i + INSERT_CHUNK).map((userId) => ({
                user_id: userId,
                title: cleanTitle,
                message: cleanMessage,
                type,
                link: cleanLink,
            }))

            const { error } = await supabase.from('notifications').insert(notifications)

            if (error) {
                console.error('Error sending notifications:', error)
                return {
                    success: false,
                    error: i === 0 ? 'Bildirim gönderilemedi.' : `Bildirim ${i} kişiye gönderildi, kalanlar gönderilemedi.`,
                }
            }
        }

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Exception sending notifications:', error)
        return { success: false, error: 'Bir hata oluştu' }
    }
}

export async function getNotifications(userId: string) {
    const supabase = createSupabaseServerClient()

    // GÜVENLİK: Kullanıcı sadece kendi bildirimlerini alabilir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
        return { success: false, error: 'Yetkisiz erişim.', data: [] }
    }

    try {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20)

        if (error) {
            console.error('Error fetching notifications:', error)
            return { success: false, error: error.message, data: [] }
        }

        return { success: true, data }
    } catch (error) {
        console.error('Exception fetching notifications:', error)
        return { success: false, error: 'Bir hata oluştu', data: [] }
    }
}

export async function markNotificationAsRead(notificationId: string) {
    const supabase = createSupabaseServerClient()

    // GÜVENLİK: IDOR fix — sadece kendi bildirimine işlem yapabilir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Yetkisiz erişim.' }

    try {
        // Ortak kod (lib/notification-reads.ts); mobil uç da aynısını kullanır.
        const result = await markNotificationsReadAs(supabase, user.id, [notificationId])
        if (!result.success) return result

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Exception marking notification as read:', error)
        return { success: false, error: 'Bir hata oluştu' }
    }
}

export async function markAllNotificationsAsRead(userId: string) {
    const supabase = createSupabaseServerClient()

    // GÜVENLİK: Kullanıcı sadece kendi bildirimlerini okundu işaretleyebilir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
        return { success: false, error: 'Yetkisiz erişim.' }
    }

    try {
        const result = await markNotificationsReadAs(supabase, user.id)
        if (!result.success) return result

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Exception marking all notifications as read:', error)
        return { success: false, error: 'Bir hata oluştu' }
    }
}

export async function deleteNotification(notificationId: string) {
    const supabase = createSupabaseServerClient()

    // GÜVENLİK: IDOR fix — sadece kendi bildirimine işlem yapabilir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Yetkisiz erişim.' }

    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', user.id) // IDOR koruması

        if (error) {
            console.error('Error deleting notification:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Exception deleting notification:', error)
        return { success: false, error: 'Bir hata oluştu' }
    }
}

export async function deleteAllNotifications(userId: string) {
    const supabase = createSupabaseServerClient()

    // GÜVENLİK: Kullanıcı sadece kendi bildirimlerini silebilir
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
        return { success: false, error: 'Yetkisiz erişim.' }
    }

    try {
        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', userId)

        if (error) {
            console.error('Error deleting all notifications:', error)
            return { success: false, error: error.message }
        }

        revalidatePath('/dashboard')
        return { success: true }
    } catch (error) {
        console.error('Exception deleting all notifications:', error)
        return { success: false, error: 'Bir hata oluştu' }
    }
}
