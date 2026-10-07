'use client'

import { useEffect, useState } from 'react'
import { getTotalUnreadCount } from '@/app/dashboard/messages/actions'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'

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

        // Okundu bilgisi kullanıcı meta verisinde tutulduğu için oturum güncellemelerinde de yenilenir.
        const {
            data: { subscription: authSub },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'USER_UPDATED' || event === 'SIGNED_IN') fetchCount()
        })

        // Yedek yoklama
        const interval = setInterval(fetchCount, 30000)

        return () => {
            supabase.removeChannel(channel)
            authSub.unsubscribe()
            clearInterval(interval)
        }
    }, [])

    return unreadCount
}
