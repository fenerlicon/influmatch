import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl, Dimensions, Alert, Modal, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Bell, Zap, ChevronRight,
    TrendingUp, Instagram, BarChart3,
    Eye, Info, X, CheckCircle2, Sparkles,
    ArrowUpRight, Wallet
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { calculateTrustScore, calculateProfileCompletion } from '../utils/calculation';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

const { width } = Dimensions.get('window');

// --- PREMIUM COMPONENTS ---

const GlassCard = ({ children, className, style, onPress, activeOpacity = 0.8 }) => (
    <TouchableOpacity
        activeOpacity={onPress ? activeOpacity : 1}
        onPress={onPress}
        style={style}
        className={`rounded-[32px] overflow-hidden border border-white/10 relative ${className}`}
    >
        <LinearGradient
            colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.04)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </TouchableOpacity>
);

const SemiCircularProgress = ({ score, size = 120 }) => {
    const radius = size / 2 - 10;
    const strokeWidth = 10;
    const center = size / 2;
    
    // Top-heavy arc
    const startAngle = -220;
    const endAngle = 40;
    
    const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    };

    const describeArc = (x, y, radius, startAngle, endAngle) => {
        const start = polarToCartesian(x, y, radius, endAngle);
        const end = polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return [
            "M", start.x, start.y, 
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
    };

    const totalAngle = endAngle - startAngle;
    const currentAngle = startAngle + (totalAngle * (score / 100));
    const backgroundArc = describeArc(center, center, radius, startAngle, endAngle);
    const progressArc = describeArc(center, center, radius, startAngle, currentAngle);

    return (
        <View style={{ width: size, height: size * 0.75, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size}>
                <Defs>
                    <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#fcd34d" />
                        <Stop offset="100%" stopColor="#f59e0b" />
                    </SvgGradient>
                </Defs>
                <Path
                    d={backgroundArc}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                <Path
                    d={progressArc}
                    fill="none"
                    stroke="url(#grad)"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
            </Svg>
            <View style={{ position: 'absolute', bottom: '30%', alignItems: 'center' }}>
                <Text className="text-white text-4xl font-bold tracking-tighter">{score}</Text>
                <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-0">/ 100</Text>
            </View>
        </View>
    );
};

const Header = ({ profile, unreadCount, onNotificationPress }) => {
    const insets = useSafeAreaInsets();
    return (
        <View
            className="px-6 pb-2 flex-row justify-between items-center z-50"
            style={{ paddingTop: Math.max(insets.top, 16) }}
        >
            <View>
                <Text className="text-gray-400 text-2xl font-light">Hello, <Text className="text-white font-bold">{profile?.full_name?.split(' ')[0] || 'Arda'}</Text></Text>
            </View>
            <TouchableOpacity
                onPress={onNotificationPress}
                className="w-12 h-12 items-center justify-center rounded-2xl bg-white/10 border border-white/5"
            >
                <View className="relative">
                    <Bell color="#fff" size={24} />
                    {unreadCount > 0 && (
                        <View className="absolute -top-1.5 -right-1.5 bg-amber-400 w-4 h-4 rounded-full items-center justify-center border-2 border-[#020617]">
                            <Text className="text-[8px] font-bold text-black">{unreadCount}</Text>
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
};

const OpportunityCard = ({ project, onPress }) => (
    <GlassCard
        onPress={onPress}
        style={{ width: 260, height: 360 }}
        className="mr-4 p-6 justify-between bg-white/[0.02]"
    >
        <View>
            <View className="w-full aspect-square bg-black rounded-[24px] items-center justify-center mb-6 overflow-hidden border border-white/5 shadow-2xll">
                {project.brand_logo ? (
                    <Image source={{ uri: project.brand_logo }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <Text className="text-white font-bold text-4xl">{(project.brand_name || 'MB').substring(0, 1)}</Text>
                )}
            </View>
            
            <Text className="text-white font-bold text-xl mb-1" numberOfLines={1}>{project.title}</Text>
            <Text className="text-gray-400 text-sm mb-4" numberOfLines={1}>
                {project.category || 'Fitness & Lifestyle'} / ₺{project.budget_min?.toLocaleString() || '0'} Budget
            </Text>
        </View>

        <TouchableOpacity 
            onPress={onPress}
            className={`w-full py-3.5 rounded-2xl items-center justify-center ${
                project.brand_name?.toLowerCase().includes('nike') ? 'bg-[#2563eb]' : 
                project.brand_name?.toLowerCase().includes('sephora') ? 'bg-[#7c3aed]' : 
                'bg-amber-500'
            } shadow-lg shadow-black/20`}
        >
            <Text className="text-white font-bold text-sm">View Details</Text>
        </TouchableOpacity>
    </GlassCard>
);

const ScoreInfoModal = ({ visible, onClose }) => (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
            <View className="bg-[#1a1d24] w-full rounded-[32px] overflow-hidden border border-white/10 relative">
                <View className="p-6 flex-row justify-between items-center border-b border-white/5 bg-[#15171e]">
                    <View className="flex-row items-center gap-2">
                        <TrendingUp color="#fbbf24" size={20} />
                        <Text className="text-white font-bold text-lg">Skor Nasıl Yükselir?</Text>
                    </View>
                    <TouchableOpacity onPress={onClose}>
                        <X color="#94a3b8" size={24} />
                    </TouchableOpacity>
                </View>

                <ScrollView className="p-6 max-h-[60vh]">
                    <View className="space-y-4 pb-10">
                        <View className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 flex-row items-start mb-3">
                            <CheckCircle2 size={18} color="#22c55e" className="mr-3" />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm mb-1">Hesap Doğrulama (+30 Puan)</Text>
                                <Text className="text-gray-400 text-xs">Instagram hesabınızı bağlayın ve doğrulayın.</Text>
                            </View>
                        </View>
                        <View className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 flex-row items-start mb-3">
                            <TrendingUp size={18} color="#3b82f6" className="mr-3" />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm mb-1">Sağlıklı Etkileşim (+20 Puan)</Text>
                                <Text className="text-gray-400 text-xs">%1 - %10 arası etkileşim oranı en idealdir.</Text>
                            </View>
                        </View>
                        <View className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 flex-row items-start mb-3">
                            <Sparkles size={18} color="#f59e0b" className="mr-3" />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm mb-1">Profil Doluluğu (+10 Puan)</Text>
                                <Text className="text-gray-400 text-xs">Tüm biyografi ve kategori bilgilerini girin.</Text>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </View>
    </Modal>
);

// --- MAIN SCREEN ---

export default function DashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // UI States
    const [scoreModalVisible, setScoreModalVisible] = useState(false);
    const [notificationModalVisible, setNotificationModalVisible] = useState(false);

    // Data
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ trustScore: 0, profileCompletion: 0 });
    const [projects, setProjects] = useState([]);
    const [socialStats, setSocialStats] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    useFocusEffect(
        useCallback(() => {
            fetchDashboardData();
        }, [])
    );

    const fetchDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: profileData }, { data: projectsData }, { data: socialData }, { data: notifData }] = await Promise.all([
                supabase.from('users').select('*').eq('id', user.id).single(),
                supabase.from('advert_projects').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(5),
                supabase.from('social_accounts').select('*').eq('user_id', user.id).eq('platform', 'instagram').maybeSingle(),
                supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
            ]);

            // SECURITY: If rejected, force vitrin off
            if (profileData && profileData.verification_status === 'rejected' && profileData.is_showcase_visible) {
                profileData.is_showcase_visible = false;
                await supabase.from('users').update({ is_showcase_visible: false }).eq('id', user.id);
            }

            setProfile(profileData);
            setProjects(projectsData || []);
            setSocialStats(socialData || null);

            const notifs = notifData || [];
            setNotifications(notifs);
            setUnreadNotifCount(notifs.filter(n => !n.is_read).length);

            setStats({
                trustScore: calculateTrustScore(profileData, socialData),
                profileCompletion: calculateProfileCompletion(profileData, socialData),
            });

        } catch (e) {
            console.error('[Dashboard] fetchDashboardData error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const toggleSpotlight = async () => {
        if (!profile) return;

        if (profile.verification_status === 'rejected') {
            Alert.alert(
                'Hesap Reddedildi',
                'Hesabınız inceleme sonucu reddedildiği için vitrin özelliğini kullanamazsınız. Lütfen destekle iletişime geçin.',
                [{ text: 'Tamam' }]
            );
            return;
        }

        const newState = !profile.is_showcase_visible;

        if (newState && profile.verification_status !== 'verified') {
            Alert.alert(
                'Hesap Doğrulama Gerekli',
                'Vitrinde görünmek için hesabınızın onaylanmış olması gerekiyor. Doğrulama için profil sayfanızı ziyaret edin.',
                [{ text: 'Tamam' }]
            );
            return;
        }

        setProfile(prev => ({ ...prev, is_showcase_visible: newState }));

        const { error } = await supabase
            .from('users')
            .update({ is_showcase_visible: newState })
            .eq('id', profile.id);

        if (error) {
            Alert.alert('Hata', 'Durum güncellenemedi: ' + error.message);
            setProfile(prev => ({ ...prev, is_showcase_visible: !newState }));
        } else if (newState) {
            Alert.alert('Vitrin Modu Aktif! 🚀', 'Artık markalar tarafından keşfedilebilirsin.');
        } else {
            Alert.alert('Gizli Mod 🔒', 'Vitrinden kaldırıldın.');
        }
    };

    const handleNotificationPress = async () => {
        setNotificationModalVisible(true);
        if (unreadNotifCount > 0 && profile?.id) {
            await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
            setUnreadNotifCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    if (loading) return (
        <View className="flex-1 bg-[#020617] items-center justify-center">
            <ActivityIndicator color="#fbbf24" />
        </View>
    );

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* BACKGROUND DECORATION */}
            <View className="absolute top-0 left-0 right-0 h-1/2">
                <LinearGradient colors={['#0f172a', '#020617']} className="flex-1" />
            </View>
            <View className="absolute top-[10%] -right-20 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px]" />
            <View className="absolute top-[30%] -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />

            <ScoreInfoModal visible={scoreModalVisible} onClose={() => setScoreModalVisible(false)} />

            <SafeAreaView className="flex-1" edges={['left', 'right']}>
                <Header 
                    profile={profile} 
                    unreadCount={unreadNotifCount} 
                    onNotificationPress={handleNotificationPress} 
                />

                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fbbf24" />}
                >
                    {/* BENTO ROW: Trust Score & Earnings */}
                    <View className="flex-row gap-4 mt-6 h-60">
                        {/* Trust Score */}
                        <GlassCard 
                            style={{ flex: 1.1 }} 
                            className="p-5 items-center justify-between"
                            onPress={() => setScoreModalVisible(true)}
                        >
                            <SemiCircularProgress score={stats.trustScore} />
                            <View className="w-full">
                                <View className="flex-row justify-between items-center mb-1">
                                    <View>
                                        <Text className="text-white font-bold text-base">Trust Score</Text>
                                    </View>
                                    <View className="flex-row items-center bg-green-500/10 px-1.5 py-0.5 rounded-lg">
                                        <ArrowUpRight size={12} color="#22c55e" />
                                        <Text className="text-green-500 text-[10px] font-bold">+5%</Text>
                                    </View>
                                </View>
                                <Text className="text-gray-500 text-[10px]" numberOfLines={2}>
                                    Based on performance & engagement
                                </Text>
                            </View>
                        </GlassCard>

                        {/* Earnings */}
                        <GlassCard style={{ flex: 1 }} className="p-5 justify-between bg-white/[0.04]">
                            <View>
                                <View className="flex-row items-center gap-2 mb-4">
                                    <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center">
                                        <Wallet size={16} color="#fbbf24" />
                                    </View>
                                    <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-tight">Active Earnings</Text>
                                </View>
                                <Text className="text-white text-2xl font-bold mb-1">₺14.250,00</Text>
                                <Text className="text-gray-500 text-[10px] font-medium uppercase tracking-widest">Total Active</Text>
                            </View>
                            
                            <TouchableOpacity 
                                className="bg-amber-400 py-3 rounded-2xl items-center shadow-lg shadow-amber-400/20 active:scale-95"
                                onPress={() => Alert.alert("Cüzdan", "Cüzdan yönetimi özelliği çok yakında aktifleştirilecektir.")}
                            >
                                <Text className="text-black font-bold text-xs">Withdraw Funds</Text>
                            </TouchableOpacity>
                        </GlassCard>
                    </View>

                    {/* NEW OPPORTUNITIES SECTION */}
                    <View className="mt-10">
                        <View className="flex-row justify-between items-baseline mb-6 pl-1">
                            <Text className="text-white text-2xl font-medium tracking-tight">New Opportunities</Text>
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                            {projects.length > 0 ? projects.map(project => (
                                <OpportunityCard 
                                    key={project.id} 
                                    project={project} 
                                    onPress={() => navigation.navigate('İlanlar', { project })} 
                                />
                            )) : (
                                <View className="w-[80vw] h-40 items-center justify-center border border-dashed border-white/10 rounded-[32px]">
                                    <Text className="text-gray-600 font-medium">No active opportunities found.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>

                    {/* QUICK ACCESS & STATUS */}
                    <View className="mt-10 space-y-4">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-4 ml-1">Status & Quick Access</Text>
                        
                        {/* Spotlight Toggle */}
                        <GlassCard
                            className={`flex-row items-center p-5 justify-between border-white/[0.05] ${profile?.is_showcase_visible ? 'bg-amber-400/5 border-amber-400/20' : 'bg-white/[0.02]'}`}
                            onPress={toggleSpotlight}
                        >
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${profile?.is_showcase_visible ? 'bg-amber-400' : 'bg-white/[0.05]'}`}>
                                    <Eye color={profile?.is_showcase_visible ? "#000" : "#64748b"} size={26} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-base">Vitrin Modu</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {profile?.is_showcase_visible ? 'Markalar tarafından keşfedilebilirsin' : 'Şu an markalara gizlisin'}
                                    </Text>
                                </View>
                            </View>
                            <View className={`px-4 py-1.5 rounded-full ${profile?.is_showcase_visible ? 'bg-amber-400' : 'bg-white/10'}`}>
                                <Text className={`text-[10px] font-bold ${profile?.is_showcase_visible ? 'text-black' : 'text-gray-400'}`}>
                                    {profile?.is_showcase_visible ? 'AÇIK' : 'KAPALI'}
                                </Text>
                            </View>
                        </GlassCard>

                        {/* Instagram Link */}
                        <GlassCard
                            className={`flex-row items-center p-5 justify-between border-white/[0.05] ${socialStats ? 'bg-purple-900/10' : 'bg-white/[0.02]'}`}
                            onPress={() => navigation.navigate('MyProfile')}
                        >
                            <View className="flex-row items-center">
                                <View className="w-12 h-12 rounded-2xl bg-white/[0.05] items-center justify-center mr-4">
                                    <Instagram color={socialStats ? "#fbbf24" : "#64748b"} size={26} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-base">
                                        {socialStats ? 'Instagram Bağlı' : 'Instagram Bağla'}
                                    </Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {socialStats ? `@${socialStats.username}` : 'Pro özellikleri ve analizi aç'}
                                    </Text>
                                </View>
                            </View>
                            <ChevronRight size={20} color="#334155" />
                        </GlassCard>

                        {/* Stats Info */}
                        <View className="flex-row gap-4 mt-2">
                             {/* AI Assistant */}
                             <GlassCard
                                style={{ flex: 1 }}
                                className="p-5 items-center bg-blue-500/5 border-blue-500/10"
                                onPress={() => navigation.navigate('AiAssistant')}
                            >
                                <Sparkles size={24} color="#3b82f6" className="mb-2 opacity-80" />
                                <Text className="text-white text-lg font-bold">AI Asistan</Text>
                                <Text className="text-blue-500/60 text-[10px] font-bold uppercase tracking-widest mt-1">İpucu Al</Text>
                            </GlassCard>

                            <GlassCard style={{ flex: 1 }} className="p-5 items-center bg-amber-500/5 border-amber-500/10" onPress={() => navigation.navigate('Analysis')}>
                                <Zap size={24} color="#f59e0b" className="mb-2 opacity-80" />
                                <Text className="text-white text-lg font-bold">Analiz Et</Text>
                                <Text className="text-amber-500/60 text-[10px] font-bold uppercase tracking-widest mt-1">Detayları Gör</Text>
                            </GlassCard>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>

            {/* NOTIFICATION MODAL */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={notificationModalVisible}
                onRequestClose={() => setNotificationModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-end">
                    <TouchableOpacity className="flex-1" onPress={() => setNotificationModalVisible(false)} />
                    <View className="bg-[#0B0F19] rounded-t-[32px] border-t border-white/10 p-6 max-h-[70%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white font-bold text-xl">Bildirimler</Text>
                            <TouchableOpacity onPress={() => setNotificationModalVisible(false)} className="w-10 h-10 items-center justify-center">
                                <X color="#94a3b8" size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {notifications.length === 0 ? (
                                <View className="items-center py-10 opacity-30">
                                    <Bell color="#475569" size={64} />
                                    <Text className="text-gray-400 mt-4 text-sm font-medium">Henüz bildiriminiz yok.</Text>
                                </View>
                            ) : (
                                notifications.map(notif => (
                                    <View
                                        key={notif.id}
                                        className={`mb-4 p-4 rounded-2xl border ${notif.is_read ? 'border-white/5 bg-white/[0.01]' : 'border-amber-500/20 bg-amber-500/5'}`}
                                    >
                                        <Text className="text-white font-bold text-sm mb-1">{notif.title}</Text>
                                        <Text className="text-gray-400 text-xs leading-4">{notif.message}</Text>
                                    </View>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
