import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, Target } from 'lucide-react-native';
import { apiRequest } from '../../lib/api';
import CampaignFormSheet from '../../components/CampaignFormSheet';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONES, formatTry } from '../../constants/campaigns';
import { Screen, StackHeader, Text, Button, Card, Chip, EmptyState, Segment, colors } from '../../components/ui';

// Kampanyalar (3.19): liste + basit oluşturma. Kurallar ve Spotlight Pro kapısı sunucuda (/api/mobile/campaigns, lib/campaigns.ts).
export default function CampaignsScreen({ navigation }) {
    const [campaigns, setCampaigns] = useState(null);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [filter, setFilter] = useState('current');

    const load = useCallback(async () => {
        const result = await apiRequest('campaigns');
        setRefreshing(false);
        if (result.error) {
            setError(result.error);
            setCampaigns([]);
            return;
        }
        setError(null);
        setCampaigns(result.campaigns || []);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const shown = (campaigns || []).filter((c) => (filter === 'archived' ? c.status === 'archived' : c.status !== 'archived'));

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={<StackHeader title="Kampanyalar" onBack={() => navigation.goBack()} />}
        >
            <Text variant="small" tone="fg2">Brief ve hedefi bir kez yaz; profilleri davet et, teklif ve iş birliklerini tek yerde izle.</Text>
            <Button title="Yeni kampanya" icon={Plus} onPress={() => setCreateOpen(true)} block />
            <Segment options={[{ key: 'current', label: 'Kampanyalar' }, { key: 'archived', label: 'Arşiv' }]} value={filter} onChange={setFilter} />
            {error ? <Text tone="danger" variant="small">{error}</Text> : null}
            {campaigns === null ? (
                <ActivityIndicator color={colors.gold} />
            ) : shown.length === 0 ? (
                <Card padded={false}>
                    <EmptyState icon={Target} title={filter === 'archived' ? 'Arşivde kampanya yok' : 'Henüz kampanya yok'} text={filter === 'archived' ? undefined : 'İlk kampanyanı oluştur, ardından profilleri davet et.'} />
                </Card>
            ) : (
                shown.map((c) => (
                    <Card key={c.id} onPress={() => navigation.navigate('CampaignDetail', { campaignId: c.id })} style={{ gap: 10 }}>
                        <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                            <Text weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{c.name}</Text>
                            <Chip label={CAMPAIGN_STATUS_LABELS[c.status] || c.status} tone={CAMPAIGN_STATUS_TONES[c.status] || 'neutral'} />
                        </View>
                        <View className="flex-row" style={{ gap: 6 }}>
                            {[
                                ['Davet', String(c.invited_count)],
                                ['Kabul', String(c.accepted_count)],
                                ['Bütçe', c.total_budget != null ? formatTry(c.total_budget) : '—'],
                            ].map(([label, value]) => (
                                <View key={label} className="flex-1 px-2.5 py-2 rounded-[10px] bg-s2">
                                    <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>{value}</Text>
                                    <Text variant="caption" tone="fg3">{label}</Text>
                                </View>
                            ))}
                        </View>
                    </Card>
                ))
            )}
            {createOpen ? (
                <CampaignFormSheet
                    visible
                    onClose={() => setCreateOpen(false)}
                    onSaved={(campaign) => {
                        setCreateOpen(false);
                        load();
                        if (campaign?.id) navigation.navigate('CampaignDetail', { campaignId: campaign.id, justCreated: true });
                        else Alert.alert('Kampanya oluşturuldu');
                    }}
                />
            ) : null}
        </Screen>
    );
}
