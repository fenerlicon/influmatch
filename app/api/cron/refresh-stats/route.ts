import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { refreshStaleAccounts } from '@/lib/social-stats'

// Vercel Hobby fonksiyon sınırı.
export const maxDuration = 60
// Apify koşusu 45 sn sürebilir; 60 sn fonksiyon sınırının altında kalmak için yeni koşu en geç 10. saniyede başlar.
const START_BUDGET_MS = 10_000

/**
 * BU API UCU HER GÜN VERCEL CRON TARAFINDAN ÇALIŞTIRILIR (vercel.json).
 * Verisi 3 günden eski doğrulanmış hesapları en eskiden başlayarak, zaman bütçesi içinde yeniler.
 * Aynı iş saatlik görevde de (/api/cron/hourly) küçük parçalar halinde yapılır.
 *
 * Vercel, CRON_SECRET ortam değişkeni tanımlıysa isteğe otomatik olarak
 * "Authorization: Bearer <CRON_SECRET>" ekler. Başka hiçbir header'a güvenilmez.
 */
export async function GET(req: Request) {
    const startedAt = Date.now()
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return new NextResponse('Unauthorized', { status: 401 })
    }

    const supabase = createSupabaseAdminClient()
    if (!supabase) {
        return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY eksik.' }, { status: 500 })
    }

    try {
        const report = await refreshStaleAccounts(supabase, { deadline: startedAt + START_BUDGET_MS })
        return NextResponse.json({ message: 'Sync completed', ...report })
    } catch (error) {
        console.error('[Auto-Sync] Failed:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 })
    }
}
