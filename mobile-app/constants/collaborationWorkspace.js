// İş birliği takip alanı sabitleri; web lib/collaboration-workspace-shared.ts ile aynı tutulmalı.

export const DELIVERABLE_KINDS = [
    { value: 'story', label: 'Story' },
    { value: 'reel', label: 'Reels' },
    { value: 'post', label: 'Gönderi' },
    { value: 'ugc_video', label: 'UGC video' },
    { value: 'other', label: 'Diğer' },
];

export const DELIVERABLE_KIND_LABELS = Object.fromEntries(DELIVERABLE_KINDS.map((k) => [k.value, k.label]));

export const DELIVERABLE_STATUS = {
    pending: { label: 'Bekliyor', color: '#9ca3af' },
    draft_submitted: { label: 'Taslak gönderildi', color: '#38bdf8' },
    revision_requested: { label: 'Revize istendi', color: '#fbbf24' },
    approved: { label: 'Onaylandı', color: '#34d399' },
    published: { label: 'Yayınlandı', color: '#c084fc' },
};

export const PAYMENT_TYPE_LABELS = { cash: 'Nakit', barter: 'Barter' };

/** Hukuki şablon metni avukattan gelecek; yalnızca bu nötr satır gösterilir. */
export const AGREEMENT_SUMMARY_NOTE = 'Bu özet iki tarafın uygulamada onayladığı bilgileri gösterir.';

export const AGREEMENT_LIMITS = {
    maxDeliverables: 20,
    maxQuantity: 50,
    maxRevisions: 10,
    usageRightsMax: 300,
    deliverableNoteMax: 200,
    draftNoteMax: 500,
    reviewNoteMax: 500,
    paymentNoteMax: 300,
};

export const revisionUsageText = (used, limit) => `${used} / ${limit} revize kullanıldı`;
export const reliabilityText = (completed, confirmed) => `${completed} iş birliği, ${confirmed} ödeme teyitli`;
export const formatTryAmount = (value) => (value === null || value === undefined ? '—' : `${Number(value).toLocaleString('tr-TR')} ₺`);
