// Güvenli iş birliği (2026-11-23). Web'deki lib/collaboration-trust-shared.ts ile aynı tutulmalı
// (tests/mobile-parity.test.ts denetler). Kurallar sunucuda; burada yalnızca ekran metinleri ve sınırlar.

export const COMMITMENT_VERSION = '2026-11-23';

// Avukat kontrolü bekliyor (docs/SYSTEM_MAP.md 15).
export const COMMITMENT_TEXT =
    'Bu iş birliğinin tüm yazışma, onay ve teslim kayıtları saklanır. Ödeme yapılmazsa influencer bu kayıtları yasal süreçte kullanabilir; ödeme yapmayan markaların hesabı askıya alınır.';

export const COMMITMENT_SHORT = 'Yazışma, onay ve teslim kayıtları saklanır; ödeme yapmayan markaların hesabı askıya alınır.';

export const COMMITMENT_CHECKBOX_LABEL = 'Okudum, kabul ediyorum.';

/** Sunucunun taahhüt eksikken döndürdüğü hata; bu metin gelince taahhüt penceresi açılır. */
export const COMMITMENT_REQUIRED_ERROR = 'Devam etmeden önce iş birliği taahhüdünü onaylaman gerekiyor.';

export const DISPUTE_RESPONSE_DAYS = 7;
export const DISPUTE_PROOF_BUCKET = 'payment-proofs';
export const DISPUTE_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const DISPUTE_NOTE_MAX = 1000;

export const DISPUTE_KIND_LABELS = {
    nonpayment: 'Ödeme alınamadı',
    nondelivery: 'Teslim edilmedi',
};

export const DISPUTE_STATUS_LABELS = {
    open: 'Yanıt bekleniyor',
    responded: 'Yanıt verildi',
    resolved: 'Çözüldü',
    escalated: 'İncelemede',
    upheld: 'Hesap askıya alındı',
    dismissed: 'Kapatıldı',
    paid: 'Ödendi olarak kapatıldı',
};

export const DISPUTE_STATUS_TONES = {
    open: 'warning',
    responded: 'info',
    resolved: 'success',
    escalated: 'danger',
    upheld: 'danger',
    dismissed: 'neutral',
    paid: 'success',
};

export const PAYMENT_PROGRESS_LABELS = {
    none: '',
    awaiting_brand: 'Ödeme bekleniyor',
    awaiting_influencer: 'Onay bekleniyor',
    confirmed: 'Ödeme iki tarafça teyit edildi',
};

export const PAYMENT_PROGRESS_TONES = {
    none: 'neutral',
    awaiting_brand: 'warning',
    awaiting_influencer: 'info',
    confirmed: 'success',
};

export function lateCountText(kind, late, total) {
    if (total === 0) return kind === 'payment' ? 'Vadeli ödeme kaydı yok' : 'Tarihli teslimat kaydı yok';
    return kind === 'payment' ? `${total} vadeli ödemeden ${late} tanesi gecikti` : `${total} tarihli teslimattan ${late} tanesi gecikti`;
}
