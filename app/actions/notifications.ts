'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type NotificationType = 'system' | 'info' | 'warning' | 'success'

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

    try {
        const notifications = userIds.map((userId) => ({
            user_id: userId,
            title,
            message,
            type,
            link,
        }))

        const { error } = await supabase.from('notifications').insert(notifications)

        if (error) {
            console.error('Error sending notifications:', error)
            return { success: false, error: error.message }
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
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId)
            .eq('user_id', user.id) // IDOR koruması

        if (error) {
            console.error('Error marking notification as read:', error)
            return { success: false, error: error.message }
        }

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
        const { error } = await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (error) {
            console.error('Error marking all notifications as read:', error)
            return { success: false, error: error.message }
        }

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
