// Kampanya sabitleri (3.19); web lib/campaigns-shared.ts ile aynı tutulmalı. Doğrulama sunucuda.

export const CAMPAIGN_STATUS_LABELS = { draft: 'Taslak', active: 'Aktif', completed: 'Tamamlandı', archived: 'Arşiv' };
export const CAMPAIGN_STATUS_TONES = { draft: 'neutral', active: 'gold', completed: 'success', archived: 'neutral' };
export const CAMPAIGN_STATUSES = ['draft', 'active', 'completed', 'archived'];
export const CAMPAIGN_OPEN_STATUSES = ['draft', 'active'];

export const CAMPAIGN_OFFER_STATUS = {
    pending: { label: 'Yanıt bekliyor', tone: 'warning' },
    accepted: { label: 'Kabul edildi', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
    expired: { label: 'Süresi doldu', tone: 'neutral' },
    withdrawn: { label: 'Geri çekildi', tone: 'neutral' },
};

export const COLLAB_STATUS_LABELS = {
    agreed: 'Anlaşıldı',
    in_progress: 'İçerik hazırlanıyor',
    published: 'Yayında, onay bekliyor',
    completed: 'Tamamlandı',
    cancelled: 'İptal edildi',
};

export const CAMPAIGN_PLATFORMS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
];

export const CAMPAIGN_LIMITS = { nameMax: 120, goalMax: 1000, textMax: 1500, inviteMax: 25, deliverables: 10 };

export const formatTry = (value) => (value === null || value === undefined ? '—' : `${Number(value).toLocaleString('tr-TR')} ₺`);

export const formatFollowers = (n) => (n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}B` : String(n || 0));

/** Brief'te gösterilecek dolu alan var mı. */
export function briefHasContent(b) {
    return !!(b && (b.goal || b.key_messages || b.dos || b.donts || b.notes || b.example_links?.length || b.hashtags?.length || b.default_deliverables?.length));
}
