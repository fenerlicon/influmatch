import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Star, Check, Clock, ShieldAlert, Sparkles } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

// ─── Plan config ──────────────────────────────────────────────────────────────
const PLANS = {
    ibasic: {
        label: 'Influencer Basic',
        gradient: ['#0f172a', '#1e293b'],
        color: '#60a5fa',
        price: { mo: '299 ₺', yr: '2.990 ₺' },
        features: [
            'Vitrin sırasında üst sıralara geç',
            'Mavi doğrulama rozeti',
            'Markalara öncelikli görünürlük',
            'Temel profil analitikleri',
        ],
    },
    ipro: {
        label: 'Influencer Pro',
        gradient: ['#1c1c2e', '#2a2a3e'],
        color: '#D4AF37',
        price: { mo: '599 ₺', yr: '5.990 ₺' },
        features: [
            'Vitrin en üstünde yer al',
            'Altın doğrulama rozeti',
            'Öncelikli teklif bildirimleri',
            'Detaylı profil analitikleri',
            'AI destekli istatistik önerileri',
        ],
    },
};

// ─── Glass card ───────────────────────────────────────────────────────────────
const GlassCard = ({ children, className, style }) => (
    <View className={`rounded-[30px] overflow-hidden border border-white/10 relative ${className}`} style={style}>
        <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </View>
);

// ─── Pricing card ─────────────────────────────────────────────────────────────
const PricingCard = ({ tier, plan, isActive, interval, onPress }) => {
    const isPro = tier === 'ipro';
    return (
        <LinearGradient
            colors={plan.gradient}
            className={`rounded-[28px] border mb-4 overflow-hidden relative`}
            style={{ borderColor: isActive ? '#4ade8040' : `${plan.color}35` }}
        >
            {/* Subtle top glow */}
            <View className="absolute top-0 left-0 right-0 h-20 opacity-30"
                style={{ backgroundColor: plan.color }}>
                <LinearGradient colors={[`${plan.color}30`, 'transparent']} className="flex-1" />
            </View>

            {/* Badge */}
            {isPro && !isActive && (
                <View className="absolute top-0 right-0 bg-soft-gold px-4 py-1.5 rounded-bl-2xl z-10">
                    <Text className="text-midnight text-[9px] font-black tracking-widest">EN POPÜLER</Text>
                </View>
            )}
            {isActive && (
                <View className="absolute top-0 left-0 bg-green-500 px-4 py-1.5 rounded-br-2xl z-10">
                    <Text className="text-black text-[9px] font-black tracking-widest">AKTİF PLANIN</Text>
                </View>
            )}

            <View className="p-6 pt-8">
                <Text className="font-bold text-base mb-1" style={{ color: plan.color }}>
                    {plan.label.toUpperCase()}
                </Text>

                {/* Price */}
                <View className="flex-row items-end mb-5 mt-1">
                    <Text className="text-white text-4xl font-black tracking-tight">
                        {plan.price[interval]}
                    </Text>
                    <Text className="text-gray-500 text-sm mb-1 ml-1">/{interval === 'mo' ? 'ay' : 'yıl'}</Text>
                </View>

                {/* Features */}
                <View className="gap-3 mb-6">
                    {plan.features.map((f, i) => (
                        <View key={i} className="flex-row items-center gap-3">
                            <View className="w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: `${plan.color}20` }}>
                                <Check color={plan.color} size={11} strokeWidth={3} />
                            </View>
                            <Text className="text-gray-300 text-sm flex-1">{f}</Text>
                        </View>
                    ))}
                </View>

                {/* CTA */}
                <TouchableOpacity
                    onPress={isActive ? null : onPress}
                    className="h-13 rounded-2xl items-center justify-center border"
                    style={{
                        height: 52,
                        backgroundColor: isActive ? 'rgba(74,222,128,0.08)' : `${plan.color}12`,
                        borderColor: isActive ? 'rgba(74,222,128,0.25)' : `${plan.color}40`,
                    }}
                >
                    <Text className="font-bold text-sm" style={{ color: isActive ? '#4ade80' : plan.color }}>
                        {isActive ? '✓ Aktif Plan' : 'Satın Alma Yakında'}
                    </Text>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SpotlightScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [spotlightActive, setSpotlightActive] = useState(false);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [verificationStatus, setVerificationStatus] = useState(null);
    const [billingInterval, setBillingInterval] = useState('mo');

    const fetchStatus = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('users')
                .select('spotlight_active, spotlight_plan, spotlight_expires_at, verification_status')
                .eq('id', user.id)
                .maybeSingle();

            if (data) {
                const expired = data.spotlight_expires_at && new Date(data.spotlight_expires_at) < new Date();
                setSpotlightActive(!!data.spotlight_active && !expired);
                setCurrentPlan((!expired && data.spotlight_active) ? data.spotlight_plan : null);
                setVerificationStatus(data.verification_status);
            }
        } catch (e) {
            console.error('[SpotlightScreen]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    const onSubscribePress = (tier) => {
        Alert.alert(
            'Ödeme Sistemi Hazırlanıyor',
            `${PLANS[tier]?.label || ''} paketi yakında aktif olacak.\n\nDetay için: destek@influmatch.net`,
            [{ text: 'Tamam' }]
        );
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* Master backgrounds */}
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/8 rounded-full blur-[100px]" />
            <View className="absolute bottom-20 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center gap-4 border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Spotlight Paketleri</Text>
                </View>

                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} tintColor="#D4AF37" />}
                >
                    {/* ── Active Plan or Hero ── */}
                    {spotlightActive && currentPlan ? (
                        <GlassCard className="p-5 mb-6 border-soft-gold/20 flex-row items-center gap-4">
                            <LinearGradient colors={['rgba(212,175,55,0.15)', 'transparent']} className="absolute inset-0" />
                            <View className="w-12 h-12 bg-soft-gold/15 rounded-2xl border border-soft-gold/30 items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                                <Star color="#D4AF37" size={22} fill="#D4AF37" />
                            </View>
                            <View className="flex-1">
                                <Text className="text-soft-gold font-bold text-base">Spotlight Aktif ✓</Text>
                                <Text className="text-gray-400 text-xs mt-0.5">{PLANS[currentPlan]?.label || currentPlan} paketi</Text>
                            </View>
                        </GlassCard>
                    ) : (
                        <View className="items-center mb-7">
                            {/* Glow orb behind icon */}
                            <View className="absolute top-0 w-36 h-36 bg-soft-gold/15 rounded-full blur-[60px]" />
                            <View className="w-20 h-20 bg-soft-gold/10 rounded-full items-center justify-center mb-5 border border-soft-gold/25 shadow-[0_0_28px_rgba(212,175,55,0.25)]">
                                <Star color="#D4AF37" size={40} fill="#D4AF37" />
                            </View>
                            <Text className="text-white text-2xl font-black text-center tracking-tight mb-2">Öne Çıkın,{'\n'}Daha Fazla İş Alın</Text>
                            <Text className="text-gray-400 text-center text-sm leading-5 px-6">
                                Profilinizi markaların vitrininde en üste taşıyın.
                            </Text>
                        </View>
                    )}

                    {/* ── Verification warning ── */}
                    {verificationStatus !== 'verified' && (
                        <View className="flex-row items-center gap-3 bg-red-500/8 border border-red-500/20 rounded-2xl p-4 mb-4">
                            <ShieldAlert color="#f87171" size={17} />
                            <Text className="text-red-300 text-sm flex-1 leading-5">Spotlight için hesabınızın doğrulanmış olması gerekiyor.</Text>
                        </View>
                    )}

                    {/* ── Coming Soon banner ── */}
                    <View className="flex-row items-center gap-3 bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 mb-6">
                        <Sparkles color="#fbbf24" size={16} />
                        <Text className="text-amber-300 text-sm flex-1">Satın alma yakında açılıyor — şu an önizleme modundayız.</Text>
                    </View>

                    {/* ── Billing toggle ── */}
                    <View className="flex-row bg-white/5 rounded-2xl p-1.5 border border-white/10 mb-6">
                        {['mo', 'yr'].map((iv) => (
                            <TouchableOpacity key={iv} onPress={() => setBillingInterval(iv)}
                                className={`flex-1 py-2.5 rounded-xl items-center ${billingInterval === iv ? 'bg-white/10' : ''}`}>
                                <Text className={`font-bold text-sm ${billingInterval === iv ? 'text-white' : 'text-gray-500'}`}>
                                    {iv === 'mo' ? 'Aylık' : 'Yıllık'}
                                </Text>
                                {iv === 'yr' && <Text className="text-soft-gold text-[9px] font-bold mt-0.5">2 AY BEDAVA</Text>}
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── Pricing cards ── */}
                    {['ibasic', 'ipro'].map((tier) => (
                        <PricingCard
                            key={tier}
                            tier={tier}
                            plan={PLANS[tier]}
                            isActive={currentPlan === tier}
                            interval={billingInterval}
                            onPress={() => onSubscribePress(tier)}
                        />
                    ))}

                    <Text className="text-gray-700 text-[11px] text-center mt-2">
                        Satın alma için: destek@influmatch.net
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
