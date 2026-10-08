// Mobil push bildirimleri (Expo push servisi üzerinden APNs / FCM).
//
// Push metni Expo, Apple ve Google sunucularından geçer; bu yüzden içerik e-postadaki kadar sade tutulur
// (ör. mesaj içeriği gönderilmez, notify.ts e-posta metnini kullanır). Token yoksa veya geçersizse sessizce geçer.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import type { SupabaseClient } from '@supabase/supabase-js'

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const PUSH_TIMEOUT_MS = 5000
const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/

export interface PushInput {
  title: string
  body: string
  /** Uygulamanın bildirime dokununca açacağı site yolu (ör. /dashboard/messages?roomId=...). */
  link?: string | null
}

/** Kullanıcının kayıtlı cihazına push gönderir. Hata fırlatmaz. */
export async function sendPushToUser(admin: SupabaseClient, userId: string, input: PushInput) {
  const { data: user } = await admin.from('users').select('push_token').eq('id', userId).maybeSingle()
  const token = user?.push_token as string | null | undefined
  if (!token || !EXPO_TOKEN_PATTERN.test(token)) return

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' }
  // Expo hesabında "gelişmiş push güvenliği" açılırsa erişim anahtarı gerekir (docs/SETUP.md).
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: token,
        title: input.title.slice(0, 120),
        body: input.body.slice(0, 240),
        sound: 'default',
        data: input.link ? { link: input.link } : {},
      }),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    })
    const payload = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } } } | null
    const ticket = payload?.data
    if (ticket?.status === 'error') {
      // Uygulama silinmiş / token geçersiz: bir daha denememek için token temizlenir.
      if (ticket.details?.error === 'DeviceNotRegistered') {
        await admin.from('users').update({ push_token: null }).eq('id', userId).eq('push_token', token)
      } else {
        console.error('[push] gönderilemedi:', ticket.details?.error ?? 'bilinmeyen hata')
      }
    } else if (!res.ok) {
      console.error('[push] Expo yanıtı:', res.status)
    }
  } catch (error) {
    console.error('[push] istek hatası:', error instanceof Error ? error.message : error)
  }
}
