import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'

export default async function DashboardPage() {
    const supabase = createSupabaseServerClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Default to influencer if role is missing
    const role = user.user_metadata?.role || 'influencer'

    if (role === 'brand') {
        redirect('/dashboard/brand')
    } else if (role === 'admin') {
        redirect('/admin')
    } else {
        // Redirect influencers and any other roles to influencer dashboard for now
        redirect('/dashboard/influencer')
    }
}
