// Yeni kullanıcıya destek hesabından hoş geldin mesajı gönderir.
// 'use server' DEĞİLDİR: istemciden çağrılamaz, sadece kimliği doğrulanmış
// server action'lar (onboarding) tarafından kullanılır.

import { createSupabaseAdminClient } from '@/utils/supabase/admin'

// Gönderen: platformun admin hesabı (role = 'admin', en eski). Eskiden var olmayan
// destek@influmatch.net adresi aranıyordu; hoş geldin mesajı hiç gönderilmiyordu.

/**
 * Sends a welcome message to a newly registered user from the Admin.
 */
export async function sendWelcomeMessage(userId: string, userRole: 'brand' | 'influencer') {
    const adminSupabase = createSupabaseAdminClient()
    if (!adminSupabase) {
        console.warn('[sendWelcomeMessage] Admin client not available. Skipping welcome message.')
        return
    }

    // 1. Find Admin User ID
    const { data: adminUser } = await adminSupabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

    if (!adminUser || adminUser.id === userId) {
        console.warn('[sendWelcomeMessage] Admin user not found. Skipping welcome message.')
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
                content: messageContent,
                created_at: new Date().toISOString()
            })

        if (msgError) {
            console.error('[sendWelcomeMessage] Error sending message:', msgError)
        }
    }
}
