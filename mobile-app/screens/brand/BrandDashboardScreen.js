import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, Modal, Animated, Easing, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Briefcase, Users, ChevronRight, CheckCircle2, Clock, XCircle, Plus, Sparkles, TrendingUp, X, Award, Zap, Star, Shield, Info, Lock } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { calculateTrustScore } from '../../utils/calculation';
import { getThumbnailUrl } from '../../utils/image';

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

const RotatingGlowCard = ({ children, className }) => {
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(rotateAnim, {
                toValue: 1,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const rotation = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View className={`rounded-[28px] overflow-hidden border border-white/10 relative p-[1px] flex-1 ${className}`}>
            <Animated.View
                style={{
                    position: 'absolute',
                    width: '300%',
                    height: '300%',
                    top: '-100%',
                    left: '-100%',
                    transform: [{ rotate: rotation }],
                }}
            >
                <LinearGradient
                    colors={['transparent', '#a855f7', 'transparent', '#a855f7', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="flex-1"
                />
            </Animated.View>
            <View className="bg-[#0f1117] rounded-[27px] flex-1 overflow-hidden">
                <LinearGradient
                    colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']}
                    className="absolute inset-0"
                />
                {children}
            </View>
        </View>
    );
};

const StatCard = ({ icon: Icon, color, value, label }) => (
    <RotatingGlowCard className="flex-1" style={{ minHeight: 120 }}>
        <View className="items-center justify-center py-6 px-1">
            <View className="w-10 h-10 rounded-2xl items-center justify-center mb-3 border border-white/5" style={{ backgroundColor: `${color}15` }}>
                <Icon color={color} size={20} />
            </View>
            <Text className="text-white text-3xl font-bold text-center tracking-tighter" style={{ textShadowColor: 'rgba(255,255,255,0.15)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }}>
                {value}
            </Text>
            <Text className="text-gray-400 text-[9px] font-bold tracking-[1.5px] uppercase mt-2 text-center opacity-70">
                {label.replace('\n', ' ')}
            </Text>
        </View>
    </RotatingGlowCard>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandDashboardScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ projects: 0, applications: 0, accepted: 0 });
    const [recentApplications, setRecentApplications] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifModalVisible, setNotifModalVisible] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch brand profile
            const { data: prof } = await supabase
                .from('users')
                .select('full_name, avatar_url, company_legal_name, verification_status, spotlight_active, displayed_badges')
                .eq('id', user.id)
                .maybeSingle();
            setProfile(prof);

            // Fetch Spotlight Influencers
            const { data: spotlightInfs } = await supabase
                .from('users')
                .select('id, full_name, username, avatar_url, category, verification_status')
                .eq('role', 'influencer')
                .eq('is_showcase_visible', true)
                .order('spotlight_active', { ascending: false })
                .limit(10);

            if (spotlightInfs && spotlightInfs.length > 0) {
                const spotlightIds = spotlightInfs.map(si => si.id);
                const { data: spotlightSocials } = await supabase
                    .from('social_accounts')
                    .select('*')
                    .in('user_id', spotlightIds);

                const recs = spotlightInfs.map(si => ({
                    ...si,
                    trustScore: calculateTrustScore(si, spotlightSocials?.find(s => s.user_id === si.id))
                }));
                setRecommendations(recs);
            }

            // Fetch notifications
            const { data: notifs } = await supabase
                .from('notifications')
                .select('id, title, message, is_read, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
            const notifList = notifs || [];
            setNotifications(notifList);
            setUnreadNotifCount(notifList.filter(n => !n.is_read).length);

            // Fetch brand's projects (only active ones)
            const { data: projects } = await supabase
                .from('advert_projects')
                .select('id')
                .eq('brand_user_id', user.id)
                .eq('status', 'open');

            // We still want to see applications for all projects of this brand,
            // so we fetch all project IDs for the applications query.
            const { data: allProjects } = await supabase
                .from('advert_projects')
                .select('id')
                .eq('brand_user_id', user.id);

            const allProjectIds = allProjects?.map(p => p.id) || [];

            if (allProjectIds.length === 0) {
                setStats({ projects: projects.length, applications: 0, accepted: 0 });
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
                .in('advert_id', allProjectIds)
                .order('created_at', { ascending: false })
                .limit(20);

            if (apps && apps.length > 0) {
                const infIds = apps.map(a => a.influencer?.id).filter(Boolean);
                const { data: socials } = await supabase
                    .from('social_accounts')
                    .select('*')
                    .in('user_id', infIds);

                const appsWithScores = apps.map(app => ({
                    ...app,
                    influencer: {
                        ...app.influencer,
                        trustScore: calculateTrustScore(app.influencer, socials?.find(s => s.user_id === app.influencer?.id))
                    }
                }));
                setRecentApplications(appsWithScores.slice(0, 6));
            } else {
                setRecentApplications([]);
            }

            const accepted = apps?.filter(a => a.status === 'accepted').length || 0;
            setStats({
                projects: projects.length,
                applications: apps?.length || 0,
                accepted,
            });
        } catch (e) {
            console.error('[BrandDashboard]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleNotificationPress = useCallback(async () => {
        setNotifModalVisible(true);
        // Mark all as read
        const unread = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unread.length > 0) {
            await supabase.from('notifications').update({ is_read: true }).in('id', unread);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadNotifCount(0);
        }
    }, [notifications]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const firstName = profile?.full_name?.split(' ')[0] || profile?.company_legal_name || 'Hoş Geldiniz';

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
                {/* Notification Modal */}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={notifModalVisible}
                    onRequestClose={() => setNotifModalVisible(false)}
                >
                    <View className="flex-1 bg-black/80 justify-end">
                        <TouchableOpacity className="flex-1" onPress={() => setNotifModalVisible(false)} />
                        <View className="bg-[#0B0F19] rounded-t-[32px] border-t border-white/10 p-6 max-h-[70%]">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-white font-bold text-xl">Bildirimler</Text>
                                <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                                    <X color="#6b7280" size={20} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {notifications.length === 0 ? (
                                    <View className="items-center py-10">
                                        <Bell color="#374151" size={40} />
                                        <Text className="text-gray-500 mt-4 text-sm">Henüz bildiriminiz yok.</Text>
                                    </View>
                                ) : (
                                    notifications.map(notif => (
                                        <View
                                            key={notif.id}
                                            className={`mb-3 p-4 rounded-2xl border ${notif.is_read
                                                ? 'border-white/5 bg-white/[0.02]'
                                                : 'border-soft-gold/20 bg-soft-gold/5'
                                                }`}
                                        >
                                            <Text className="text-white font-bold text-sm mb-1">{notif.title}</Text>
                                            <Text className="text-gray-400 text-xs leading-4">{notif.message}</Text>
                                            <Text className="text-gray-600 text-[10px] mt-2">
                                                {new Date(notif.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </View>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                {/* Header */}
                <View className="px-6 pt-4 pb-2 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-3">
                        <TouchableOpacity
                            onPress={() => navigation.navigate('BrandDashboard', { screen: 'Profil' })}
                            className="w-12 h-12 rounded-full bg-white/5 border border-white/10 items-center justify-center overflow-hidden"
                        >
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                                <Text className="text-white font-bold text-lg">{(profile?.company_legal_name || profile?.full_name || '?').charAt(0).toUpperCase()}</Text>
                            )}
                        </TouchableOpacity>
                        <View>
                            <Text className="text-gray-400 text-xs font-medium">Hoş Geldin,</Text>
                            <Text className="text-white font-bold text-xl tracking-tight">{firstName}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={handleNotificationPress}
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 relative"
                    >
                        <Bell color="white" size={20} />
                        {unreadNotifCount > 0 && (
                            <View className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
                        )}
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

                    {/* Spotlight / AI Recommendations */}
                    <View className="mb-10">
                        <View className="flex-row items-center justify-between mb-5 pl-1">
                            <View>
                                <View className="flex-row items-center gap-2 mb-1.5">
                                    <Text className="text-purple-400 text-[11px] font-extrabold tracking-widest uppercase">Spotlight AI</Text>
                                </View>
                                <Text className="text-white font-bold text-2xl tracking-tight">Sizin İçin Seçtiklerimiz</Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('Keşfet')}>
                                <Text className="text-soft-gold text-xs font-bold tracking-widest opacity-80">TÜMÜ</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                            {recommendations.length > 0 ? (
                                recommendations.map((inf) => (
                                    <TouchableOpacity
                                        key={inf.id}
                                        activeOpacity={0.9}
                                        className="mr-5 w-52"
                                        onPress={() => navigation.navigate('InfluencerDetail', { influencer: inf })}
                                    >
                                        <View className="h-80 rounded-[32px] overflow-hidden border border-white/10 bg-[#15171e] relative shadow-2xl">
                                            {/* Influencer Image */}
                                            <Image source={{ uri: getThumbnailUrl(inf.avatar_url) }} className="w-full h-full" resizeMode="cover" fadeDuration={0} />


                                            {/* Trust Score Pill - Centered precisely */}
                                            <View className="absolute top-4 right-4 z-10">
                                                <View
                                                    className="bg-black/70 px-3 rounded-2xl border border-white/20 flex-row items-center justify-center backdrop-blur-md"
                                                    style={{ height: 28, minWidth: 54 }}
                                                >
                                                    <Star color="#D4AF37" size={11} fill="#D4AF37" style={{ marginRight: 4 }} />
                                                    <Text
                                                        className="text-white text-[11px] font-black"
                                                        style={{ includeFontPadding: false, textAlignVertical: 'center', marginBottom: Platform.OS === 'android' ? 1 : 0 }}
                                                    >
                                                        {inf.trustScore}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Gradient Overlay - Darker and correctly positioned ENTIRELY behind text */}
                                            <LinearGradient
                                                colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)', '#000000']}
                                                locations={[0, 0.4, 0.6, 0.85, 1]}
                                                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }}
                                            />

                                            {/* Info Content */}
                                            <View className="absolute bottom-5 left-5 right-5">
                                                <View className="bg-soft-gold/20 self-start px-2 py-0.5 rounded-lg mb-2 border border-soft-gold/30">
                                                    <Text className="text-soft-gold text-[9px] font-bold uppercase tracking-wider">{inf.category || 'Lifestyle'}</Text>
                                                </View>
                                                <Text className="text-white font-bold text-lg tracking-tight" numberOfLines={1}>{inf.full_name}</Text>

                                                {profile?.spotlight_active ? (
                                                    <View className="flex-row items-center gap-1.5 mt-1">
                                                        <TrendingUp color="#4ade80" size={12} />
                                                        <Text className="text-green-400 text-[11px] font-bold">%94 Uyumlu</Text>
                                                    </View>
                                                ) : (
                                                    <View className="flex-row items-center gap-1.5 mt-1 opacity-60">
                                                        <Sparkles color="#a855f7" size={12} />
                                                        <Text className="text-purple-300 text-[10px] font-bold italic">Eşleşme oranını gör</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {!profile?.spotlight_active && (
                                                <View className="absolute inset-0 bg-purple-900/10 backdrop-blur-[2px]" />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))
                            ) : (
                                <View className="h-72 w-full items-center justify-center">
                                    <ActivityIndicator color="#a855f7" />
                                </View>
                            )}
                        </ScrollView>
                    </View>

                    {/* Quick Actions */}
                    <View className="mb-6">
                        <Text className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-4 ml-1">Hızlı Erişim</Text>
                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => navigation.navigate('BrandAdverts')}
                                className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-[30px] py-7 items-center justify-center relative overflow-hidden"
                            >
                                <LinearGradient
                                    colors={['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.05)']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    className="absolute inset-0"
                                />
                                <View className="w-12 h-12 bg-amber-500 rounded-2xl items-center justify-center mb-3 shadow-lg shadow-amber-500/30">
                                    <Plus color="#000" size={24} strokeWidth={3} />
                                </View>
                                <Text className="text-white font-bold text-base">İlanlarım</Text>
                                <Text className="text-amber-500/60 text-[10px] font-bold uppercase tracking-widest mt-1">Yönet</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => navigation.navigate('Keşfet')}
                                className="flex-1 bg-purple-500/10 border border-purple-500/20 rounded-[30px] py-7 items-center justify-center relative overflow-hidden"
                            >
                                <LinearGradient
                                    colors={['rgba(168, 85, 247, 0.15)', 'rgba(168, 85, 247, 0.05)']}
                                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                    className="absolute inset-0"
                                />
                                <View className="w-12 h-12 bg-purple-500 rounded-2xl items-center justify-center mb-3 shadow-lg shadow-purple-500/30">
                                    <Sparkles color="#fff" size={24} />
                                </View>
                                <Text className="text-white font-bold text-base">Keşfet</Text>
                                <Text className="text-purple-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">Influencer Bul</Text>
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
                                    <GlassCard key={app.id} className="p-4 mb-3" onPress={() => navigation.navigate('InfluencerDetail', { influencer: inf })}>
                                        <View className="flex-row items-center">
                                            {/* Avatar */}
                                            <View className="w-12 h-12 rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden mr-3">
                                                {inf?.avatar_url
                                                    ? <Image source={{ uri: getThumbnailUrl(inf.avatar_url) }} className="w-full h-full" resizeMode="cover" fadeDuration={0} />
                                                    : <View className="flex-1 items-center justify-center">
                                                        <Text className="text-white font-bold text-lg">{(inf?.full_name || inf?.username || '?').charAt(0).toUpperCase()}</Text>
                                                    </View>}
                                            </View>

                                            <View className="flex-1">
                                                <View className="flex-row items-center gap-2">
                                                    <Text className="text-white font-bold text-sm" numberOfLines={1}>
                                                        {inf?.full_name || inf?.username || 'Kullanıcı'}
                                                    </Text>
                                                    {inf?.trustScore && (
                                                        <View className="bg-soft-gold/10 px-1.5 py-0.5 rounded-md border border-soft-gold/20 flex-row items-center gap-1">
                                                            <Star color="#D4AF37" size={8} fill="#D4AF37" />
                                                            <Text className="text-soft-gold text-[9px] font-black">{inf.trustScore}</Text>
                                                        </View>
                                                    )}
                                                </View>
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
