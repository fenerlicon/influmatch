import { describe, expect, it } from 'vitest'
import * as web from '@/lib/chat-live-shared'
import * as mobile from '@/mobile-app/constants/chatLive.js'
import { adminNoticeLink, cleanRemovalReason, isAdminNoticeLink } from '@/lib/admin-notices-shared'

describe('sohbet canlı durumu', () => {
  it('kanal adı iki kişi için sıradan bağımsız', () => {
    expect(web.chatLiveChannel('b', 'a')).toBe(web.chatLiveChannel('a', 'b'))
    expect(web.chatLiveChannel('a', 'b')).toBe('chat-live-a-b')
  })

  it('görüldü: okuma zamanı mesajdan sonra', () => {
    expect(web.isSeenBy('2026-10-19T10:00:01Z', '2026-10-19T10:00:00Z')).toBe(true)
    expect(web.isSeenBy('2026-10-19T10:00:00Z', '2026-10-19T10:00:00Z')).toBe(true)
    expect(web.isSeenBy('2026-10-19T09:59:59Z', '2026-10-19T10:00:00Z')).toBe(false)
    expect(web.isSeenBy(null, '2026-10-19T10:00:00Z')).toBe(false)
  })

  it('web ve mobil aynı kanalı ve olayları kullanır', () => {
    expect(mobile.CHAT_TYPING_EVENT).toBe(web.CHAT_TYPING_EVENT)
    expect(mobile.CHAT_READ_EVENT).toBe(web.CHAT_READ_EVENT)
    expect(mobile.CHAT_TYPING_THROTTLE_MS).toBe(web.CHAT_TYPING_THROTTLE_MS)
    expect(mobile.CHAT_TYPING_SHOW_MS).toBe(web.CHAT_TYPING_SHOW_MS)
    expect(mobile.chatLiveChannel('x', 'y')).toBe(web.chatLiveChannel('y', 'x'))
    expect(mobile.isSeenBy('2026-10-19T10:00:01Z', '2026-10-19T10:00:00Z')).toBe(true)
  })
})

describe('admin duyuruları', () => {
  it('kaldırılan ilan bağlantısı duyuru sayılır, sıradan bildirim sayılmaz', () => {
    expect(isAdminNoticeLink(adminNoticeLink('ilan-kaldirildi'))).toBe(true)
    expect(isAdminNoticeLink('/dashboard/messages?roomId=1')).toBe(false)
    expect(isAdminNoticeLink(null)).toBe(false)
  })

  it('kaldırma nedeni zorunlu ve kısaltılır', () => {
    expect(cleanRemovalReason('  Kurallara   aykırı  ')).toBe('Kurallara aykırı')
    expect(cleanRemovalReason('ab')).toBeNull()
    expect(cleanRemovalReason(undefined)).toBeNull()
    expect(cleanRemovalReason('x'.repeat(500))?.length).toBe(300)
  })
})
