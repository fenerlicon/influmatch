// Ortak biçimlendirme: para, sayı, göreli zaman (Türkçe).

// ₺8.000
export function formatTRY(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

// Bütçe aralığı: ₺4.000 – ₺8.000 / ₺8.000
export function formatBudget(min, max) {
    const a = Number(min) || 0;
    const b = Number(max) || 0;
    if (a && b && a !== b) return `${formatTRY(a)} – ${formatTRY(b)}`;
    if (a || b) return formatTRY(a || b);
    return 'Bütçe belirtilmedi';
}

// 48200 → 48,2B · 1250000 → 1,3M
export function formatCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return '—';
    if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
    if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B`;
    return String(Math.round(n));
}

// 4.12 → %4,1
export function formatPercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `%${n.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

const DAY = 24 * 60 * 60 * 1000;

// "az önce", "12 dk", "3 sa", "dün", "Pzt", "12 Eki"
export function timeAgo(date) {
    if (!date) return '';
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    if (diff < 60 * 1000) return 'az önce';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} dk`;
    if (diff < DAY) return `${Math.floor(diff / 3600000)} sa`;
    if (diff < 2 * DAY) return 'dün';
    if (diff < 7 * DAY) return d.toLocaleDateString('tr-TR', { weekday: 'short' });
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

// 28 Ekim
export function formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

// Kalan gün: "3 gün kaldı", "bugün son", "süresi doldu"
export function daysLeft(date) {
    if (!date) return null;
    const diff = Math.ceil((new Date(date).getTime() - Date.now()) / DAY);
    if (diff < 0) return 'süresi doldu';
    if (diff === 0) return 'bugün son';
    return `${diff} gün kaldı`;
}

// Bildirim grupları için: BUGÜN / BU HAFTA / DAHA ÖNCE
export function dayGroup(date) {
    const d = new Date(date);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (d >= start) return 'Bugün';
    if (Date.now() - d.getTime() < 7 * DAY) return 'Bu hafta';
    return 'Daha önce';
}
