import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, ChevronLeft, CheckCircle2, Lock, Star, Zap, Shield, TrendingUp, Briefcase, Users } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Badge definitions with progress support ──────────────────────────────────
const ALL_BADGES = [
    {
        id: 'verified-account',
        label: 'Doğrulanmış Hesap',
        desc: 'Instagram hesabını doğrula.',
        role: 'influencer',
        phase: 'mvp',
        color: '#60a5fa',
        icon: Shield,
        progressKey: 'is_instagram_verified', // boolean
    },
    {
        id: 'profile-expert',
        label: 'Profil Uzmanı',
        desc: 'Profilini %100 eksiksiz doldur.',
        role: 'influencer',
        phase: 'mvp',
        color: '#D4AF37',
        icon: Star,
        progressKey: 'profile_completeness', // 0-100
        progressMax: 100,
        progressUnit: '%',
    },
    {
        id: 'founder-member',
        label: 'Kurucu Üye',
        desc: 'Platforma ilk 1000 influencer arasında katıl.',
        role: 'influencer',
        phase: 'mvp',
        color: '#a855f7',
        icon: Award,
        progressKey: 'is_founder', // boolean
    },
    {
        id: 'spotlight-achiever',
        label: 'Spotlight Üyesi',
        desc: 'Spotlight premium üyeliğini aktif et.',
        role: 'influencer',
        phase: 'mvp',
        color: '#f59e0b',
        icon: Zap,
        progressKey: 'has_spotlight', // boolean
    },
    {
        id: 'first-deal',
        label: 'İlk Anlaşma',
        desc: 'İlk marka teklifini kabul et.',
        role: 'influencer',
        phase: 'v1.2',
        color: '#4ade80',
        icon: Briefcase,
        progressKey: 'deal_count', // number
        progressMax: 1,
        progressUnit: ' teklif',
    },
    {
        id: 'top-engagement',
        label: 'Yüksek Etkileşim',
        desc: '%5 organik etkileşim oranına ulaş.',
        role: 'influencer',
        phase: 'v1.2',
        color: '#f87171',
        icon: TrendingUp,
        progressKey: 'engagement_rate', // number
        progressMax: 5,
        progressUnit: '%',
    },
    {
        id: 'official-business',
        label: 'Resmi İşletme',
        desc: 'Marka profilini admin onayla.',
        role: 'brand',
        phase: 'mvp',
        color: '#60a5fa',
        icon: Shield,
        progressKey: 'is_verified', // boolean
    },
    {
        id: 'showcase-brand',
        label: 'Vitrin Markası',
        desc: 'Marka profilini %100 tamamla.',
        role: 'brand',
        phase: 'mvp',
        color: '#D4AF37',
        icon: Star,
        progressKey: 'profile_completeness',
        progressMax: 100,
        progressUnit: '%',
    },
    {
        id: 'pioneer-brand',
        label: 'Öncü Marka',
        desc: 'Platforma ilk 100 marka arasında katıl.',
        role: 'brand',
        phase: 'mvp',
        color: '#a855f7',
        icon: Award,
        progressKey: 'is_founder',
    },
    {
        id: 'first-campaign',
        label: 'İlk Kampanya',
        desc: 'İlk ilan kampanyanı yayınla.',
        role: 'brand',
        phase: 'v1.2',
        color: '#4ade80',
        icon: Briefcase,
        progressKey: 'campaign_count',
        progressMax: 1,
        progressUnit: ' ilan',
    },
];

// ─── Progress helpers ─────────────────────────────────────────────────────────
function calcProgress(badge, metrics) {
    const val = metrics[badge.progressKey];
    if (val === undefined || val === null) return { ratio: 0, text: null };

    if (badge.progressMax) {
        const ratio = Math.min(Number(val) / badge.progressMax, 1);
        const display = badge.progressKey === 'engagement_rate'
            ? `%${Number(val).toFixed(1)} / %${badge.progressMax}`
            : `${Math.round(Number(val))}${badge.progressUnit} / ${badge.progressMax}${badge.progressUnit}`;
        return { ratio, text: display };
    }
    // boolean
    return { ratio: val ? 1 : 0, text: null };
}

// ─── Badge Card ───────────────────────────────────────────────────────────────
const BadgeCard = ({ badge, earned, metrics }) => {
    const Icon = badge.icon || Award;
    const { ratio, text } = calcProgress(badge, metrics);
    const pct = Math.round(ratio * 100);

    return (
        <View
            className="rounded-[20px] border mb-3 overflow-hidden"
            style={{
                borderColor: earned ? `${badge.color}40` : 'rgba(255,255,255,0.07)',
                backgroundColor: earned ? `${badge.color}08` : 'rgba(255,255,255,0.02)',
                opacity: badge.phase === 'v1.2' && !earned ? 0.65 : 1,
            }}
        >
            <View className="flex-row items-center p-4">
                {/* Icon */}
                <View
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                    style={{
                        backgroundColor: earned ? `${badge.color}20` : 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: earned ? `${badge.color}35` : 'rgba(255,255,255,0.08)',
                    }}
                >
                    {earned
                        ? <Icon color={badge.color} size={22} />
                        : <Lock color="#4b5563" size={18} />}
                </View>

                {/* Text */}
                <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-0.5">
                        <Text className="font-bold text-sm" style={{ color: earned ? 'white' : '#6b7280' }}>
                            {badge.label}
                        </Text>
                        {earned && <CheckCircle2 color={badge.color} size={13} />}
                    </View>
                    <Text className="text-gray-500 text-xs leading-4">{badge.desc}</Text>
                </View>

                {/* Status badge */}
                {earned ? (
                    <View className="px-2 py-1 rounded-lg ml-2" style={{ backgroundColor: `${badge.color}20` }}>
                        <Text className="text-[10px] font-bold" style={{ color: badge.color }}>KAZANILDI</Text>
                    </View>
                ) : badge.phase === 'v1.2' ? (
                    <View className="px-2 py-1 rounded-lg ml-2 bg-gray-800">
                        <Text className="text-[10px] font-bold text-gray-500">YAKINDA</Text>
                    </View>
                ) : (
                    <View className="px-2 py-1 rounded-lg ml-2 bg-white/5">
                        <Text className="text-[10px] font-bold text-gray-600">{pct}%</Text>
                    </View>
                )}
            </View>

            {/* Progress bar (only for unearned MVP badges with measurable progress) */}
            {!earned && badge.phase === 'mvp' && badge.progressMax && (
                <View className="px-4 pb-4">
                    <View className="flex-row justify-between mb-1.5">
                        <Text className="text-gray-600 text-[10px]">İlerleme</Text>
                        {text && <Text className="text-gray-500 text-[10px]">{text}</Text>}
                    </View>
                    <View className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <View
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: badge.color }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, color, count, total }) => (
    <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3">
            <View style={{ height: 3, width: 36, borderRadius: 2, backgroundColor: color }} />
            <Text className="font-bold text-base" style={{ color }}>{title}</Text>
        </View>
        <Text className="text-gray-600 text-xs">{count}/{total} kazanıldı</Text>
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BadgesScreen({ navigation }) {
    const [userRole, setUserRole] = useState('influencer');
    const [earnedIds, setEarnedIds] = useState([]);
    const [metrics, setMetrics] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [
                { data: profile },
                { data: badges },
                { data: social },
                { data: applications },
            ] = await Promise.all([
                supabase.from('users').select('role, full_name, username, bio, city, avatar_url, category').eq('id', user.id).maybeSingle(),
                supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
                supabase.from('social_accounts').select('engagement_rate, is_verified').eq('user_id', user.id).eq('platform', 'instagram').maybeSingle(),
                supabase.from('applications').select('id').eq('influencer_id', user.id).eq('status', 'accepted'),
            ]);

            const role = profile?.role || 'influencer';
            setUserRole(role);
            setEarnedIds(badges?.map(b => b.badge_id) || []);

            // Calculate profile completeness
            const fields = ['full_name', 'username', 'bio', 'city', 'avatar_url', 'category'];
            const filled = fields.filter(f => profile?.[f] && String(profile[f]).trim() !== '').length;
            const profilePct = Math.round((filled / fields.length) * 100);

            // Build metrics
            setMetrics({
                is_instagram_verified: social?.is_verified || false,
                profile_completeness: profilePct,
                is_founder: false, // will be set by admin badge assignment
                has_spotlight: badges?.some(b => b.badge_id === 'spotlight-achiever') || false,
                engagement_rate: social?.engagement_rate || 0,
                deal_count: applications?.length || 0,
                is_verified: false,
                campaign_count: 0,
            });
        } catch (e) {
            console.error('[BadgesScreen]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const myBadges = ALL_BADGES.filter(b => b.role === userRole);
    const mvpBadges = myBadges.filter(b => b.phase === 'mvp');
    const v12Badges = myBadges.filter(b => b.phase === 'v1.2');
    const earnedCount = myBadges.filter(b => earnedIds.includes(b.id)).length;
    const totalCount = myBadges.length;
    const mvpEarned = mvpBadges.filter(b => earnedIds.includes(b.id)).length;
    const v12Earned = v12Badges.filter(b => earnedIds.includes(b.id)).length;
    const progressPct = totalCount > 0 ? earnedCount / totalCount : 0;

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
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center z-10">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 mr-4"
                    >
                        <ChevronLeft color="white" size={22} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Rozetler</Text>
                </View>

                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 48 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchData(); }}
                            tintColor="#D4AF37"
                        />
                    }
                >
                    {/* ── Hero Summary Card ── */}
                    <View className="relative overflow-hidden rounded-[32px] border border-soft-gold/20 bg-soft-gold/[0.04] p-7 mb-8 mt-2 items-center">
                        <LinearGradient
                            colors={['rgba(212,175,55,0.12)', 'transparent']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            className="absolute inset-0"
                        />
                        <View className="absolute top-0 left-1/4 w-32 h-32 bg-soft-gold/10 rounded-full" style={{ transform: [{ scaleX: 2 }] }} />

                        <View className="w-16 h-16 bg-soft-gold/15 rounded-full items-center justify-center border border-soft-gold/30 mb-4">
                            <Award color="#D4AF37" size={30} />
                        </View>

                        <Text className="text-soft-gold text-5xl font-black">
                            {earnedCount}<Text className="text-gray-500 text-2xl">/{totalCount}</Text>
                        </Text>
                        <Text className="text-gray-400 text-sm mt-1.5 font-medium">rozet kazanıldı</Text>

                        {/* Overall progress bar */}
                        <View className="w-full h-2 bg-white/5 rounded-full mt-5 overflow-hidden">
                            <View
                                className="h-full rounded-full"
                                style={{ width: `${progressPct * 100}%`, backgroundColor: '#D4AF37' }}
                            />
                        </View>
                        <Text className="text-gray-600 text-xs mt-2">
                            {Math.round(progressPct * 100)}% tamamlandı
                        </Text>

                        {/* Mini stats row */}
                        <View className="flex-row gap-6 mt-5 pt-5 border-t border-white/5 w-full justify-center">
                            <View className="items-center">
                                <Text className="text-white font-black text-xl">{mvpEarned}</Text>
                                <Text className="text-gray-500 text-[10px] mt-0.5">MVP</Text>
                            </View>
                            <View className="w-px bg-white/10" />
                            <View className="items-center">
                                <Text className="text-gray-500 font-black text-xl">{v12Earned}</Text>
                                <Text className="text-gray-500 text-[10px] mt-0.5">YAKINDA</Text>
                            </View>
                            <View className="w-px bg-white/10" />
                            <View className="items-center">
                                <Text className="text-gray-400 font-black text-xl">{totalCount - earnedCount}</Text>
                                <Text className="text-gray-500 text-[10px] mt-0.5">KALAN</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── Earned section (if any) ── */}
                    {earnedCount > 0 && (
                        <View className="mb-6">
                            <View className="flex-row items-center gap-3 mb-4">
                                <View style={{ height: 3, width: 36, borderRadius: 2, backgroundColor: '#4ade80' }} />
                                <Text className="font-bold text-base text-green-400">Kazanılan Rozetler</Text>
                                <View className="bg-green-500/15 px-2 py-0.5 rounded-full">
                                    <Text className="text-green-400 text-[10px] font-bold">{earnedCount}</Text>
                                </View>
                            </View>
                            {myBadges.filter(b => earnedIds.includes(b.id)).map(b => (
                                <BadgeCard key={b.id} badge={b} earned metrics={metrics} />
                            ))}
                        </View>
                    )}

                    {/* ── MVP Badges (unearned) ── */}
                    {mvpBadges.filter(b => !earnedIds.includes(b.id)).length > 0 && (
                        <View className="mb-6">
                            <SectionHeader
                                title="MVP Rozetler"
                                color="#D4AF37"
                                count={mvpEarned}
                                total={mvpBadges.length}
                            />
                            {mvpBadges
                                .filter(b => !earnedIds.includes(b.id))
                                .map(b => (
                                    <BadgeCard key={b.id} badge={b} earned={false} metrics={metrics} />
                                ))}
                        </View>
                    )}

                    {/* ── v1.2 Badges ── */}
                    {v12Badges.length > 0 && (
                        <View className="mb-6">
                            <SectionHeader
                                title="Yakında (v1.2)"
                                color="#64748b"
                                count={v12Earned}
                                total={v12Badges.length}
                            />
                            {v12Badges.map(b => (
                                <BadgeCard key={b.id} badge={b} earned={earnedIds.includes(b.id)} metrics={metrics} />
                            ))}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
