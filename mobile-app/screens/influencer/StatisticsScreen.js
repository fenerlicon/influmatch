import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, BarChart2, TrendingUp, Users, Eye, Zap, Heart, MessageCircle, Play, Instagram, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

// ─── Design System ──────────────────────────────────────────────────────────
const GlassCard = ({ children, className, style, onPress }) => (
    <TouchableOpacity
        activeOpacity={onPress ? 0.85 : 1}
        onPress={onPress}
        style={style}
        className={`rounded-[28px] overflow-hidden border border-white/10 relative ${className}`}
    >
        <LinearGradient
            colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </TouchableOpacity>
);

const AccentCard = ({ children, color = '#D4AF37', className }) => (
    <View className={`rounded-[28px] overflow-hidden relative border ${className}`}
        style={{ borderColor: `${color}30` }}>
        <LinearGradient
            colors={[`${color}12`, `${color}05`]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </View>
);

const formatNumber = (num) => {
    if (!num && num !== 0) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
};

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
    const engColor = engagementRate > 3 ? '#4ade80' : engagementRate > 1 ? '#fbbf24' : '#f87171';

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

            {/* Master background */}
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10"
                    >
                        <ChevronLeft color="white" size={22} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold tracking-tight">İstatistikler</Text>
                    <View className="w-11" />
                </View>

                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 48 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} tintColor="#D4AF37" />}
                >
                    {!socialData ? (
                        /* ── No Instagram ── */
                        <GlassCard className="p-8 items-center mt-4">
                            <View className="w-20 h-20 rounded-full bg-white/5 border border-white/10 items-center justify-center mb-5">
                                <Instagram color="#6b7280" size={36} />
                            </View>
                            <Text className="text-white text-xl font-bold text-center mb-3">Instagram Bağlı Değil</Text>
                            <Text className="text-gray-400 text-sm text-center leading-6 px-4">
                                İstatistiklerini görmek için Profil → Profilim ekranından Instagram hesabını bağla.
                            </Text>
                        </GlassCard>
                    ) : (
                        <>
                            {/* ── Platform badge & date ── */}
                            <View className="flex-row items-center justify-between mt-2 mb-6">
                                <View className="flex-row items-center gap-2 bg-purple-500/10 border border-purple-500/25 rounded-full px-4 py-2">
                                    <Instagram color="#a855f7" size={15} />
                                    <Text className="text-purple-300 text-xs font-bold">@{socialData.username || 'instagram'}</Text>
                                </View>
                                {lastUpdated && (
                                    <Text className="text-gray-600 text-xs">Güncelleme: {lastUpdated}</Text>
                                )}
                            </View>

                            {/* ── Hero row: Followers + Engagement ── */}
                            <View className="flex-row gap-3 mb-3">
                                {/* Followers card */}
                                <GlassCard className="flex-1 p-5">
                                    <LinearGradient
                                        colors={['rgba(168,85,247,0.12)', 'transparent']}
                                        className="absolute top-0 left-0 w-full h-1/2"
                                    />
                                    <View className="w-10 h-10 bg-purple-500/15 rounded-2xl items-center justify-center mb-3 border border-purple-500/20">
                                        <Users color="#d8b4fe" size={18} />
                                    </View>
                                    <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1">TAKİPÇİ</Text>
                                    <Text className="text-white text-3xl font-black tracking-tight">{formatNumber(followerCount)}</Text>
                                    <Text className="text-gray-600 text-[10px] mt-1">Toplam</Text>
                                </GlassCard>

                                {/* Engagement card */}
                                <AccentCard color={engColor} className="flex-1 p-5">
                                    <View className="w-10 h-10 bg-white/5 rounded-2xl items-center justify-center mb-3 border border-white/10">
                                        <Zap color={engColor} size={18} />
                                    </View>
                                    <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mb-1">ETKİLEŞİM</Text>
                                    <Text className="text-white text-3xl font-black tracking-tight">%{engagementRate.toFixed(1)}</Text>
                                    <View className="mt-2 self-start px-2 py-0.5 rounded-lg" style={{ backgroundColor: `${engColor}20` }}>
                                        <Text className="text-[10px] font-bold" style={{ color: engColor }}>{engLabel}</Text>
                                    </View>
                                </AccentCard>
                            </View>

                            {/* ── Content Performance ── */}
                            <AccentCard color="#D4AF37" className="p-5 mb-3">
                                <Text className="text-soft-gold text-[10px] font-bold tracking-widest uppercase mb-5">İÇERİK PERFORMANSI • ORTALAMA</Text>
                                {[
                                    { icon: Heart, color: '#f87171', label: 'Beğeni / Post', value: formatNumber(avgLikes) },
                                    { icon: Play, color: '#60a5fa', label: 'Görüntülenme / Post', value: formatNumber(avgViews) },
                                    { icon: MessageCircle, color: '#4ade80', label: 'Yorum / Post', value: formatNumber(avgComments) },
                                    ...(avgSaves ? [{ icon: Eye, color: '#a78bfa', label: 'Kayıt / Post', value: formatNumber(avgSaves) }] : []),
                                ].map((item, i, arr) => (
                                    <View key={i} className={`flex-row items-center justify-between ${i < arr.length - 1 ? 'mb-4 pb-4 border-b border-white/5' : ''}`}>
                                        <View className="flex-row items-center gap-3">
                                            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${item.color}15` }}>
                                                <item.icon color={item.color} size={17} />
                                            </View>
                                            <Text className="text-gray-300 text-sm font-medium">{item.label}</Text>
                                        </View>
                                        <Text className="text-white text-xl font-bold">{item.value}</Text>
                                    </View>
                                ))}
                            </AccentCard>

                            {/* ── Account details ── */}
                            <GlassCard className="p-5">
                                <Text className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-5">HESAP BİLGİLERİ</Text>
                                {[
                                    { label: 'Toplam Gönderi', value: postCount ? `${postCount}` : '—' },
                                    { label: 'Haftalık Paylaşım Sıklığı', value: postingFreq != null ? `~${postingFreq.toFixed(1)} / hafta` : '—' },
                                    { label: 'Platform', value: 'Instagram' },
                                ].map((item, i, arr) => (
                                    <View key={i} className={`flex-row justify-between items-center ${i < arr.length - 1 ? 'mb-4 pb-4 border-b border-white/5' : ''}`}>
                                        <Text className="text-gray-400 text-sm">{item.label}</Text>
                                        <Text className="text-white text-sm font-semibold">{item.value}</Text>
                                    </View>
                                ))}
                            </GlassCard>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
