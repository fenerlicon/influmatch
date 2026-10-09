import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';

// "İlk adımlar" kontrol listesi. Durum web ile aynı sunucu kodundan gelir (/api/mobile/first-steps → lib/first-steps.ts).
// "Gizle" tercihi kritik olmayan arayüz durumu: yalnızca bu cihazda, kullanıcıya özel anahtarla tutulur.
const HIDDEN_KEY_PREFIX = 'first_steps_hidden:';

// Adım anahtarı → mobil ekran (web'deki href'in karşılığı).
const STEP_ROUTES = {
    verify_social: 'Verification',
    complete_profile: 'MyProfile',
    rate_card: 'MyProfile',
    first_application: 'İlanlar',
    corporate_email: 'BrandVerification',
    tax_certificate: 'BrandVerification',
    first_advert: 'BrandAdverts',
    first_offer: 'Keşfet',
};

export default function FirstStepsCard({ navigation }) {
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
                try {
                    isHidden = (await AsyncStorage.getItem(HIDDEN_KEY_PREFIX + uid)) === 'true';
                } catch (e) {
                    isHidden = false;
                }
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

    const handleHide = async () => {
        setHidden(true);
        if (!userId) return;
        try {
            await AsyncStorage.setItem(HIDDEN_KEY_PREFIX + userId, 'true');
        } catch (e) {
            // Kaydedilemezse yalnızca bu oturumda gizli kalır.
        }
    };

    if (hidden || !status || status.allDone) return null;

    const percent = Math.round((status.completed / status.total) * 100);

    return (
        <View className="mt-6 rounded-3xl border border-soft-gold/30 bg-white/[0.04] p-5">
            <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                    <Text className="text-soft-gold text-[10px] font-bold uppercase tracking-widest">İlk adımlar</Text>
                    <Text className="text-white font-bold text-lg mt-1">{status.label}</Text>
                </View>
                <TouchableOpacity
                    onPress={handleHide}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="rounded-full border border-white/10 px-3 py-1.5"
                >
                    <Text className="text-gray-300 text-xs font-medium">Gizle</Text>
                </TouchableOpacity>
            </View>

            <View className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <View className="h-full rounded-full bg-soft-gold" style={{ width: `${percent}%` }} />
            </View>

            <View className="mt-4">
                {status.steps.map((step) => {
                    const route = STEP_ROUTES[step.key];
                    return (
                        <TouchableOpacity
                            key={step.key}
                            disabled={step.done || !route}
                            onPress={() => route && navigation.navigate(route)}
                            className={`flex-row items-start gap-3 rounded-2xl border p-3 mb-2 ${step.done ? 'border-green-500/20 bg-green-500/5' : 'border-white/10 bg-white/[0.03]'}`}
                        >
                            {step.done ? (
                                <CheckCircle2 size={18} color="#4ade80" />
                            ) : (
                                <Circle size={18} color="#6b7280" />
                            )}
                            <View className="flex-1">
                                <View className="flex-row flex-wrap items-center gap-2">
                                    <Text className={`text-sm font-semibold ${step.done ? 'text-gray-400 line-through' : 'text-white'}`}>{step.title}</Text>
                                    {step.note ? (
                                        <View className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5">
                                            <Text className="text-yellow-200 text-[10px] font-semibold">{step.note}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                {!step.done ? <Text className="text-gray-400 text-xs mt-1">{step.description}</Text> : null}
                            </View>
                            {!step.done ? <ChevronRight size={16} color="#6b7280" /> : null}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
