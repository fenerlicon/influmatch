import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, ChevronLeft, CheckCircle2, Lock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

// ─── Badge Definitions ────────────────────────────────────────────────────────
const ALL_BADGES = [
    { id: 'verified-account', label: 'Doğrulanmış Hesap', desc: 'Instagram hesabını doğruladın.', role: 'influencer', phase: 'mvp', color: '#60a5fa' },
    { id: 'profile-expert', label: 'Profil Uzmanı', desc: 'Profilini %100 eksiksiz doldurdun.', role: 'influencer', phase: 'mvp', color: '#D4AF37' },
    { id: 'founder-member', label: 'Kurucu Üye', desc: 'Platforma ilk 1000 influencer arasında katıldın.', role: 'influencer', phase: 'mvp', color: '#a855f7' },
    { id: 'spotlight-achiever', label: 'Spotlight Üyesi', desc: 'Spotlight premium üyeliğin aktif.', role: 'influencer', phase: 'mvp', color: '#f59e0b' },
    { id: 'first-deal', label: 'İlk Anlaşma', desc: 'İlk iş teklifini kabul ettin.', role: 'influencer', phase: 'v1.2', color: '#4ade80' },
    { id: 'top-engagement', label: 'Yüksek Etkileşim', desc: '%5+ organik etkileşim oranına ulaştın.', role: 'influencer', phase: 'v1.2', color: '#f87171' },
    { id: 'official-business', label: 'Resmi İşletme', desc: 'İşletmen admin tarafından doğrulandı.', role: 'brand', phase: 'mvp', color: '#60a5fa' },
    { id: 'showcase-brand', label: 'Vitrin Markası', desc: 'Marka profilini %100 tamamladın.', role: 'brand', phase: 'mvp', color: '#D4AF37' },
    { id: 'pioneer-brand', label: 'Öncü Marka', desc: 'Platforma ilk 100 marka arasında katıldın.', role: 'brand', phase: 'mvp', color: '#a855f7' },
    { id: 'first-campaign', label: 'İlk Kampanya', desc: 'İlk ilan kampanyanı yayınladın.', role: 'brand', phase: 'v1.2', color: '#4ade80' },
];

const PHASE_CONFIG = {
    mvp: { label: 'MVP Rozetler', textColor: 'text-soft-gold', lineColor: '#D4AF37' },
    'v1.2': { label: 'Yakında (v1.2)', textColor: 'text-gray-400', lineColor: '#64748b' },
};

// ─── Design components ────────────────────────────────────────────────────────
const GlassCard = ({ children, className, style }) => (
    <View className={`rounded-[28px] overflow-hidden border border-white/10 relative ${className}`} style={style}>
        <LinearGradient
            colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </View>
);

const BadgeRow = ({ badge, earned }) => (
    <View className={`flex-row items-center p-4 rounded-[20px] border mb-3 ${earned ? '' : 'opacity-60'}`}
        style={{ borderColor: earned ? `${badge.color}35` : 'rgba(255,255,255,0.07)', backgroundColor: earned ? `${badge.color}08` : 'rgba(255,255,255,0.02)' }}>

        {/* Icon bubble */}
        <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
            style={{ backgroundColor: earned ? `${badge.color}20` : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: earned ? `${badge.color}30` : 'rgba(255,255,255,0.08)' }}>
            {earned
                ? <Award color={badge.color} size={22} />
                : <Lock color="#4b5563" size={18} />}
        </View>

        {/* Text */}
        <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
                <Text className="text-white font-bold text-sm" style={{ color: earned ? 'white' : '#6b7280' }}>{badge.label}</Text>
                {earned && <CheckCircle2 color={badge.color} size={13} />}
            </View>
            <Text className="text-gray-500 text-xs leading-4">{badge.desc}</Text>
        </View>

        {earned && (
            <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: `${badge.color}20` }}>
                <Text className="text-[10px] font-bold" style={{ color: badge.color }}>KAZANILDI</Text>
            </View>
        )}
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BadgesScreen({ navigation }) {
    const [userRole, setUserRole] = useState('influencer');
    const [earnedIds, setEarnedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchBadges = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: profile }, { data: badges }] = await Promise.all([
                supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
                supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
            ]);

            if (profile?.role) setUserRole(profile.role);
            setEarnedIds(badges?.map(b => b.badge_id) || []);
        } catch (e) {
            console.error('[BadgesScreen] fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchBadges(); }, [fetchBadges]);

    const myBadges = ALL_BADGES.filter(b => b.role === userRole);
    const mvpBadges = myBadges.filter(b => b.phase === 'mvp');
    const v12Badges = myBadges.filter(b => b.phase === 'v1.2');
    const earnedCount = myBadges.filter(b => earnedIds.includes(b.id)).length;
    const totalCount = myBadges.length;

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
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[80px]" />

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
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBadges(); }} tintColor="#D4AF37" />}
                >
                    {/* ── Hero Summary Card ── */}
                    <View className="relative overflow-hidden rounded-[32px] border border-soft-gold/20 bg-soft-gold/[0.04] p-7 mb-8 mt-2 items-center shadow-sm">
                        <LinearGradient
                            colors={['rgba(212,175,55,0.12)', 'transparent']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            className="absolute inset-0"
                        />
                        {/* Glow orb */}
                        <View className="absolute top-0 left-1/2 w-32 h-32 bg-soft-gold/15 rounded-full blur-[60px]" />

                        <View className="w-16 h-16 bg-soft-gold/15 rounded-full items-center justify-center border border-soft-gold/30 mb-4 shadow-[0_0_20px_rgba(212,175,55,0.3)]">
                            <Award color="#D4AF37" size={30} />
                        </View>

                        <Text className="text-soft-gold text-5xl font-black tracking-tight">
                            {earnedCount}<Text className="text-gray-500 text-2xl">/{totalCount}</Text>
                        </Text>
                        <Text className="text-gray-400 text-sm mt-2 font-medium">rozet kazanıldı</Text>

                        {/* Progress bar */}
                        <View className="w-full h-1.5 bg-white/5 rounded-full mt-5 overflow-hidden">
                            <View
                                className="h-full bg-soft-gold rounded-full shadow-[0_0_8px_rgba(212,175,55,0.5)]"
                                style={{ width: `${totalCount > 0 ? (earnedCount / totalCount) * 100 : 0}%` }}
                            />
                        </View>
                    </View>

                    {/* ── MVP Phase ── */}
                    {mvpBadges.length > 0 && (
                        <View className="mb-6">
                            <View className="flex-row items-center gap-3 mb-4">
                                <LinearGradient colors={['#D4AF37', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={{ height: 3, width: 36, borderRadius: 2 }} />
                                <Text className="text-soft-gold font-bold text-lg">{PHASE_CONFIG.mvp.label}</Text>
                            </View>
                            {mvpBadges.map(b => <BadgeRow key={b.id} badge={b} earned={earnedIds.includes(b.id)} />)}
                        </View>
                    )}

                    {/* ── v1.2 Phase ── */}
                    {v12Badges.length > 0 && (
                        <View className="mb-6">
                            <View className="flex-row items-center gap-3 mb-4">
                                <LinearGradient colors={['#64748b', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                    style={{ height: 3, width: 36, borderRadius: 2 }} />
                                <Text className="text-gray-400 font-bold text-lg">{PHASE_CONFIG['v1.2'].label}</Text>
                            </View>
                            {v12Badges.map(b => <BadgeRow key={b.id} badge={b} earned={earnedIds.includes(b.id)} />)}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
