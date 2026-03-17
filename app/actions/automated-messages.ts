'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { v4 as uuidv4 } from 'uuid'

const ADMIN_EMAIL = 'destek@influmatch.net'

/**
 * Sends a welcome message to a newly registered user from the Admin.
 */
export async function sendWelcomeMessage(userId: string, userRole: 'brand' | 'influencer') {
    const supabase = createSupabaseServerClient()
    const adminSupabase = createSupabaseAdminClient() || supabase

    // 1. Find Admin User ID
    const { data: adminUser } = await adminSupabase
        .from('users')
        .select('id')
        .eq('email', ADMIN_EMAIL)
        .maybeSingle()

    if (!adminUser) {
        console.warn(`[sendWelcomeMessage] Admin user (${ADMIN_EMAIL}) not found. Skipping welcome message.`)
        return
    }

    const adminId = adminUser.id

    // 2. Determine Message Content based on Role
    let messageContent = ''
    if (userRole === 'influencer') {
        messageContent = `Merhaba! Influmatch'e hoş geldin. 🚀

Profilini oluşturarak markaların dikkatini çekmeye başlayabilirsin. Profil doluluk oranını %100'e getirmen, Spotlight vitrinine çıkarak görünürlüğünü artırman için çok önemli.

Herhangi bir sorun olursa buradan bize yazabilirsin. Başarılar dileriz!`
    } else {
        messageContent = `Merhaba! Influmatch'e hoş geldin. 🚀

Markan için en doğru influencer'ları bulmak artık çok kolay. "Keşfet" sayfasından influencer'ları inceleyebilir, beğendiklerine teklif gönderebilirsin.

Herhangi bir sorun olursa veya desteğe ihtiyacın olursa buradan bize ulaşabilirsin. İyi çalışmalar!`
    }

    // 3. Create or Get Room
    // Check if room already exists (unlikely for new user, but good practice)
    const { data: existingRoom } = await adminSupabase
        .from('rooms')
        .select('id')
        .or(`and(brand_id.eq.${adminId},influencer_id.eq.${userId}),and(brand_id.eq.${userId},influencer_id.eq.${adminId})`)
        .maybeSingle()

    let roomId = existingRoom?.id

    if (!roomId) {
        // Create new room
        // Note: 'brand_id' and 'influencer_id' logic in `rooms` table might strictly require one brand and one influencer.
        // If Admin is a 'brand' or 'admin' role, we need to fit it into the schema.
        // Assuming Admin can act as 'brand_id' or we just pick slots based on ID.
        // For simplicity if Admin is global, we might need to adjust, but let's try strict mapping.

        // Let's assume Admin is just another user. If schema enforces role, we might face issues.
        // Usually chat systems allow any two users. Let's assume `rooms` table has `brand_id` and `influencer_id` columns.
        // If the NEW user is Influencer -> brand_id = Admin, influencer_id = User
        // If the NEW user is Brand -> brand_id = User, influencer_id = Admin

        const isUserInfluencer = userRole === 'influencer'
        const brandId = isUserInfluencer ? adminId : userId
        const influencerId = isUserInfluencer ? userId : adminId

        const { data: newRoom, error: roomError } = await adminSupabase
            .from('rooms')
            .insert({
                brand_id: brandId,
                influencer_id: influencerId,
                last_message_at: new Date().toISOString()
            })
            .select('id')
            .single()

        if (roomError) {
            console.error('[sendWelcomeMessage] Error creating room:', roomError)
            return
        }
        roomId = newRoom.id
    }

    // 4. Send Message
    if (roomId) {
        const { error: msgError } = await adminSupabase
            .from('messages')
            .insert({
                room_id: roomId,
                sender_id: adminId,
                receiver_id: userId,
                content: messageContent,
                is_read: false,
                created_at: new Date().toISOString()
            })

        if (msgError) {
            console.error('[sendWelcomeMessage] Error sending message:', msgError)
        }
    }
}

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
