import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { Sparkles, Check, ShieldAlert, Info } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import {
    SPOTLIGHT_PLAN_PRICES, SPOTLIGHT_PLAN_FEATURES, SPOTLIGHT_PLAN_LABELS, SPOTLIGHT_PLANS_FOR_ROLE,
} from '../../constants/spotlightPlans';
import { Screen, StackHeader, Text, Button, Card, Chip, Segment, Notice, colors, ICON_STROKE } from '../../components/ui';

// Spotlight: rolün paketleri doğrudan açılır (web /dashboard/spotlight/{rol}). Satın alma kapalı; planları admin açar.

function PlanCard({ code, billing, active }) {
    const features = SPOTLIGHT_PLAN_FEATURES[code] || [];
    return (
        <Card accent={code.endsWith('pro') || active} style={{ gap: 12 }}>
            <View className="flex-row items-center justify-between">
                <Text weight="semibold" style={{ fontSize: 17 }}>{SPOTLIGHT_PLAN_LABELS[code]}</Text>
                {active ? <Chip label="Aktif plan" tone="success" /> : null}
            </View>
            <View className="flex-row items-end" style={{ gap: 4 }}>
                <Text variant="display" style={{ fontSize: 34, lineHeight: 38 }}>{SPOTLIGHT_PLAN_PRICES[code][billing]}</Text>
                <Text variant="small" tone="fg3" className="mb-1">/ {billing === 'mo' ? 'ay' : 'yıl'}</Text>
            </View>
            <View style={{ gap: 8 }}>
                {features.map((f) => (
                    <View key={f.text} className="flex-row items-center" style={{ gap: 8 }}>
                        <Check size={16} color={f.highlight ? colors.gold : colors.fg3} strokeWidth={ICON_STROKE} />
                        <Text variant="small" tone={f.highlight ? 'fg' : 'fg2'} style={{ fontSize: 14 }}>{f.text}</Text>
                    </View>
                ))}
            </View>
        </Card>
    );
}

export default function SpotlightScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [state, setState] = useState(null);
    const [billing, setBilling] = useState('mo');

    const fetchStatus = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('users')
                .select('role, spotlight_active, spotlight_plan, spotlight_expires_at, verification_status')
                .eq('id', user.id)
                .maybeSingle();
            if (data) {
                const expired = data.spotlight_expires_at && new Date(data.spotlight_expires_at) < new Date();
                setState({
                    role: data.role === 'brand' ? 'brand' : 'influencer',
                    active: !!data.spotlight_active && !expired,
                    plan: !expired && data.spotlight_active ? data.spotlight_plan : null,
                    expiresAt: data.spotlight_expires_at,
                    verified: data.verification_status === 'verified',
                });
            }
        } catch (e) {
            console.error('[SpotlightScreen]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const role = state?.role || 'influencer';
    const plans = SPOTLIGHT_PLANS_FOR_ROLE[role];

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchStatus(); }}
            header={<StackHeader title="Spotlight" onBack={() => navigation.goBack()} />}
        >
            {state?.active && state.plan ? (
                <Notice
                    tone="gold"
                    icon={Sparkles}
                    title={`Spotlight aktif · ${SPOTLIGHT_PLAN_LABELS[state.plan] || state.plan}`}
                    text={state.expiresAt ? `${formatDate(state.expiresAt)} tarihine kadar` : undefined}
                />
            ) : (
                <View style={{ gap: 6 }}>
                    <Text variant="title">Keşfette öne çık</Text>
                    <Text tone="fg2">
                        {role === 'brand'
                            ? 'Akıllı eşleştirme önerileri ve ilanlarını öne çıkaran araçlar.'
                            : 'Markalar keşfette influencer ararken Spotlight profilleri listenin üst sıralarında yer alır.'}
                    </Text>
                </View>
            )}

            {state && !state.verified ? (
                <Notice tone="danger" icon={ShieldAlert} text="Spotlight için hesabının doğrulanmış olması gerekiyor." />
            ) : null}

            <Segment options={[{ key: 'mo', label: 'Aylık' }, { key: 'yr', label: 'Yıllık' }]} value={billing} onChange={setBilling} />

            {plans.map((code) => <PlanCard key={code} code={code} billing={billing} active={state?.plan === code} />)}

            <Notice tone="info" icon={Info} text="Satın alma henüz uygulamada yok. Paket için destek ekibine yazabilirsin." />
            <Button title="Destek ekibine yaz" variant="secondary" onPress={() => Linking.openURL('mailto:destek@influmatch.net?subject=Spotlight').catch(() => null)} block />
        </Screen>
    );
}
