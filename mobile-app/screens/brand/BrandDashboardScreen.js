import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Briefcase, Users, ChevronRight, CheckCircle2, Clock, XCircle, Plus, Sparkles, TrendingUp } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Design system ────────────────────────────────────────────────────────────
const GlassCard = ({ children, className, style, onPress }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress}
        className={`rounded-[28px] overflow-hidden border border-white/10 relative ${className}`} style={style}>
        <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </TouchableOpacity>
);

const STATUS_CONFIG = {
    pending: { label: 'Bekliyor', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', Icon: Clock },
    shortlisted: { label: 'Kısa Liste', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', Icon: Sparkles },
    accepted: { label: 'Kabul', color: '#4ade80', bg: 'rgba(74,222,128,0.12)', Icon: CheckCircle2 },
    rejected: { label: 'Reddedildi', color: '#f87171', bg: 'rgba(248,113,113,0.12)', Icon: XCircle },
};

const StatCard = ({ icon: Icon, color, value, label }) => (
    <GlassCard className="flex-1 p-4">
        <View className="w-9 h-9 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: `${color}20` }}>
            <Icon color={color} size={18} />
        </View>
        <Text className="text-white text-2xl font-black">{value}</Text>
        <Text className="text-gray-500 text-[11px] mt-0.5 leading-4">{label}</Text>
    </GlassCard>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandDashboardScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ projects: 0, applications: 0, accepted: 0 });
    const [recentApplications, setRecentApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch brand profile
            const { data: prof } = await supabase
                .from('users')
                .select('full_name, avatar_url, corporate_name, verification_status')
                .eq('id', user.id)
                .maybeSingle();
            setProfile(prof);

            // Fetch brand's projects
            const { data: projects } = await supabase
                .from('advert_projects')
                .select('id')
                .eq('brand_user_id', user.id);

            const projectIds = projects?.map(p => p.id) || [];

            if (projectIds.length === 0) {
                setStats({ projects: 0, applications: 0, accepted: 0 });
                setRecentApplications([]);
                return;
            }

            // Fetch applications for those projects
            const { data: apps } = await supabase
                .from('advert_applications')
                .select(`
                    id, status, created_at, cover_letter,
                    advert_projects:advert_id(title),
                    influencer:influencer_id(id, full_name, username, avatar_url, verification_status)
                `)
                .in('advert_id', projectIds)
                .order('created_at', { ascending: false })
                .limit(20);

            const accepted = apps?.filter(a => a.status === 'accepted').length || 0;
            setStats({
                projects: projects.length,
                applications: apps?.length || 0,
                accepted,
            });
            setRecentApplications(apps?.slice(0, 6) || []);
        } catch (e) {
            console.error('[BrandDashboard]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const firstName = profile?.full_name?.split(' ')[0] || profile?.corporate_name || 'Hoş Geldiniz';

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
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-20 -left-20 w-80 h-80 bg-blue-600/8 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 pt-4 pb-2 flex-row justify-between items-center">
                    <View>
                        <Text className="text-gray-400 text-sm font-medium">Tekrar Hoş Geldin,</Text>
                        <Text className="text-white font-bold text-3xl tracking-tight">{firstName}</Text>
                    </View>
                    <TouchableOpacity className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10">
                        <Bell color="white" size={20} />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#D4AF37" />}
                >
                    {/* Quick Stats */}
                    <View className="flex-row gap-3 mt-5 mb-6">
                        <StatCard icon={Briefcase} color="#D4AF37" value={stats.projects} label={'Aktif\nİlan'} />
                        <StatCard icon={Users} color="#a855f7" value={stats.applications} label={'Toplam\nBaşvuru'} />
                        <StatCard icon={CheckCircle2} color="#4ade80" value={stats.accepted} label={'Kabul\nEdilen'} />
                    </View>

                    {/* Quick Actions */}
                    <View className="mb-6">
                        <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest uppercase mb-3">HIZLI ERİŞİM</Text>
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => navigation.navigate('BrandAdverts')}
                                className="flex-1 bg-soft-gold/10 border border-soft-gold/25 rounded-2xl p-4 flex-row items-center gap-3"
                            >
                                <View className="w-9 h-9 bg-soft-gold/15 rounded-xl items-center justify-center">
                                    <Plus color="#D4AF37" size={18} />
                                </View>
                                <View>
                                    <Text className="text-soft-gold font-bold text-sm">İlanlarım</Text>
                                    <Text className="text-gray-500 text-xs">Yönet</Text>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Keşfet')}
                                className="flex-1 bg-purple-500/10 border border-purple-500/25 rounded-2xl p-4 flex-row items-center gap-3"
                            >
                                <View className="w-9 h-9 bg-purple-500/15 rounded-xl items-center justify-center">
                                    <Sparkles color="#a855f7" size={18} />
                                </View>
                                <View>
                                    <Text className="text-purple-300 font-bold text-sm">Keşfet</Text>
                                    <Text className="text-gray-500 text-xs">Influencer bul</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Recent Applications */}
                    <View>
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest uppercase">SON BAŞVURULAR</Text>
                            {recentApplications.length > 0 && (
                                <TouchableOpacity onPress={() => navigation.navigate('BrandAdverts')} className="flex-row items-center gap-1">
                                    <Text className="text-gray-500 text-xs">Tümü</Text>
                                    <ChevronRight color="#6b7280" size={14} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {recentApplications.length === 0 ? (
                            <GlassCard className="p-8 items-center">
                                <View className="w-14 h-14 bg-white/5 rounded-full items-center justify-center mb-4">
                                    <Users color="#4b5563" size={26} />
                                </View>
                                <Text className="text-white font-bold text-base mb-1">Henüz başvuru yok</Text>
                                <Text className="text-gray-500 text-sm text-center">İlan oluşturduğunda başvurular burada görünür.</Text>
                            </GlassCard>
                        ) : (
                            recentApplications.map((app) => {
                                const statusCfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                                const inf = app.influencer;
                                return (
                                    <GlassCard key={app.id} className="p-4 mb-3" onPress={() => navigation.navigate('BrandAdverts')}>
                                        <View className="flex-row items-center">
                                            {/* Avatar */}
                                            <View className="w-12 h-12 rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden mr-3">
                                                {inf?.avatar_url
                                                    ? <Image source={{ uri: inf.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                                    : <View className="flex-1 items-center justify-center">
                                                        <Text className="text-white font-bold text-lg">{(inf?.full_name || inf?.username || '?').charAt(0).toUpperCase()}</Text>
                                                    </View>}
                                            </View>

                                            <View className="flex-1">
                                                <Text className="text-white font-bold text-sm" numberOfLines={1}>
                                                    {inf?.full_name || inf?.username || 'Kullanıcı'}
                                                </Text>
                                                <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
                                                    {app.advert_projects?.title || 'İlan'}
                                                </Text>
                                            </View>

                                            <View className="px-3 py-1.5 rounded-xl" style={{ backgroundColor: statusCfg.bg }}>
                                                <Text className="text-[11px] font-bold" style={{ color: statusCfg.color }}>{statusCfg.label}</Text>
                                            </View>
                                        </View>
                                    </GlassCard>
                                );
                            })
                        )}
                    </View>

                    {/* AI Tip */}
                    <GlassCard className="p-5 mt-4 border-purple-500/20">
                        <LinearGradient colors={['rgba(168,85,247,0.1)', 'transparent']} className="absolute inset-0" />
                        <View className="flex-row items-center gap-2 mb-2">
                            <Sparkles color="#a855f7" size={15} />
                            <Text className="text-purple-300 font-bold text-xs tracking-widest uppercase">INFLU AI İPUCU</Text>
                        </View>
                        <Text className="text-gray-300 text-sm leading-5">
                            Bütçenizi ve teslimat beklentilerinizi ilanda açıkça belirtin. Daha kaliteli başvurular almak için kategori eşleşmesine dikkat edin.
                        </Text>
                    </GlassCard>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
