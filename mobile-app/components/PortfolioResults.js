import React, { useEffect, useState } from 'react';
import { View, Alert, Linking } from 'react-native';
import { Lock } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { Text, Button, Card, Notice } from './ui';
import { METRIC_STATUS_LABELS, METRICS_SOURCE_NOTE, engagementLabel, formatCount, formatPercent } from '../constants/postMetrics';
import { PORTFOLIO_DESCRIPTION, PORTFOLIO_EMPTY_OWNER, PORTFOLIO_OWNER_NOTE, PORTFOLIO_PRO_NOTE } from '../constants/portfolio';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

function Metric({ label, value }) {
    return (
        <View style={{ minWidth: '45%', flexGrow: 1 }}>
            <Text variant="caption" tone="fg3">{label}</Text>
            <Text weight="semibold">{value}</Text>
        </View>
    );
}

/**
 * Profildeki "Sonuçlar" (portföyde iş birliği sonuçları, 4.3-S7); web components/profile/PortfolioResults.tsx ile aynı içerik.
 * Veri sunucuda hazırlanır (lib/portfolio-results.ts): başkalarına yalnızca Influencer Pro profilinde ve gizlenmemiş kayıtlar;
 * sahibine (mode 'owner') hepsi + gizle / göster (/api/mobile/portfolio).
 */
export default function PortfolioResults({ view, onOpenPlans }) {
    const [items, setItems] = useState(view?.items || []);
    const [busyId, setBusyId] = useState(null);
    useEffect(() => { setItems(view?.items || []); }, [view]);
    if (!view) return null;
    const owner = view.mode === 'owner';

    const toggle = async (item) => {
        setBusyId(item.collaboration_id);
        const result = await apiRequest('portfolio', { method: 'POST', body: { collaborationId: item.collaboration_id, hidden: !item.hidden } });
        setBusyId(null);
        if (result.error) {
            Alert.alert('Kaydedilemedi', result.error);
            return;
        }
        setItems((prev) => prev.map((it) => (it.collaboration_id === item.collaboration_id ? { ...it, hidden: result.hidden } : it)));
    };

    return (
        <View style={{ gap: 10 }}>
            <Text variant="caption" tone="fg3">{PORTFOLIO_DESCRIPTION}</Text>
            {owner && !view.pro ? (
                <Notice tone="info" icon={Lock} title="Influencer Pro özelliği" text={PORTFOLIO_PRO_NOTE} onPress={onOpenPlans} />
            ) : null}
            {owner && view.pro ? <Text variant="caption" tone="fg3">{PORTFOLIO_OWNER_NOTE}</Text> : null}
            {items.length === 0 ? <Text variant="small" tone="fg3">{PORTFOLIO_EMPTY_OWNER}</Text> : null}
            {items.map((item) => (
                <Card key={item.collaboration_id} style={{ gap: 8, opacity: item.hidden ? 0.6 : 1 }}>
                    <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                        <View className="flex-1">
                            <Text weight="semibold">{item.brand.label}{item.brand.sector ? <Text variant="caption" tone="fg3">{`  ${item.brand.sector}`}</Text> : null}</Text>
                            <Text variant="caption" tone="fg3">{item.kinds.join(', ')} · Yayın: {formatDate(item.published_at)}</Text>
                            {owner && !item.brand.name_visible && item.owner_brand_name ? (
                                <Text variant="caption" tone="fg3">{`${item.owner_brand_name} adının görünmesine izin vermedi; başkalarına "${item.brand.label}" olarak görünür.`}</Text>
                            ) : null}
                        </View>
                        {owner ? (
                            <Button
                                title={item.hidden ? 'Göster' : 'Gizle'}
                                size="sm"
                                variant="secondary"
                                loading={busyId === item.collaboration_id}
                                onPress={() => toggle(item)}
                            />
                        ) : null}
                    </View>
                    {item.totals.measured > 0 ? (
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            <Metric label="İzlenme" value={formatCount(item.totals.views)} />
                            <Metric label="Beğeni" value={formatCount(item.totals.likes)} />
                            <Metric label="Yorum" value={formatCount(item.totals.comments)} />
                            <Metric label={item.totals.engagement ? engagementLabel(item.totals.engagement.basis) : 'Etkileşim'} value={formatPercent(item.totals.engagement)} />
                        </View>
                    ) : null}
                    {item.posts.map((post) => (
                        <View key={post.deliverable_id} style={{ gap: 2 }}>
                            <Text variant="small" weight="medium">{post.kind} · <Text variant="caption" tone="fg3">{formatDate(post.published_at)}</Text></Text>
                            <Text variant="caption" tone="fg2">
                                {post.latest
                                    ? `${formatCount(post.latest.views)} izlenme · ${formatCount(post.latest.likes)} beğeni · ${formatCount(post.latest.comments)} yorum${post.engagement ? ` · ${engagementLabel(post.engagement.basis)}: ${formatPercent(post.engagement)}` : ''}`
                                    : (post.status ? METRIC_STATUS_LABELS[post.status] : 'Ölçüm yok')}
                            </Text>
                            {post.post_url ? (
                                <Text variant="caption" tone="gold" onPress={() => Linking.openURL(post.post_url).catch(() => {})} suppressHighlighting>Gönderiyi aç</Text>
                            ) : null}
                        </View>
                    ))}
                </Card>
            ))}
            <Text variant="caption" tone="fg3">{METRICS_SOURCE_NOTE}</Text>
        </View>
    );
}
