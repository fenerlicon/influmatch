
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
    const supabaseAdmin = createSupabaseAdminClient()
    if (!supabaseAdmin) {
        return NextResponse.json({ error: 'No admin client' }, { status: 500 })
    }

    // 1. Find User @fkn
    const { data: targetUser, error: findError } = await supabaseAdmin
        .from('users')
        .select('id, full_name')
        .eq('username', 'fkn') // Aranan username
        .single()

    if (findError || !targetUser) {
        return NextResponse.json({ error: 'User @fkn not found', details: findError }, { status: 404 })
    }

    // 2. Find Admin User
    const { data: adminUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle()

    if (!adminUser) {
        return NextResponse.json({ error: 'Admin user not found in DB' }, { status: 404 })
    }

    const userId = targetUser.id
    const userName = targetUser.full_name || 'Kullanıcı'
    const adminId = adminUser.id

    if (userId === adminId) {
        return NextResponse.json({ error: 'User is admin itself' }, { status: 400 })
    }

    // 3. Check/Create Room
    const { data: userRooms } = await supabaseAdmin
        .from('room_participants')
        .select('room_id')
        .eq('user_id', userId)

    let roomId = null

    if (userRooms && userRooms.length > 0) {
        const roomIds = userRooms.map((r: any) => r.room_id)
        const { data: commonRoom } = await supabaseAdmin
            .from('room_participants')
            .select('room_id')
            .eq('user_id', adminId)
            .in('room_id', roomIds)
            .limit(1)
            .maybeSingle()

        if (commonRoom) {
            roomId = commonRoom.room_id
        }
    }

    if (!roomId) {
        const { data: newRoom, error: roomError } = await supabaseAdmin
            .from('rooms')
            .insert({ created_by: adminId })
            .select()
            .single()

        if (roomError || !newRoom) {
            return NextResponse.json({ error: 'Failed to create room', details: roomError }, { status: 500 })
        }
        roomId = newRoom.id

        await supabaseAdmin.from('room_participants').insert([
            { room_id: roomId, user_id: adminId },
            { room_id: roomId, user_id: userId }
        ])
    }

    // 4. Send Message
    const messageContent = `Merhaba ${userName}, Influmatch'e hoş geldin! 🎉\n\nMarkalar ve influencerlar arasında köprü kurarak işbirliklerini kolaylaştıran platformumuzda seni görmek harika.\n\nProfilini eksiksiz doldurman, rozetler kazanmanı ve daha fazla etkileşim almanı sağlayacaktır. Herhangi bir sorunda veya desteğe ihtiyacın olduğunda bu sohbet üzerinden bize ulaşabilirsin.\n\nBaşarılar dileriz!`

    const { error: msgError } = await supabaseAdmin.from('messages').insert({
        room_id: roomId,
        sender_id: adminId,
        content: messageContent,
        read: false
    })

    if (msgError) {
        return NextResponse.json({ error: 'Failed to send message', details: msgError }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Message sent', userId, roomId })
}
