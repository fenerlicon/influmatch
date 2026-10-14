import React from 'react';
import { View } from 'react-native';
import { BarChart3 } from 'lucide-react-native';
import { Text, Card, ListGroup, ListRow, Avatar, StatCard, EmptyState } from './ui';
import { COST_NOTE, METRICS_SOURCE_NOTE, engagementLabel, formatCount, formatMoney, formatPercent } from '../constants/postMetrics';

/**
 * Kampanya sonuçları (3.20): toplamlar + profil satırları; web kampanya panosundaki "Sonuçlar" ile aynı sayılar
 * (sunucuda lib/post-metrics.ts buildCampaignResults). Yalnızca ölçülen sayılar; kıyas yok.
 */
export default function CampaignResults({ results }) {
    if (!results) return null;
    const { rows, summary } = results;
    if (!summary.posts_live) {
        return (
            <Card padded={false}>
                <EmptyState icon={BarChart3} title="Henüz yayınlanan gönderi yok" text="İş birliklerinde yayın linki girildiğinde ölçümler burada toplanır." />
            </Card>
        );
    }
    return (
        <View style={{ gap: 10 }}>
            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                <View style={{ width: '48%' }}><StatCard label="Yayında" value={formatCount(summary.posts_live)} hint={`${summary.creators} profil · ${summary.posts_measured} ölçüldü`} /></View>
                <View style={{ width: '48%' }}><StatCard label="İzlenme" value={formatCount(summary.views)} hint="İzlenme sayısı olan gönderiler" /></View>
                <View style={{ width: '48%' }}><StatCard label="Beğeni / yorum" value={`${formatCount(summary.likes)} / ${formatCount(summary.comments)}`} /></View>
                <View style={{ width: '48%' }}>
                    <StatCard label="Etkileşim" value={formatPercent(summary.engagement)} hint={summary.engagement ? engagementLabel(summary.engagement.basis) : undefined} />
                </View>
                <View style={{ width: '48%' }}><StatCard label="1000 izlenme başı" value={formatMoney(summary.cost_per_1000_views)} hint="Nakit ücretlere göre" /></View>
                <View style={{ width: '48%' }}><StatCard label="Etkileşim başı" value={formatMoney(summary.cost_per_engagement)} hint="Nakit ücret / (beğeni + yorum)" /></View>
            </View>
            {summary.unavailable || summary.unsupported ? (
                <Text variant="caption" tone="fg3">
                    {summary.unavailable ? `${summary.unavailable} gönderiye ulaşılamıyor (silinmiş ya da gizli olabilir). ` : ''}
                    {summary.unsupported ? `${summary.unsupported} bağlantı (story / YouTube) ölçülmüyor.` : ''}
                </Text>
            ) : null}
            {rows.length ? (
                <ListGroup>
                    {rows.map((r) => {
                        const name = r.creator.full_name || (r.creator.username ? `@${r.creator.username}` : 'Profil');
                        const parts = [
                            `${r.posts_live} yayında`,
                            `İzlenme ${formatCount(r.views)}`,
                            `Beğeni ${formatCount(r.likes)}`,
                            `Yorum ${formatCount(r.comments)}`,
                            r.engagement ? `Etkileşim ${formatPercent(r.engagement)} (${r.engagement.basis === 'views' ? 'izlenmeye' : 'takipçiye'} göre)` : null,
                            r.cost_per_1000_views != null ? `1000 izlenme ${formatMoney(r.cost_per_1000_views)}` : null,
                            r.cost_per_engagement != null ? `etkileşim başı ${formatMoney(r.cost_per_engagement)}` : null,
                        ].filter(Boolean);
                        return <ListRow key={r.key} left={<Avatar name={name} uri={r.creator.avatar_url} />} title={name} subtitle={parts.join(' · ')} numberOfLines={4} />;
                    })}
                </ListGroup>
            ) : null}
            <Text variant="caption" tone="fg3">{METRICS_SOURCE_NOTE}</Text>
            <Text variant="caption" tone="fg3">{COST_NOTE}</Text>
        </View>
    );
}
