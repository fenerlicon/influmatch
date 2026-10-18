import type { ConversationJob } from '@/lib/conversation-jobs'

export interface Participant {
  id: string
  fullName: string
  username: string | null
  avatarUrl: string | null
  role: 'influencer' | 'brand' | 'admin' | null
  verificationStatus?: 'pending' | 'verified' | 'rejected'
  displayedBadges?: string[]
}

export interface Conversation {
  roomId: string
  otherParticipant: Participant | null
  lastMessage: { content: string; createdAt: string; senderId: string; isSystem?: boolean } | null
  unreadCount: number
  job?: ConversationJob | null
}

export interface ChatMessage {
  id: string
  sender_id: string
  content: string
  created_at: string
  /** Sunucunun yazdığı sistem mesajı (ör. teklif geri çekildi, 3.6-S8); ortada ayrı gösterilir. */
  is_system?: boolean
  room_id?: string
  /** İyimser gönderim: sunucu henüz onaylamadı ("Gönderiliyor…"). */
  pending?: boolean
}

/** Karşı tarafın tiki: yönetici / onaylı marka altın, mavi tik mavi. */
export function participantTick(p: Pick<Participant, 'role' | 'displayedBadges'>): { tone: 'gold' | 'blue'; label: string } | null {
  const badges = p.displayedBadges ?? []
  if (p.role === 'admin') return { tone: 'gold', label: 'Yönetici' }
  if (badges.includes('official-business')) return { tone: 'gold', label: 'Onaylı marka' }
  if (badges.includes('verified-account')) return { tone: 'blue', label: 'Doğrulanmış hesap' }
  return null
}
