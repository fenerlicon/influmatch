// Sohbette canlı durum (2026-10-19): "yazıyor…" ve "Görüldü". Veritabanına yazılmaz; Supabase Realtime yayın (broadcast)
// kanalıyla iki taraf arasında anlık gider. Kanal aynı iki kişi için tektir (bütün odaları birleşik sohbet).
// Sayfa açılışındaki "Görüldü" durumu sunucudan (karşı tarafın room_reads zamanı) gelir; sonrası bu kanaldan.
// Mobil karşılığı: mobile-app/constants/chatLive.js (aynı tutulur; tests/mobile-parity.test.ts denetler).

export const CHAT_TYPING_EVENT = 'typing'
export const CHAT_READ_EVENT = 'read'
/** "yazıyor" sinyali en fazla bu aralıkla gönderilir. */
export const CHAT_TYPING_THROTTLE_MS = 2000
/** Son sinyalden bu kadar sonra "yazıyor…" kaybolur. */
export const CHAT_TYPING_SHOW_MS = 4000

/** İki kullanıcı için ortak kanal adı (sıra bağımsız). */
export function chatLiveChannel(a: string, b: string): string {
  return `chat-live-${[a, b].sort().join('-')}`
}

/** Mesaj görüldü mü: karşı tarafın son okuma zamanı mesajdan sonra mı. */
export function isSeenBy(lastReadAt: string | null | undefined, messageCreatedAt: string): boolean {
  if (!lastReadAt) return false
  return Date.parse(lastReadAt) >= Date.parse(messageCreatedAt)
}
