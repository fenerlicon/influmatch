// Müsaitlik sabitleri (3.19); web lib/availability-shared.ts ile aynı tutulmalı.
// Sunucu her yanıtta geçerli durumu (bitiş tarihi geçmiş "dolu" = "iş alıyorum") hesaplayıp gönderir.

export const AVAILABILITY_NOTE_MAX = 140;

export const AVAILABILITY_LABELS = { open: 'İş alıyorum', busy: 'Şu an dolu' };

export function formatAvailabilityUntil(until) {
    if (!until) return null;
    const d = new Date(`${until}T12:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function availabilityText(a) {
    if (!a || a.status !== 'busy') return AVAILABILITY_LABELS.open;
    const until = formatAvailabilityUntil(a.until);
    return until ? `${AVAILABILITY_LABELS.busy} · ${until} tarihine kadar` : AVAILABILITY_LABELS.busy;
}

/** Teklif formundaki uyarı (teklif yine gönderilebilir). */
export function busyOfferWarning(a, name) {
    if (!a || a.status !== 'busy') return null;
    const who = (name || '').trim() || 'Bu profil';
    const until = formatAvailabilityUntil(a.until);
    return `${who} şu an yeni iş almadığını belirtti${until ? ` (${until} tarihine kadar)` : ''}. Teklif yine gönderilebilir ama yanıt gecikebilir.`;
}
