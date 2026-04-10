
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyInstagramAccount } from '@/app/actions/social-verification'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * BU API UCU HER GECE OTOMATİK OLARAK ÇALIŞTIRILMAK İÇİN TASARLANDI.
 * Tüm influencer'ları tarar ve verisi 3 günden eski olanları günceller.
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const authHeader = req.headers.get('authorization')
    const vercelCronHeader = req.headers.get('x-vercel-cron')

    // Güvenlik: Sadece gizli bir token ile veya Vercel'in kendi Cron servisiyle çalışır
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && vercelCronHeader !== 'true') {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Verisi bugün saat 09:00'dan önce güncellenmiş (veya hiç güncellenmemiş) Instagram hesaplarını bul
    const todayNineAM = new Date()
    todayNineAM.setUTCHours(9, 0, 0, 0)

    const { data: staleAccounts, error } = await supabase
        .from('social_accounts')
        .select('user_id, username')
        .eq('platform', 'instagram')
        .eq('is_verified', true)
        .or(`last_scraped_at.lt.${todayNineAM.toISOString()},last_scraped_at.is.null`)
        .limit(100); 

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    console.log(`[Auto-Sync] Found ${staleAccounts.length} accounts to refresh.`)

    const results = []
    for (const account of staleAccounts) {
        try {
            // Mevcut verifyInstagramAccount fonksiyonumuzu çağırıyoruz.
            // Bu fonksiyon zaten 21 gün kuralına göre güncellendi!
            const result = await verifyInstagramAccount(account.user_id)
            results.push({ username: account.username, status: result.success ? 'success' : 'failed' })
        } catch (err) {
            results.push({ username: account.username, status: 'error' })
        }
    }

    return NextResponse.json({
        message: 'Sync completed',
        processed: staleAccounts.length,
        results
    })
}
