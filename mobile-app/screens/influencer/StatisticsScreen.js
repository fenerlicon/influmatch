import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Eye, Heart, MessageCircle, Bookmark, Instagram } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { formatCount, formatPercent } from '../../lib/format';
import {
    Screen, StackHeader, Section, Text, Button, Card, ListGroup, ListRow, IconBox, StatCard, KeyValue, Chip, EmptyState, colors, ICON_STROKE,
} from '../../components/ui';

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function StatisticsScreen({ navigation }) {
    const [socialData, setSocialData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchStats = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('social_accounts')
                .select('platform, username, follower_count, engagement_rate, stats_payload, updated_at')
                .eq('user_id', user.id)
                .eq('platform', 'instagram')
                .maybeSingle();

            setSocialData(data || null);
        } catch (e) {
            console.error('[StatisticsScreen] fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const payload = socialData?.stats_payload || {};
    const followerCount = socialData?.follower_count || 0;
    const engagementRate = socialData?.engagement_rate ? parseFloat(socialData.engagement_rate) : 0;
    const avgLikes = payload?.avg_likes || 0;
    const avgViews = payload?.avg_views || 0;
    const avgComments = payload?.avg_comments || 0;
    const avgSaves = payload?.avg_saves || 0;
    const postCount = payload?.post_count || 0;
    const postingFreq = payload?.posting_frequency_per_week;
    const lastUpdated = socialData?.updated_at
        ? new Date(socialData.updated_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
        : null;

    const engLabel = engagementRate > 5 ? 'Çok Yüksek' : engagementRate > 3 ? 'Yüksek' : engagementRate > 1 ? 'Normal' : 'Düşük';

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const engTone = engagementRate > 3 ? 'success' : engagementRate > 1 ? 'warning' : 'danger';
    const averages = [
        ['Beğeni', avgLikes, Heart],
        ['İzlenme', avgViews, Eye],
        ['Yorum', avgComments, MessageCircle],
        ['Kaydetme', avgSaves, Bookmark],
    ].filter(([, v]) => v);

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchStats(); }}
            header={<StackHeader title="İstatistikler" onBack={() => navigation.goBack()} />}
        >
            {!socialData ? (
                <Card padded={false}>
                    <EmptyState
                        icon={Instagram}
                        title="Instagram bağlı değil"
                        text="İstatistiklerin doğrulanmış Instagram hesabından gelir."
                        action={<Button title="Hesabı bağla" size="md" variant="secondary" onPress={() => navigation.navigate('MyProfile')} />}
                    />
                </Card>
            ) : (
                <>
                    <View className="flex-row items-center justify-between px-1">
                        <View className="flex-row items-center" style={{ gap: 6 }}>
                            <Instagram size={16} color={colors.fg2} strokeWidth={ICON_STROKE} />
                            <Text variant="small" weight="medium">@{socialData.username || 'instagram'}</Text>
                        </View>
                        {lastUpdated ? <Text variant="caption" tone="fg3">Güncelleme: {lastUpdated}</Text> : null}
                    </View>

                    <View className="flex-row" style={{ gap: 10 }}>
                        <StatCard label="Takipçi" value={formatCount(followerCount)} />
                        <StatCard label="Etkileşim" value={engagementRate ? formatPercent(engagementRate) : '—'} hint={engagementRate ? engLabel : undefined} />
                        <StatCard label="Gönderi" value={postCount ? String(postCount) : '—'} />
                    </View>
                    {engagementRate ? <Chip label={`Etkileşim: ${engLabel}`} tone={engTone} /> : null}

                    {averages.length ? (
                        <Section title="İçerik başına ortalama">
                            <ListGroup>
                                {averages.map(([label, value, Icon]) => (
                                    <ListRow key={label} left={<IconBox icon={Icon} />} title={label} right={<Text weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{formatCount(value)}</Text>} />
                                ))}
                            </ListGroup>
                        </Section>
                    ) : null}

                    {postingFreq ? (
                        <Section title="Hesap">
                            <Card padded={false} className="px-4">
                                <KeyValue label="Haftalık paylaşım" value={`${Number(postingFreq).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} gönderi`} last />
                            </Card>
                        </Section>
                    ) : null}
                </>
            )}
        </Screen>
    );
}
