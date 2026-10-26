import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Award, Lock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { influencerBadges, brandBadges, badgeRequirement } from '../../constants/badges';
import {
    Screen, StackHeader, Section, Text, Card, ListGroup, ListRow, IconBox, Chip, ProgressBar, colors, ICON_STROKE,
} from '../../components/ui';

// Rozetler (iki rol). Veri ve koşul metinleri web ile aynı (constants/badges.js). Rozetleri sunucu verir.
export default function BadgesScreen({ navigation }) {
    const [userRole, setUserRole] = useState('influencer');
    const [earnedIds, setEarnedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: profile }, { data: badges }] = await Promise.all([
                supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
                supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
            ]);
            if (profile?.role) setUserRole(profile.role);
            setEarnedIds(badges?.map(b => b.badge_id) ?? []);
        } catch (e) {
            console.error('[BadgesScreen]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const allBadges = userRole === 'brand' ? brandBadges : influencerBadges;
    const available = allBadges.filter(b => b.phase === 'mvp');
    const future = allBadges.filter(b => b.phase !== 'mvp');
    const earned = available.filter(b => earnedIds.includes(b.id));
    const unearned = available.filter(b => !earnedIds.includes(b.id));
    const progress = available.length ? Math.round((earned.length / available.length) * 100) : 0;

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            header={<StackHeader title="Rozetler" onBack={() => navigation.goBack()} />}
        >
            <Card style={{ gap: 10 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <IconBox icon={Award} tone="gold" size={40} />
                    <View className="flex-1">
                        <Text weight="semibold" style={{ fontSize: 16 }}>{earned.length} / {available.length} rozet</Text>
                        <Text variant="small" tone="fg2">Şu an kazanılabilen rozetlerden</Text>
                    </View>
                </View>
                <ProgressBar value={progress} />
            </Card>

            {earned.length ? (
                <Section title="Sahip olduğun rozetler">
                    <ListGroup>
                        {earned.map((b) => (
                            <ListRow key={b.id} left={<IconBox icon={b.icon} tone="gold" />} title={b.name} subtitle={b.description} numberOfLines={2} right={b.highlight ? <Chip label="Kalıcı" tone="gold" /> : <Chip label="Kazanıldı" tone="success" />} />
                        ))}
                    </ListGroup>
                </Section>
            ) : null}

            {unearned.length ? (
                <Section title="Kazanabileceğin rozetler">
                    <ListGroup>
                        {unearned.map((b) => (
                            <ListRow
                                key={b.id}
                                left={<IconBox icon={b.icon} />}
                                title={b.name}
                                numberOfLines={3}
                                subtitle={
                                    <View style={{ gap: 2 }}>
                                        <Text variant="small" tone="fg2">{b.description}</Text>
                                        <Text variant="caption" tone="fg3">{badgeRequirement(b.id)}</Text>
                                    </View>
                                }
                            />
                        ))}
                    </ListGroup>
                </Section>
            ) : null}

            {future.length ? (
                <Section title="Yakında">
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {future.map((b) => <Chip key={b.id} label={b.name} icon={Lock} />)}
                    </View>
                </Section>
            ) : null}
        </Screen>
    );
}
