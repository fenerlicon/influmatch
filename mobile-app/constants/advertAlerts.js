// İlan alarmı sabitleri. Web karşılığı lib/advert-alerts-shared.ts ile aynı tutulmalı (kurallar sunucuda).

export const ADVERT_ALERT_LIMIT = 5;

export const ADVERT_ALERT_PLATFORMS = [
    { key: 'instagram', label: 'Instagram' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'youtube', label: 'YouTube' },
];

export function describeAlert(alert) {
    const parts = [];
    if (alert.category) parts.push(`"${alert.category}"`);
    if (alert.platform) parts.push(ADVERT_ALERT_PLATFORMS.find((p) => p.key === alert.platform)?.label || alert.platform);
    if (alert.min_budget) parts.push(`en az ${Number(alert.min_budget).toLocaleString('tr-TR')} ₺`);
    return parts.length ? parts.join(' · ') : 'Tüm yeni ilanlar';
}
