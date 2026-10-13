import React, { useState, useCallback } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { Text, Button, Card, Chip, Ring, StepBar } from './ui';

// "Hesap durumu": ilk adımlar tek kartta, yalnızca sıradaki adım (design/mobile). Durum web ile aynı sunucu
// hesabından gelir (/api/mobile/first-steps → lib/first-steps.ts). "Gizle" tercihi yalnızca bu cihazda, kullanıcıya özel.
const HIDDEN_KEY_PREFIX = 'first_steps_hidden:';

// Adım anahtarı → mobil ekran (web'deki href'in karşılığı)
const STEP_ROUTES = {
    verify_social: ['Verification'],
    complete_profile: ['MyProfile'],
    rate_card: ['MyProfile', { section: 'rate-card' }],
    first_application: ['İlanlar'],
    corporate_email: ['BrandVerification'],
    tax_certificate: ['BrandVerification'],
    first_advert: ['BrandAdverts'],
    first_offer: ['Keşfet'],
};

export default function AccountStatusCard({ navigation }) {
    const [status, setStatus] = useState(null);
    const [userId, setUserId] = useState(null);
    const [hidden, setHidden] = useState(true); // depolama okunana kadar gizli

    useFocusEffect(
        useCallback(() => {
            let active = true;
            (async () => {
                const { data: { session } } = await supabase.auth.getSession();
                const uid = session?.user?.id;
                if (!uid) return;
                let isHidden = false;
                try { isHidden = (await AsyncStorage.getItem(HIDDEN_KEY_PREFIX + uid)) === 'true'; } catch (e) { isHidden = false; }
                if (!active) return;
                setUserId(uid);
                setHidden(isHidden);
                if (isHidden) return;
                const result = await apiRequest('first-steps');
                if (active && !result.error) setStatus(result.status || null);
            })();
            return () => { active = false; };
        }, [])
    );

    const hide = async () => {
        setHidden(true);
        if (!userId) return;
        try { await AsyncStorage.setItem(HIDDEN_KEY_PREFIX + userId, 'true'); } catch (e) { /* yalnızca bu oturumda gizli */ }
    };

    if (hidden || !status || status.allDone) return null;
    const next = status.steps.find((s) => !s.done);
    if (!next) return null;
    const route = STEP_ROUTES[next.key];
    const percent = Math.round((status.completed / status.total) * 100);

    return (
        <Card style={{ gap: 14 }}>
            <View className="flex-row items-center" style={{ gap: 14 }}>
                <Ring value={percent} />
                <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                        <Text variant="eyebrow">Hesap durumu</Text>
                        <Text variant="caption" tone="fg3" onPress={hide} suppressHighlighting>Gizle</Text>
                    </View>
                    <Text weight="semibold" style={{ fontSize: 16 }} className="mt-0.5">Sıradaki adım: {next.title.toLocaleLowerCase('tr-TR')}</Text>
                    <Text variant="small" tone="fg2">{next.description}</Text>
                    {next.note ? <View className="mt-1.5"><Chip label={next.note} tone="warning" /></View> : null}
                </View>
            </View>
            <StepBar total={status.total} done={status.completed} current={status.completed} />
            <Text variant="caption" tone="fg3">{status.label}</Text>
            {route ? <Button title={next.title} onPress={() => navigation.navigate(...route)} block /> : null}
        </Card>
    );
}
