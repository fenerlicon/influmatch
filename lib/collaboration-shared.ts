// İş birliği sabitleri (sunucu ve tarayıcı ortak; sunucuya özel içe aktarım yok).

export type CollaborationStatus = 'agreed' | 'in_progress' | 'published' | 'completed' | 'cancelled'
export type CollaborationSource = 'offer' | 'application'
export type CollaborationAction = 'start' | 'publish' | 'approve' | 'cancel' | 'open_room'

export const COLLABORATION_STATUSES: CollaborationStatus[] = ['agreed', 'in_progress', 'published', 'completed', 'cancelled']

export const COLLABORATION_STATUS_LABELS: Record<CollaborationStatus, string> = {
  agreed: 'Anlaşıldı',
  in_progress: 'İçerik hazırlanıyor',
  published: 'Yayında, onay bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
}

/** Marka yayın linkine bu kadar gün yanıt vermezse iş birliği otomatik tamamlanır. */
export const AUTO_COMPLETE_DAYS = 7
