'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupabaseAdminClient } from '@/utils/supabase/admin'
import { API_PROVIDERS, PROVIDER_LABELS, STATUS_LABELS, listApiKeys, type ApiKeyRow, type ApiProvider } from '@/lib/api-keys'
import { checkAndStoreKey, runApiKeyHealthCheck } from '@/lib/api-key-health'
import { adminPanelUrl, sendAdminAlertEmail } from '@/lib/email'
import { loadApiKeyDashboard, type ApiKeyDashboard } from './data'

type ActionResult = { success: true; dashboard: ApiKeyDashboard; message?: string } | { success: false; error: string }

async function requireAdmin(): Promise<{ admin: SupabaseClient } | { error: string }> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Oturum açmanız gerekiyor.' }

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') return { error: 'Bu işlem için yetkiniz yok.' }

  const admin = createSupabaseAdminClient()
  if (!admin) return { error: 'Sistem yapılandırma hatası: SUPABASE_SERVICE_ROLE_KEY eksik.' }
  return { admin }
}

async function withAdmin(task: (admin: SupabaseClient) => Promise<string | undefined>): Promise<ActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  try {
    const message = await task(auth.admin)
    return { success: true, dashboard: await loadApiKeyDashboard(auth.admin), message }
  } catch (error) {
    console.error('[admin/api-keys]', error)
    return { success: false, error: error instanceof Error ? error.message : 'İşlem başarısız.' }
  }
}

async function getKey(admin: SupabaseClient, id: string): Promise<ApiKeyRow> {
  const { data, error } = await admin.from('api_keys').select('*').eq('id', id).maybeSingle()
  if (error || !data) throw new Error('Anahtar bulunamadı.')
  return data as ApiKeyRow
}

export async function addApiKey(provider: ApiProvider, label: string, secret: string) {
  return withAdmin(async (admin) => {
    if (!API_PROVIDERS.includes(provider)) throw new Error('Geçersiz servis.')
    const cleanSecret = secret.trim()
    if (cleanSecret.length < 10 || cleanSecret.length > 500 || /\s/.test(cleanSecret)) {
      throw new Error('Anahtar geçersiz görünüyor. Boşluk içermeden, olduğu gibi yapıştırın.')
    }

    const existing = await listApiKeys(admin, provider)
    if (existing.some((key) => key.secret === cleanSecret)) throw new Error('Bu anahtar zaten ekli.')

    const { data, error } = await admin
      .from('api_keys')
      .insert({
        provider,
        label: label.trim().slice(0, 80) || `${PROVIDER_LABELS[provider]} anahtarı ${existing.length + 1}`,
        secret: cleanSecret,
        priority: existing.reduce((max, key) => Math.max(max, key.priority), 0) + 10,
      })
      .select('*')
      .single()
    if (error || !data) throw new Error(`Anahtar kaydedilemedi: ${error?.message ?? 'bilinmeyen hata'}`)

    const checked = await checkAndStoreKey(admin, data as ApiKeyRow)
    if (checked.status === 'active') return 'Anahtar eklendi ve doğrulandı.'
    return `Anahtar eklendi ama durumu: ${STATUS_LABELS[checked.status]}${checked.status_message ? ` (${checked.status_message})` : ''}`
  })
}

export async function setApiKeyEnabled(id: string, enabled: boolean) {
  return withAdmin(async (admin) => {
    const { error } = await admin
      .from('api_keys')
      .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
    return enabled ? 'Anahtar etkinleştirildi.' : 'Anahtar devre dışı bırakıldı.'
  })
}

export async function moveApiKey(id: string, direction: 'up' | 'down') {
  return withAdmin(async (admin) => {
    const key = await getKey(admin, id)
    const keys = await listApiKeys(admin, key.provider)
    const index = keys.findIndex((k) => k.id === id)
    const target = direction === 'up' ? index - 1 : index + 1
    if (index < 0 || target < 0 || target >= keys.length) return undefined

    ;[keys[index], keys[target]] = [keys[target], keys[index]]
    for (const [position, k] of keys.entries()) {
      const priority = (position + 1) * 10
      if (k.priority !== priority) {
        const { error } = await admin.from('api_keys').update({ priority }).eq('id', k.id)
        if (error) throw new Error(error.message)
      }
    }
    return undefined
  })
}

export async function deleteApiKey(id: string) {
  return withAdmin(async (admin) => {
    const { error } = await admin.from('api_keys').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return 'Anahtar silindi.'
  })
}

export async function checkApiKeys(id?: string) {
  return withAdmin(async (admin) => {
    if (id) {
      const checked = await checkAndStoreKey(admin, await getKey(admin, id))
      return `${checked.label}: ${STATUS_LABELS[checked.status]}${checked.status_message ? ` (${checked.status_message})` : ''}`
    }
    const report = await runApiKeyHealthCheck(admin, { sendEmail: false })
    return report.hasProblems ? 'Kontrol tamamlandı: sorunlu anahtarlar var.' : 'Kontrol tamamlandı: tüm anahtarlar sağlıklı.'
  })
}

export async function sendTestAlertEmail() {
  return withAdmin(async () => {
    const result = await sendAdminAlertEmail({
      subject: '[Influmatch] Test e-postası',
      text: `Bu bir test e-postasıdır. API anahtar uyarıları bu adrese gelecek.\n\nPanel: ${adminPanelUrl('/admin/api-keys')}`,
    })
    if (!result.sent) throw new Error(`E-posta gönderilemedi: ${result.reason}`)
    return `Test e-postası gönderildi: ${result.recipients.join(', ')}`
  })
}
