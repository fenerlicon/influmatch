// Admin uyarı e-postaları (Resend HTTP API; ek paket gerektirmez).
//
// Ortam değişkenleri:
//   RESEND_API_KEY   Zorunlu. https://resend.com > API Keys.
//   ALERT_EMAIL_TO   İsteğe bağlı, virgülle ayrılmış alıcılar. Boşsa role = admin olan kullanıcılara gider.
//   ALERT_EMAIL_FROM İsteğe bağlı. Varsayılan "Influmatch <onboarding@resend.dev>". Bu test göndericisi
//                    sadece Resend hesabının sahibine e-posta atabilir; alan adınızı Resend'de doğrulayınca
//                    örn. "Influmatch <uyari@alanadiniz.com>" yapın.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import { createSupabaseAdminClient } from '@/utils/supabase/admin'

const DEFAULT_FROM = 'Influmatch <onboarding@resend.dev>'

export type EmailResult = { sent: true; recipients: string[] } | { sent: false; reason: string }

export function adminPanelUrl(path = '/admin') {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://influmatch.net').replace(/\/$/, '')
  return `${base}${path}`
}

export function isAlertEmailConfigured() {
  return !!process.env.RESEND_API_KEY?.trim()
}

export async function resolveAlertRecipients(): Promise<string[]> {
  const configured = (process.env.ALERT_EMAIL_TO || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean)
  if (configured.length > 0) return configured

  const admin = createSupabaseAdminClient()
  if (!admin) return []
  const { data, error } = await admin.from('users').select('email').eq('role', 'admin')
  if (error) {
    console.error('[email] Admin e-postaları okunamadı:', error.message)
    return []
  }
  return (data ?? []).map((row) => row.email as string | null).filter((email): email is string => !!email)
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export async function sendAdminAlertEmail({ subject, text }: { subject: string; text: string }): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY tanımlı değil, uyarı gönderilmedi: ${subject}`)
    return { sent: false, reason: 'RESEND_API_KEY tanımlı değil.' }
  }

  const to = await resolveAlertRecipients()
  if (to.length === 0) {
    return { sent: false, reason: 'Alıcı bulunamadı (ALERT_EMAIL_TO boş ve admin e-postası yok).' }
  }

  const html = `<pre style="font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(text)}</pre>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM?.trim() || DEFAULT_FROM, to, subject, text, html }),
      cache: 'no-store',
    })
    if (!response.ok) {
      const body = await response.text()
      console.error(`[email] Resend HTTP ${response.status}:`, body)
      return { sent: false, reason: `Resend HTTP ${response.status}: ${body.slice(0, 300)}` }
    }
    return { sent: true, recipients: to }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[email] Gönderim hatası:', message)
    return { sent: false, reason: message }
  }
}
