export const revalidate = 0

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { buildWeeklyCreatorSummary, renderWeeklyCreatorEmail } from '@/lib/weekly-summary'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Haftalık özet e-postası önizlemesi (yalnızca admin; 4.3-S7). Gönderim YOK: haftalık e-postalar Resend ücretli planı bekliyor.
 * ?user=<kimlik ya da kullanıcı adı>, &pro=1 Pro olmayan hesapta detaylı bölümü dener.
 */
export default async function WeeklyPreviewPage({ searchParams }: { searchParams?: { user?: string; pro?: string } }) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: adminProfile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (adminProfile?.role !== 'admin') redirect('/dashboard')

  const query = typeof searchParams?.user === 'string' ? searchParams.user.trim().replace(/^@/, '') : ''
  const forcePro = searchParams?.pro === '1'
  let error: string | null = null
  let email: ReturnType<typeof renderWeeklyCreatorEmail> | null = null
  let pro = false

  if (query) {
    const admin = createSupabaseAdminClient()
    if (!admin) throw new Error('Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.')
    const { data: target } = UUID_RE.test(query)
      ? await admin.from('users').select('id').eq('id', query).maybeSingle()
      : await admin.from('users').select('id').eq('username', query.toLowerCase()).maybeSingle()
    if (!target) {
      error = 'Kullanıcı bulunamadı.'
    } else {
      try {
        const summary = await buildWeeklyCreatorSummary(target.id as string, { forceDetailed: forcePro })
        if (!summary) error = 'Haftalık özet yalnızca influencer/UGC hesapları için.'
        else {
          pro = summary.pro
          email = renderWeeklyCreatorEmail(summary)
        }
      } catch (e) {
        console.error('[admin/weekly-preview]', e)
        error = 'Özet hazırlanamadı.'
      }
    }
  }

  return (
    <div className="space-y-6 text-white">
      <header className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h1 className="text-2xl font-semibold">Haftalık özet önizleme</h1>
        <p className="mt-2 text-sm text-gray-300">
          Influencer/UGC haftalık özet e-postasının görünümü. <strong>Gönderim kapalı</strong>: haftalık e-postalar Resend ücretli planına
          geçilince açılacak. Detaylı bölüm (profil görüntülenme, haftanın ölçülen gönderileri) Influencer Pro içindir.
        </p>
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-400">
            Kullanıcı (kimlik ya da kullanıcı adı)
            <input
              name="user"
              defaultValue={query}
              className="mt-1 block w-72 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white outline-none focus:border-soft-gold/60"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" name="pro" value="1" defaultChecked={forcePro} /> Pro görünümünü dene
          </label>
          <button type="submit" className="rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold">
            Önizle
          </button>
        </form>
      </header>

      {error && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>}

      {email && (
        <section className="space-y-4">
          <p className="text-sm text-gray-400">
            Konu: <span className="text-white">{email.subject}</span> · Hesap {pro ? 'Influencer Pro' : 'Pro değil'}
            {forcePro && !pro ? ' (Pro görünümü deneniyor)' : ''}
          </p>
          <iframe title="E-posta önizleme" sandbox="" srcDoc={email.html} className="h-[720px] w-full rounded-2xl border border-white/10 bg-white" />
          <details className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <summary className="cursor-pointer text-sm text-gray-300">Düz metin</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-300">{email.text}</pre>
          </details>
        </section>
      )}
    </div>
  )
}
