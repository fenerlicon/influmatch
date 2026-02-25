import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Award, ChevronLeft, CheckCircle2, Circle, Lock,
    BadgeCheck, Crown, UserCheck, Megaphone, Zap, Star,
    TrendingUp, Trophy, Building, Rocket, LayoutTemplate,
    Gem, Info, ShieldCheck
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Badge Data (mirrors web app/badges/data.ts) ─────────────────────────────

const INFLUENCER_BADGES = [
    // MVP
    { id: 'verified-account', name: 'Onaylı Hesap', desc: 'Kimliği doğrulanmış influencer hesabı.', icon: BadgeCheck, phase: 'mvp' },
    { id: 'founder-member', name: 'Kurucu Üye', desc: 'Platformun ilk üyelerinden.', icon: Crown, phase: 'mvp' },
    { id: 'profile-expert', name: 'Profil Uzmanı', desc: 'Profilini eksiksiz doldurmuş kullanıcı.', icon: UserCheck, phase: 'mvp' },
    // v1.2
    { id: 'brand-ambassador', name: 'Marka Elçisi', desc: 'Markalarla uzun süreli işbirlikleri.', icon: Megaphone, phase: 'v1.2' },
    { id: 'lightning-fast', name: 'Hızlı Dönüş', desc: 'Mesajlara çok hızlı yanıt veren.', icon: Zap, phase: 'v1.2' },
    { id: 'five-star', name: '5 Yıldız', desc: 'Yüksek puanlı işbirlikleri.', icon: Star, phase: 'v1.2' },
    { id: 'trendsetter', name: 'Trend Belirleyici', desc: 'İçerikleri trend olan.', icon: TrendingUp, phase: 'v1.2' },
    // v1.3
    { id: 'million-club', name: 'Milyon Kulübü', desc: 'Milyonlarca erişime sahip.', icon: Trophy, phase: 'v1.3' },
    { id: 'conversion-wizard', name: 'Dönüşüm Sihirbazı', desc: 'Yüksek dönüşüm oranları.', icon: ShieldCheck, phase: 'v1.3' },
];

const BRAND_BADGES = [
    // MVP
    { id: 'official-business', name: 'Resmi İşletme', desc: 'Vergi levhası doğrulanmış işletme.', icon: Building, phase: 'mvp' },
    { id: 'pioneer-brand', name: 'Öncü Marka', desc: 'Platformun ilk markalarından.', icon: Rocket, phase: 'mvp' },
    { id: 'showcase-brand', name: 'Vitrin Marka', desc: 'Örnek kampanya sayfası olan marka.', icon: LayoutTemplate, phase: 'mvp' },
    // v1.2
    { id: 'jet-approval', name: 'Jet Onay', desc: 'Başvuruları hızlı onaylayan.', icon: Zap, phase: 'v1.2' },
    { id: 'elite-budget', name: 'Elit Bütçe', desc: 'Yüksek bütçeli kampanyalar.', icon: Gem, phase: 'v1.2' },
    { id: 'communication-expert', name: 'İletişim Uzmanı', desc: 'Influencerlarla iletişimi güçlü.', icon: Megaphone, phase: 'v1.2' },
    // v1.3
    { id: 'loyal-partner', name: 'Sadık Partner', desc: 'Düzenli işbirliği yapan.', icon: Star, phase: 'v1.3' },
    { id: 'global', name: 'Global', desc: 'Uluslararası faaliyet gösteren.', icon: Trophy, phase: 'v1.3' },
];

const BADGE_REQUIREMENTS = {
    'verified-account': 'Instagram hesabını doğrulayarak kazanılır.',
    'founder-member': 'Platforma ilk 1000 üye arasında katılarak kazanılır.',
    'profile-expert': 'Profil bilgilerini %100 eksiksiz doldurarak kazanılır.',
    'brand-ambassador': 'En az 5 marka ile başarılı işbirliği yaparak kazanılır.',
    'lightning-fast': 'Mesajlara ortalama 1 saatten hızlı yanıt vererek kazanılır.',
    'five-star': 'Yüksek puanlı işbirlikleriyle kazanılır.',
    'trendsetter': 'İçerikleriniz keşfet sayfasında yer alarak kazanılır.',
    'million-club': 'Milyonlarca erişime ulaşarak kazanılır.',
    'conversion-wizard': 'Yüksek dönüşüm oranlarıyla kazanılır.',
    'official-business': 'Vergi levhanız admin tarafından doğrulanarak kazanılır.',
    'pioneer-brand': 'Platforma ilk 100 marka arasında katılarak kazanılır.',
    'showcase-brand': 'Marka profilinizi eksiksiz tamamlayarak kazanılır.',
    'jet-approval': 'Başvuruları 24 saatten hızlı onaylayarak kazanılır.',
    'elite-budget': 'Yüksek bütçeli kampanyalar yayınlayarak kazanılır.',
    'communication-expert': 'Güçlü iletişim geçmişiyle kazanılır.',
    'loyal-partner': 'Düzenli işbirlikleri yaparak kazanılır.',
    'global': 'Uluslararası faaliyetler göstererek kazanılır.',
};

const PHASE_CONFIG = {
    mvp: { label: 'MVP', color: '#f59e0b', border: 'rgba(245,158,11,0.30)', bg: 'rgba(245,158,11,0.08)' },
    'v1.2': { label: 'v1.2', color: '#94a3b8', border: 'rgba(148,163,184,0.20)', bg: 'rgba(148,163,184,0.05)' },
    'v1.3': { label: 'v1.3', color: '#a855f7', border: 'rgba(168,85,247,0.20)', bg: 'rgba(168,85,247,0.05)' },
};

// ─── Earned badge row ─────────────────────────────────────────────────────────
const EarnedRow = ({ badge }) => {
    const Icon = badge.icon;
    return (
        <View className="flex-row items-start p-4 rounded-2xl border mb-3"
            style={{ borderColor: 'rgba(52,211,153,0.30)', backgroundColor: 'rgba(52,211,153,0.08)' }}>
            <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: 'rgba(52,211,153,0.15)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)' }}>
                <Icon color="#34d399" size={20} />
            </View>
            <View className="flex-1 mr-3">
                <Text className="text-white font-bold text-sm mb-0.5">{badge.name}</Text>
                <Text className="text-gray-400 text-xs leading-4">{badge.desc}</Text>
            </View>
            <CheckCircle2 color="#34d399" size={18} />
        </View>
    );
};

// ─── Unearned badge row ───────────────────────────────────────────────────────
const UnearnedRow = ({ badge }) => {
    const Icon = badge.icon;
    const isComingSoon = badge.phase !== 'mvp';
    return (
        <View className="flex-row items-start p-4 rounded-2xl border mb-3"
            style={{
                borderColor: isComingSoon ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.30)',
                backgroundColor: isComingSoon ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.08)',
                opacity: isComingSoon ? 0.7 : 1,
            }}>
            <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: 'rgba(100,116,139,0.15)', borderWidth: 1, borderColor: 'rgba(100,116,139,0.20)' }}>
                {isComingSoon ? <Lock color="#6b7280" size={17} /> : <Circle color="#f59e0b" size={20} />}
            </View>
            <View className="flex-1">
                <View className="flex-row items-center justify-between mb-0.5">
                    <Text style={{ color: isComingSoon ? 'rgba(255,255,255,0.7)' : 'white' }} className="font-bold text-sm">{badge.name}</Text>
                    {isComingSoon && (
                        <View className="bg-gray-700/80 px-2 py-0.5 rounded-full ml-2">
                            <Text className="text-gray-400 text-[9px] font-bold">{badge.phase.toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                <Text className="text-gray-400 text-xs leading-4 mb-1">{badge.desc}</Text>
                <Text className="text-gray-600 text-[10px] leading-4">
                    {BADGE_REQUIREMENTS[badge.id] || 'Platformdaki aktivitelerini artır.'}
                </Text>
            </View>
        </View>
    );
};

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ phase, count, total }) => {
    const cfg = PHASE_CONFIG[phase];
    return (
        <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3">
                <View style={{ height: 3, width: 36, borderRadius: 2, backgroundColor: cfg.color }} />
                <Text className="font-bold text-base" style={{ color: cfg.color }}>{cfg.label}</Text>
            </View>
            <Text className="text-gray-600 text-xs">{count}/{total}</Text>
        </View>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
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

            console.log('[BadgesScreen] role:', profile?.role, 'badges:', badges);

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

    const allBadges = userRole === 'brand' ? BRAND_BADGES : INFLUENCER_BADGES;
    const mvpBadges = allBadges.filter(b => b.phase === 'mvp');
    const v12Badges = allBadges.filter(b => b.phase === 'v1.2');
    const v13Badges = allBadges.filter(b => b.phase === 'v1.3');

    const earnedBadges = allBadges.filter(b => earnedIds.includes(b.id));
    const unearnedMvp = mvpBadges.filter(b => !earnedIds.includes(b.id));
    const mvpEarned = mvpBadges.filter(b => earnedIds.includes(b.id)).length;

    const progress = allBadges.length > 0 ? Math.round((earnedBadges.length / allBadges.length) * 100) : 0;

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
                <View className="px-6 py-4 flex-row items-center z-10 border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()}
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 mr-4">
                        <ChevronLeft color="white" size={22} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Rozetler</Text>
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 48 }}
                    refreshControl={<RefreshControl refreshing={refreshing}
                        onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#D4AF37" />}>

                    {/* ── Hero Card ── */}
                    <View className="relative overflow-hidden rounded-[32px] border border-soft-gold/20 p-7 mb-8 mt-5 items-center"
                        style={{ backgroundColor: 'rgba(212,175,55,0.04)' }}>
                        <LinearGradient colors={['rgba(212,175,55,0.12)', 'transparent']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />

                        <View className="w-16 h-16 rounded-full items-center justify-center border mb-4"
                            style={{ backgroundColor: 'rgba(212,175,55,0.15)', borderColor: 'rgba(212,175,55,0.30)' }}>
                            <Award color="#D4AF37" size={30} />
                        </View>

                        <Text className="text-soft-gold font-black" style={{ fontSize: 48, lineHeight: 56 }}>
                            {earnedBadges.length}
                            <Text className="text-gray-500" style={{ fontSize: 22 }}>/{allBadges.length}</Text>
                        </Text>
                        <Text className="text-gray-400 text-sm mt-1 font-medium">rozet kazanıldı</Text>

                        <View className="w-full h-2 rounded-full mt-5 overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                            <View className="h-full rounded-full" style={{ width: progress + '%', backgroundColor: '#D4AF37' }} />
                        </View>
                        <Text className="text-gray-600 text-xs mt-2">{progress}% tamamlandı</Text>

                        {/* Mini stats */}
                        <View className="flex-row gap-6 mt-5 pt-5 border-t border-white/5 w-full justify-center">
                            <View className="items-center">
                                <Text className="text-white font-black text-xl">{mvpEarned}</Text>
                                <Text className="text-gray-500 text-[10px] mt-0.5">MVP</Text>
                            </View>
                            <View className="w-px bg-white/10" />
                            <View className="items-center">
                                <Text className="text-gray-400 font-black text-xl">{allBadges.length - earnedBadges.length}</Text>
                                <Text className="text-gray-500 text-[10px] mt-0.5">KALAN</Text>
                            </View>
                            <View className="w-px bg-white/10" />
                            <View className="items-center">
                                <Text className="text-gray-500 font-black text-xl">{v12Badges.length + v13Badges.length}</Text>
                                <Text className="text-gray-500 text-[10px] mt-0.5">YAKINDA</Text>
                            </View>
                        </View>
                    </View>

                    {/* ── Rozet Durumu Card (mirrors web BadgeProgressInfo) ── */}
                    <View className="rounded-[24px] border border-white/10 p-5 mb-6"
                        style={{ backgroundColor: '#0C0F1A' }}>
                        <View className="flex-row items-start gap-3 mb-5">
                            <Info color="#D4AF37" size={18} style={{ marginTop: 1 }} />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-base">Rozet Durumu</Text>
                                <Text className="text-gray-400 text-xs mt-1">
                                    Toplam {mvpBadges.length} MVP rozetinden {mvpEarned} tanesine sahipsin.
                                </Text>
                            </View>
                        </View>

                        {/* Earned badges */}
                        {earnedBadges.length > 0 && (
                            <View className="mb-5">
                                <Text className="text-green-400 text-[10px] font-bold tracking-widest uppercase mb-3">
                                    Sahip Olduğun Rozetler ({earnedBadges.length})
                                </Text>
                                {earnedBadges.map(b => <EarnedRow key={b.id} badge={b} />)}
                            </View>
                        )}

                        {/* Unearned MVP */}
                        {unearnedMvp.length > 0 && (
                            <View className="mb-5">
                                <Text className="text-amber-300 text-[10px] font-bold tracking-widest uppercase mb-3">
                                    Kazanabileceğin Rozetler ({unearnedMvp.length})
                                </Text>
                                {unearnedMvp.map(b => <UnearnedRow key={b.id} badge={b} />)}
                            </View>
                        )}

                        {/* Future */}
                        {(v12Badges.length + v13Badges.length) > 0 && (
                            <View className="rounded-2xl border border-purple-500/20 p-4"
                                style={{ backgroundColor: 'rgba(168,85,247,0.07)' }}>
                                <Text className="text-purple-300 text-[10px] font-bold tracking-widest uppercase mb-2">
                                    Gelecek Rozetler
                                </Text>
                                <Text className="text-gray-300 text-xs leading-5">
                                    {v12Badges.length + v13Badges.length} yeni rozet yakında platforma eklenecek. Takipte kal!
                                </Text>
                                <View className="flex-row flex-wrap gap-2 mt-3">
                                    {[...v12Badges, ...v13Badges].map(b => (
                                        <View key={b.id} className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full border"
                                            style={{ borderColor: 'rgba(168,85,247,0.25)', backgroundColor: 'rgba(168,85,247,0.10)' }}>
                                            <Lock color="#a855f7" size={10} />
                                            <Text className="text-purple-300 text-[11px] font-medium">{b.name}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
