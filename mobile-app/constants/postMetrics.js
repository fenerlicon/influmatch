// Sonuç raporu (3.20) sabitleri ve hesapları; web lib/post-metrics-shared.ts ile aynı tutulmalı.
// Yalnızca ölçülen sayılar gösterilir: kıyas, "sektör ortalaması" ya da tahmin yok.

export const MANUAL_REFRESH_HOURS = 6;

export const METRIC_STAGE_LABELS = {
    d1: '1. gün',
    d7: '7. gün',
    d30: '30. gün',
    manual: 'Elle güncelleme',
};

export const METRIC_STATUS_LABELS = {
    active: 'Ölçülüyor',
    done: 'Ölçüm tamamlandı (30 gün)',
    unavailable: 'Gönderiye ulaşılamıyor (silinmiş ya da gizli olabilir)',
    unsupported: 'Bu bağlantı için ölçüm yok',
};

/** Etkileşim = (beğeni + yorum) / izlenme; izlenme yoksa yayın anındaki takipçi sayısına göre. */
export function engagementOf(s, followersAtPublish) {
    if (!s) return null;
    if (s.likes == null && s.comments == null) return null;
    const interactions = (s.likes || 0) + (s.comments || 0);
    if (s.views && s.views > 0) return { value: (interactions / s.views) * 100, basis: 'views' };
    if (followersAtPublish && followersAtPublish > 0) return { value: (interactions / followersAtPublish) * 100, basis: 'followers' };
    return null;
}

export function engagementLabel(basis) {
    return basis === 'views' ? 'Etkileşim (izlenmeye göre)' : 'Etkileşim (yayın anındaki takipçiye göre)';
}

export function formatCount(value) {
    if (value === null || value === undefined) return '—';
    return Number(value).toLocaleString('tr-TR');
}

export function formatPercent(rate) {
    if (!rate) return '—';
    return `%${rate.value.toLocaleString('tr-TR', { maximumFractionDigits: 2, minimumFractionDigits: rate.value < 10 ? 2 : 1 })}`;
}

export function formatMoney(value) {
    if (value === null || value === undefined) return '—';
    return `${value.toLocaleString('tr-TR', { maximumFractionDigits: value < 100 ? 2 : 0 })} ₺`;
}

export const COST_NOTE =
    'Maliyetler yalnızca anlaşma özetindeki nakit ücretlerden hesaplanır; barter ve ücretsiz iş birlikleri dahil değildir. 1000 izlenme başı maliyet, bütün gönderilerinde izlenme sayısı ölçülen profiller için gösterilir.';
export const METRICS_SOURCE_NOTE =
    'Sayılar gönderilerin herkese açık sayfasından ölçülür (yayından 1, 7 ve 30 gün sonra). Story ve YouTube bağlantıları şimdilik ölçülmez.';
