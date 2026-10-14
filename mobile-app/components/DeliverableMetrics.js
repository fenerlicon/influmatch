import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { RefreshCw, History } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { Text, Button } from './ui';
import {
    MANUAL_REFRESH_HOURS,
    METRIC_STAGE_LABELS,
    METRIC_STATUS_LABELS,
    engagementLabel,
    engagementOf,
    formatCount,
    formatPercent,
} from '../constants/postMetrics';

const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

function Metric({ label, value }) {
    return (
        <View style={{ minWidth: '45%', flexGrow: 1 }}>
            <Text variant="caption" tone="fg3">{label}</Text>
            <Text weight="semibold">{value}</Text>
        </View>
    );
}

/**
 * Yayınlanan teslimatın gönderi ölçümleri (sonuç raporu, 3.20); web DeliverableMetricsPanel ile aynı içerik.
 * İki taraf da görür; "Şimdi güncelle" yalnızca markada, 6 saatte bir (sunucu: /api/mobile/collaborations/[id]/metrics).
 */
export default function DeliverableMetrics({ collaborationId, metrics, onUpdated }) {
    const [busy, setBusy] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    if (!metrics) return null;
    const { latest, engagement } = metrics;

    const refresh = async () => {
        setBusy(true);
        const result = await apiRequest(`collaborations/${collaborationId}/metrics`, { method: 'POST', body: { deliverableId: metrics.deliverable_id } });
        setBusy(false);
        if (result.error) {
            Alert.alert('Güncellenemedi', result.error);
            return;
        }
        onUpdated?.();
    };

    const manual = metrics.manual;
    return (
        <View className="rounded-xl border border-line px-3 py-2.5" style={{ gap: 8 }}>
            <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                <Text variant="eyebrow">Sonuçlar</Text>
                <Text variant="caption" tone="fg3" numberOfLines={2} style={{ flexShrink: 1, textAlign: 'right' }}>
                    {metrics.status === 'active' && metrics.next_stage
                        ? `Sonraki: ${METRIC_STAGE_LABELS[metrics.next_stage]} (${formatDateTime(metrics.next_due_at)})`
                        : METRIC_STATUS_LABELS[metrics.status]}
                </Text>
            </View>
            {latest ? (
                <>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        <Metric label="İzlenme" value={formatCount(latest.views)} />
                        <Metric label="Beğeni" value={formatCount(latest.likes)} />
                        <Metric label="Yorum" value={formatCount(latest.comments)} />
                        <Metric label={engagement ? engagementLabel(engagement.basis) : 'Etkileşim'} value={formatPercent(engagement)} />
                    </View>
                    <Text variant="caption" tone="fg3">
                        Son ölçüm: {formatDateTime(latest.captured_at)} ({METRIC_STAGE_LABELS[latest.stage]})
                        {engagement?.basis === 'followers' && metrics.followers_at_publish ? ` · Yayın anındaki takipçi: ${formatCount(metrics.followers_at_publish)}` : ''}
                    </Text>
                </>
            ) : (
                <Text variant="small" tone="fg2">
                    {metrics.status === 'active' ? 'İlk ölçüm yayından yaklaşık 24 saat sonra yapılır.' : 'Ölçüm yok.'}
                </Text>
            )}
            {metrics.snapshots?.length > 1 || (manual && (manual.allowed || manual.available_at)) ? (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {metrics.snapshots?.length > 1 ? (
                        <Button title={`Geçmiş (${metrics.snapshots.length})`} icon={History} variant="ghost" size="sm" onPress={() => setHistoryOpen((v) => !v)} />
                    ) : null}
                    {manual && (manual.allowed || manual.available_at) ? (
                        <Button
                            title={busy ? 'Ölçülüyor…' : manual.allowed ? 'Şimdi güncelle' : `Şimdi güncelle (${formatDateTime(manual.available_at)})`}
                            icon={RefreshCw}
                            variant="secondary"
                            size="sm"
                            disabled={busy || !manual.allowed}
                            onPress={refresh}
                        />
                    ) : null}
                </View>
            ) : null}
            {manual && !manual.allowed && manual.available_at ? (
                <Text variant="caption" tone="fg3">{MANUAL_REFRESH_HOURS} saatte bir güncellenebilir.</Text>
            ) : null}
            {historyOpen ? (
                <View className="border-l border-line-strong pl-3" style={{ gap: 6 }}>
                    {metrics.snapshots.map((s) => (
                        <View key={s.captured_at}>
                            <Text variant="caption" tone="fg2">{formatDateTime(s.captured_at)} · {METRIC_STAGE_LABELS[s.stage]}</Text>
                            <Text variant="small" tone="fg2">
                                İzlenme {formatCount(s.views)} · Beğeni {formatCount(s.likes)} · Yorum {formatCount(s.comments)} · Etkileşim {formatPercent(engagementOf(s, metrics.followers_at_publish))}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}
