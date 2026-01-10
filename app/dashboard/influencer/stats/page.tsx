import { createSupabaseServerClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import StatsHistory from '@/components/dashboard/StatsHistory'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Gelişim İstatistikleri | InfluMatch',
}

export default async function StatsPage() {
    const supabase = createSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    // Get social account
    const { data: socialAccount } = await supabase
        .from('social_accounts')
        .select('id')
        .eq('user_id', user.id)
        .single()

    if (!socialAccount) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center p-8 text-center text-gray-400">
                <h2 className="mb-2 text-xl font-bold text-white">Sosyal Medya Hesabı Bulunamadı</h2>
                <p>Gelişim grafiklerini görmek için önce Instagram hesabınızı bağlamanız gerekmektedir.</p>
            </div>
        )
    }

    // Get history
    const { data: history } = await supabase
        .from('social_account_history')
        .select('*')
        .eq('social_account_id', socialAccount.id)
        .order('recorded_at', { ascending: true })

    return (
        <div className="container mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
            <StatsHistory history={history || []} />
        </div>
    )
}
