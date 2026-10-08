'use client'

import { useEffect, useState } from 'react'
import { getTotalUnreadCount } from '@/app/dashboard/messages/actions'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { ROOM_READ_EVENT } from '@/lib/room-reads'

// Okunmamış mesaj sayısı kenar çubuğunda tek yerden izlenir (dikey ve yatay menü
// aynı değeri kullanır; önceden her bağlantı aynı adlı ayrı bir kanal açıyordu).
export function useUnreadMessageCount() {
    const [unreadCount, setUnreadCount] = useState(0)

    useEffect(() => {
        const supabase = createSupabaseBrowserClient()
        const fetchCount = () => {
            getTotalUnreadCount().then(setUnreadCount).catch(() => {})
        }

        fetchCount()

        const channel = supabase
            .channel('global-messages-count')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchCount)
            .subscribe()

        // Bir oda okundu işaretlenince (lib/room-reads.ts) ve oturum açılınca yenilenir.
        window.addEventListener(ROOM_READ_EVENT, fetchCount)
        const {
            data: { subscription: authSub },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') fetchCount()
        })

        // Yedek yoklama
        const interval = setInterval(fetchCount, 30000)

        return () => {
            supabase.removeChannel(channel)
            window.removeEventListener(ROOM_READ_EVENT, fetchCount)
            authSub.unsubscribe()
            clearInterval(interval)
        }
    }, [])

    return unreadCount
}
