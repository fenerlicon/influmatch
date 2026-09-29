import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { refreshInstagramAccount, refreshTikTokAccount } from '@/lib/social-stats'

/**
 * BU API UCU HER GÜN VERCEL CRON TARAFINDAN ÇALIŞTIRILIR (vercel.json).
 * Doğrulanmış hesaplardan verisi bugün 09:00 UTC'den eski olanları günceller.
 *
 * Vercel, CRON_SECRET ortam değişkeni tanımlıysa isteğe otomatik olarak
 * "Authorization: Bearer <CRON_SECRET>" ekler. Başka hiçbir header'a güvenilmez.
 */
export async function GET(req: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = createSupabaseAdminClient()
    if (!supabase) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY eksik.' }, { status: 500 })
    }

    const todayNineAM = new Date()
    todayNineAM.setUTCHours(9, 0, 0, 0)

    const { data: staleAccounts, error } = await supabase
        .from('social_accounts')
        .select('user_id, username, platform')
        .in('platform', ['instagram', 'tiktok'])
        .eq('is_verified', true)
        .or(`last_scraped_at.lt.${todayNineAM.toISOString()},last_scraped_at.is.null`)
        .order('last_scraped_at', { ascending: true, nullsFirst: true })
        .limit(100)

    if (error) {
        console.error('[Auto-Sync] Query error:', error)
        return NextResponse.json({ error: 'Hesaplar alınamadı.' }, { status: 500 })
    }

    console.log(`[Auto-Sync] Found ${staleAccounts.length} accounts to refresh.`)

    const results = []
    for (const account of staleAccounts) {
        try {
            const result = account.platform === 'tiktok'
                ? await refreshTikTokAccount(account.user_id)
                : await refreshInstagramAccount(account.user_id)
            results.push({ username: account.username, platform: account.platform, status: result.success ? 'success' : 'failed' })
        } catch (err) {
            console.error(`[Auto-Sync] ${account.platform}/${account.username} failed:`, err)
            results.push({ username: account.username, platform: account.platform, status: 'error' })
        }
    }

    return NextResponse.json({
        message: 'Sync completed',
        processed: staleAccounts.length,
        results
    })
}
