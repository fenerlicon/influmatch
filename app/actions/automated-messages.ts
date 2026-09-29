'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'

/**
 * Sends an internal notification to a user.
 */
export async function sendNotification(
    userId: string,
    title: string,
    message: string,
    type: 'system' | 'info' | 'warning' | 'success' = 'info',
    link?: string
) {
    const supabase = createSupabaseServerClient()
    const adminSupabase = createSupabaseAdminClient() || supabase

    // Security Check: Only the user themselves OR an Admin can trigger a notification to this userId.
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return; // Prevent entirely unauthenticated requests
    
    const isTargetingSelf = authUser.id === userId;
    const { data: adminCheck } = await supabase.from('users').select('role').eq('id', authUser.id).single();
    const isAdmin = adminCheck?.role === 'admin';
    
    if (!isTargetingSelf && !isAdmin) {
        console.warn(`[Security] Unauthorized notification attempt by ${authUser.id} to ${userId}`);
        return; // Reject unauthorized notification requests
    }

    const { error } = await adminSupabase
        .from('notifications')
        .insert({
            user_id: userId,
            title,
            message,
            type,
            link,
            is_read: false,
            created_at: new Date().toISOString()
        })

    if (error) {
        console.error('[sendNotification] Error creating notification:', error)
    }
}

/**
 * Specifically sends the Spotlight Activation notification.
 */
export async function sendSpotlightNotification(userId: string, isActive: boolean) {
    if (!isActive) return // We might not want to notify when turned OFF, or maybe we do? User said "when active".

    await sendNotification(
        userId,
        'Spotlight Üyeliğiniz Aktifleşti! ✨',
        'Tebrikler! Profiliniz artık Vitrin sayfasında markalar tarafından öncelikli olarak görünüyor. Bol şans!',
        'success',
        '/dashboard/influencer/spotlight'
    )
}
