import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl, Dimensions, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Bell, Zap, ChevronRight,
    TrendingUp, Instagram, BarChart3,
    Eye, Info, X, CheckCircle2, Sparkles
} from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { calculateTrustScore, calculateProfileCompletion } from '../utils/calculation';

const { width, height } = Dimensions.get('window');
const CARD_GAP = 16;
const PADDING = 24;
const CARD_WIDTH = (width - (PADDING * 2) - CARD_GAP) / 2;

// --- GLASS COMPONENTS ---

const GlassCard = ({ children, className, style, onPress, activeOpacity = 0.9 }) => (
    <TouchableOpacity
        activeOpacity={onPress ? activeOpacity : 1}
        onPress={onPress}
        style={style}
        className={`rounded-[30px] overflow-hidden border border-white/20 relative ${className}`}
    >
        {/* Real Glass Background Simulation */}
        <LinearGradient
            colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {/* Inner Glare for extra depth */}
        <LinearGradient
            colors={['rgba(255, 255, 255, 0.1)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.5 }}
            className="absolute inset-0 h-1/2 opacity-50"
        />
        {children}
    </TouchableOpacity>
);

const Header = ({ profile, unreadCount, onNotificationPress }) => (
    <View className="px-6 pt-4 pb-6 flex-row justify-between items-center z-50">
        <View>
            <Text className="text-gray-300 text-sm font-medium mb-1 opacity-80">Tekrar Hoşgeldin,</Text>
            <Text className="text-white font-bold text-3xl tracking-tight">{profile?.full_name?.split(' ')[0] || 'Kullanıcı'}</Text>
        </View>
        <GlassCard
            onPress={onNotificationPress}
            className="w-12 h-12 items-center justify-center rounded-full !border-white/30 bg-white/5"
        >
            <Bell color="#fff" size={22} />
            {unreadCount > 0 && (
                <View className="absolute top-3.5 right-3.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            )}
        </GlassCard>
    </View>
);

const CircularProgress = ({ score }) => (
    <View className="items-center justify-center w-28 h-28 relative my-1">
        {/* Glow behind the ring */}
        <View className="absolute w-20 h-20 bg-soft-gold/30 rounded-full blur-xl" />

        {/* Inactive Track */}
        <View className="absolute w-full h-full rounded-full border-[8px] border-white/10" />

        {/* Active Track - Gradient Stroke Simulation via rotation */}
        <View className="absolute w-full h-full rounded-full border-[8px] border-soft-gold border-l-transparent border-b-transparent transform -rotate-45 shadow-[0_0_15px_rgba(212,175,55,0.6)]" />

        <View className="items-center">
            <Text className="text-white font-black text-4xl shadow-black">{score}</Text>
            <Text className="text-soft-gold text-[10px] font-bold tracking-widest uppercase mt-1">Skor</Text>
        </View>
    </View>
);

const OpportunityCard = ({ project, onPress }) => (
    <GlassCard
        onPress={onPress}
        className="mr-5 w-72 h-80 p-6 justify-between border-white/10 bg-black/20"
    >
        {/* Subtle Brand Glow */}
        <View className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-[60px]" />

        <View>
            <View className="flex-row justify-between items-start mb-6">
                <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center shadow-lg transform rotate-3">
                    {project.brand_logo ? (
                        <Image source={{ uri: project.brand_logo }} className="w-10 h-10 resize-contain" />
                    ) : (
                        <Text className="text-black font-black text-2xl">{(project.brand_name || 'MB').substring(0, 1)}</Text>
                    )}
                </View>
                {project.is_new && (
                    <View className="bg-soft-gold px-3 py-1.5 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.4)]">
                        <Text className="text-black text-[10px] font-bold tracking-wide">YENİ</Text>
                    </View>
                )}
            </View>

            <Text className="text-white font-bold text-2xl leading-8 mb-2 drop-shadow-md" numberOfLines={2}>{project.title}</Text>
            <Text className="text-gray-400 text-sm font-medium uppercase tracking-wider">{project.brand_name}</Text>
        </View>

        <View>
            {/* Tags */}
            <View className="flex-row gap-2 mb-5 flex-wrap">
                <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
                    <Text className="text-gray-200 text-xs font-medium">{project.platform || 'Instagram'}</Text>
                </View>
                <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
                    <Text className="text-soft-gold text-xs font-bold">₺{project.budget_min.toLocaleString()}</Text>
                </View>
            </View>

            <TouchableOpacity onPress={onPress} className="w-full h-12 rounded-xl overflow-hidden relative items-center justify-center bg-soft-gold shadow-lg shadow-soft-gold/20 active:scale-[0.98] transition">
                <Text className="text-black font-extrabold text-sm">Detayları İncele</Text>
            </TouchableOpacity>
        </View>
    </GlassCard>
);

// --- MODALS ---

const ScoreInfoModal = ({ visible, onClose }) => (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
        <View className="flex-1 bg-black/80 justify-center items-center px-6">
            <View className="bg-[#1a1d24] w-full rounded-[32px] overflow-hidden border border-white/10 relative">
                {/* Header */}
                <View className="p-6 flex-row justify-between items-center border-b border-white/5 bg-[#15171e]">
                    <View className="flex-row items-center gap-2">
                        <TrendingUp color="#D4AF37" size={20} />
                        <Text className="text-white font-bold text-lg">Skor Nasıl Yükselir?</Text>
                    </View>
                    <TouchableOpacity onPress={onClose}>
                        <Text className="text-gray-400 font-bold text-xs tracking-widest">KAPAT</Text>
                    </TouchableOpacity>
                </View>

                <View className="p-6 space-y-4">
                    {/* Item 1 */}
                    <View className="bg-[#113028] p-4 rounded-2xl border border-[#1e4e40] flex-row items-start">
                        <View className="w-6 h-6 rounded-full bg-[#1e4e40] items-center justify-center mt-0.5 mr-3">
                            <CheckCircle2 size={14} color="#34d399" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-sm mb-1">Hesap Doğrulama (+30 Puan)</Text>
                            <Text className="text-gray-400 text-xs leading-4">Instagram hesabınızı bağlayın ve doğrulayın.</Text>
                        </View>
                    </View>
                    {/* Item 2 */}
                    <View className="bg-[#1e2029] p-4 rounded-2xl border border-white/5 flex-row items-start">
                        <View className="w-6 h-6 rounded-full bg-white/5 items-center justify-center mt-0.5 mr-3">
                            <TrendingUp size={14} color="#9ca3af" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-sm mb-1">Sağlıklı Etkileşim (+20 Puan)</Text>
                            <Text className="text-gray-400 text-xs leading-4">%1 - %10 arası etkileşim oranı en idealdir.</Text>
                        </View>
                    </View>
                    {/* Item 3 */}
                    <View className="bg-soft-gold/10 p-4 rounded-2xl border border-soft-gold/20 flex-row items-start">
                        <View className="w-6 h-6 rounded-full bg-soft-gold/20 items-center justify-center mt-0.5 mr-3">
                            <Eye size={14} color="#D4AF37" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-soft-gold font-bold text-sm mb-1">Spotlight Üyeliği (+10 Puan)</Text>
                            <Text className="text-gray-400 text-xs leading-4">Premium üyelik güvenilirliğinizi artırır.</Text>
                        </View>
                    </View>
                    {/* Item 4 */}
                    <View className="bg-purple-500/10 p-4 rounded-2xl border border-purple-500/20 flex-row items-start">
                        <View className="w-6 h-6 rounded-full bg-purple-500/20 items-center justify-center mt-0.5 mr-3">
                            <Info size={14} color="#a855f7" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-purple-400 font-bold text-sm mb-1">Profil Doluluğu (+10 Puan)</Text>
                            <Text className="text-gray-400 text-xs leading-4">Biyografi, kategori ve iletişim bilgilerinizi tamamlayın.</Text>
                        </View>
                    </View>
                </View>
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

        const newState = !profile.is_showcase_visible;

        // Security: Only verified accounts can enable showcase
        if (newState && profile.verification_status !== 'verified') {
            Alert.alert(
                'Hesap Doğrulama Gerekli',
                'Vitrinde görünmek için hesabınızın onaylanmış olması gerekiyor. Doğrulama için profil sayfanızı ziyaret edin.',
                [{ text: 'Tamam' }]
            );
            return;
        }

        // Optimistic UI update
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
        // Mark all as read
        if (unreadNotifCount > 0 && profile?.id) {
            await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('user_id', profile.id)
                .eq('is_read', false);
            setUnreadNotifCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchDashboardData();
    };

    const navigateToAnalysis = () => {
        navigation.navigate('Analysis', {
            score: stats.trustScore,
            socialStats: socialStats,
            profile: profile
        });
    }

    if (loading) return <View className="flex-1 bg-[#020617] items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* MASTER BACKGROUND GRADIENTS */}
            <LinearGradient
                colors={['#1e1b4b', '#020617', '#020617']}
                className="absolute inset-0"
            />
            <View className="absolute -top-20 -right-20 w-80 h-80 bg-soft-gold/10 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-[100px]" />

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
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-white font-bold text-xl">Bildirimler</Text>
                            <TouchableOpacity onPress={() => setNotificationModalVisible(false)}>
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

            <ScoreInfoModal visible={scoreModalVisible} onClose={() => setScoreModalVisible(false)} />

            <SafeAreaView className="flex-1">
                <Header
                    profile={profile}
                    unreadCount={unreadNotifCount}
                    onNotificationPress={handleNotificationPress}
                />

                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
                >
                    <View className="px-6 mt-6 mb-6">
                        <View className="flex-row justify-between items-end mb-2">
                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">PROFİL DOLULUĞU</Text>
                            <Text className="text-soft-gold text-xs font-bold">%{stats.profileCompletion}</Text>
                        </View>
                        <View className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <View
                                className="h-full bg-soft-gold rounded-full shadow-[0_0_10px_rgba(212,175,55,0.5)]"
                                style={{ width: `${stats.profileCompletion}%` }}
                            />
                        </View>
                        <Text className="text-gray-500 text-[10px] mt-2">
                            {stats.profileCompletion < 100
                                ? 'Daha fazla işbirliği için profilini tamamla.'
                                : 'Profil tamamlandı! Markalar seni görebilir.'}
                        </Text>
                    </View>

                    <View className="px-6 mt-2">

                        {/* 1. BENTO ROW: Trust Score & Spotlight */}
                        <View className="flex-row justify-between mb-10 h-64">
                            {/* LEFT: Trust Score */}
                            <GlassCard style={{ width: CARD_WIDTH, height: '100%' }} className="items-center justify-center p-4 bg-white/[0.03]" onPress={navigateToAnalysis}>
                                <TouchableOpacity
                                    onPress={() => setScoreModalVisible(true)}
                                    className="absolute top-4 right-4 z-10 w-6 h-6 bg-white/5 rounded-full items-center justify-center"
                                >
                                    <Info size={14} color="#9ca3af" />
                                </TouchableOpacity>

                                <View className="absolute top-0 w-full h-1/2 bg-gradient-to-b from-soft-gold/5 to-transparent" />
                                <CircularProgress score={stats.trustScore} />
                                <View className="items-center mt-3">
                                    <Text className="text-white font-bold text-lg tracking-tight">Marka Güven Skoru</Text>
                                    <Text className="text-gray-500 text-[10px] mt-1">Profil ve Instagram verilerine göre</Text>
                                </View>
                            </GlassCard>

                            {/* RIGHT: Spotlight Status */}
                            <GlassCard
                                onPress={toggleSpotlight}
                                style={{ width: CARD_WIDTH, height: '100%' }}
                                className={`items-center justify-between p-5 ${profile?.is_showcase_visible ? 'bg-soft-gold/10 border-soft-gold/30' : 'bg-white/[0.03]'}`}
                            >
                                <View className="w-full flex-row justify-between items-center">
                                    <View className={`w-2 h-2 rounded-full ${profile?.is_showcase_visible ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-gray-600'}`} />
                                    <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">DURUM</Text>
                                </View>

                                <View className="items-center justify-center my-2">
                                    <View className={`w-16 h-16 rounded-full items-center justify-center mb-3 ${profile?.is_showcase_visible ? 'bg-soft-gold text-black shadow-[0_0_20px_rgba(212,175,55,0.4)]' : 'bg-white/10'}`}>
                                        {profile?.is_showcase_visible ? (
                                            <Eye size={32} color="#000" />
                                        ) : (
                                            <Eye size={32} color="#6b7280" />
                                        )}
                                    </View>
                                </View>

                                <View className="w-full text-center items-center">
                                    <Text className={`text-lg font-bold mb-1 ${profile?.is_showcase_visible ? 'text-white' : 'text-gray-500'}`}>
                                        {profile?.is_showcase_visible ? 'Vitrin Açık' : 'Gizlisin'}
                                    </Text>

                                    {/* Warning text when closed */}
                                    {!profile?.is_showcase_visible && (
                                        <Text className="text-red-400 text-[9px] font-bold text-center mb-2 leading-3 w-full">
                                            Markalar seni göremiyor, aktife geç!
                                        </Text>
                                    )}

                                    <View className={`px-4 py-2 rounded-xl w-full items-center ${profile?.is_showcase_visible ? 'bg-soft-gold' : 'bg-white/10'}`}>
                                        <Text className={`text-xs font-bold ${profile?.is_showcase_visible ? 'text-black' : 'text-gray-400'}`}>
                                            {profile?.is_showcase_visible ? 'KAPAT' : 'AÇ'}
                                        </Text>
                                    </View>
                                </View>
                            </GlassCard>
                        </View>

                        {/* NEW ROW: Spotlight Info & AI Assistant */}
                        <View className="flex-row justify-between mb-10 h-40">
                            {/* LEFT: Spotlight Membership Status */}
                            <GlassCard
                                style={{ width: CARD_WIDTH, height: '100%' }}
                                className="p-4 justify-between bg-purple-500/5 border-purple-500/20"
                                onPress={() => navigation.navigate('Spotlight')}
                            >
                                <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center mb-2">
                                    <Zap size={20} color="#a855f7" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg leading-6">Spotlight</Text>
                                    <Text className="text-gray-400 text-xs font-medium">Premium Özellikler</Text>
                                </View>
                                <View className="flex-row items-center mt-2">
                                    <View className={`w-2 h-2 rounded-full ${profile?.spotlight_active ? 'bg-green-500' : 'bg-gray-500'} mr-2`} />
                                    <Text className={profile?.spotlight_active ? 'text-green-400 text-xs font-bold' : 'text-gray-400 text-xs font-bold'}>
                                        {profile?.spotlight_active ? 'AKTİF' : 'PASİF'}
                                    </Text>
                                    <ChevronRight size={14} color="gray" className="ml-auto" />
                                </View>
                            </GlassCard>

                            {/* RIGHT: AI Assistant */}
                            <GlassCard
                                style={{ width: CARD_WIDTH, height: '100%' }}
                                className="p-4 justify-between bg-soft-gold/5 border-soft-gold/20"
                                onPress={() => navigation.navigate('AiAssistant')}
                            >
                                <View className="w-10 h-10 rounded-full bg-soft-gold items-center justify-center mb-2 shadow-[0_0_10px_rgba(212,175,55,0.3)]">
                                    <Sparkles size={20} color="black" />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-lg leading-6">AI Asistan</Text>
                                    <Text className="text-gray-400 text-xs font-medium">Etkileşim Analizi</Text>
                                </View>
                                <View className="bg-white/10 self-start px-2 py-1 rounded-lg mt-2">
                                    <Text className="text-soft-gold text-[10px] font-bold">YENİ</Text>
                                </View>
                            </GlassCard>
                        </View>

                        {/* 2. SECTION: Opportunities */}
                        <View className="flex-row justify-between items-center mb-6 pl-1">
                            <Text className="text-white font-bold text-2xl tracking-tight">Yeni Fırsatlar</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('İlanlar')} className="flex-row items-center opacity-70">
                                <Text className="text-soft-gold text-xs font-bold mr-1 tracking-widest">TÜMÜ</Text>
                                <ChevronRight color="#D4AF37" size={14} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-10 -mx-6 px-6">
                            {projects.length > 0 ? projects.map((project) => (
                                <OpportunityCard
                                    key={project.id}
                                    project={project}
                                    onPress={() => navigation.navigate('İlanlar', { project: project })}
                                />
                            )) : (
                                <GlassCard className="w-[85vw] h-64 items-center justify-center p-6 border-dashed border-white/20">
                                    <Text className="text-gray-400 font-medium">Henüz aktif fırsat yok.</Text>
                                </GlassCard>
                            )}
                        </ScrollView>


                        {/* 3. SECTION: Quick Stats & Connections */}
                        <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 ml-1">Hesap Durumu</Text>

                        {/* Instagram Connection */}
                        {/* Instagram Connection */}
                        <GlassCard
                            className={`mb-4 flex-row items-center p-5 justify-between border-white/10 ${socialStats ? 'bg-gradient-to-r from-[#833ab4]/20 to-[#fd1d1d]/20' : 'bg-white/5'}`}
                            onPress={() => {
                                if (!socialStats) {
                                    Alert.alert("Instagram Bağla", "Instagram hesabını bağlamak için profil ayarlarına git.");
                                    navigation.navigate('MyProfile'); // Redirect to profile for connection
                                }
                            }}
                        >
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center border mr-4 ${socialStats ? 'bg-white/10 border-white/10' : 'bg-white/5 border-white/5'}`}>
                                    <Instagram color={socialStats ? "#fff" : "#9ca3af"} size={24} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-base">
                                        {socialStats ? 'Instagram Bağlı' : 'Instagram Bağla'}
                                    </Text>
                                    <Text className="text-gray-400 text-xs">
                                        {socialStats ? 'Veriler senkronize ediliyor.' : 'İstatistiklerini görmek için bağla.'}
                                    </Text>
                                </View>
                            </View>
                            <View className={`w-8 h-8 rounded-full items-center justify-center border ${socialStats ? 'bg-green-500/20 border-green-500/30' : 'bg-white/10 border-white/10'}`}>
                                {socialStats ? (
                                    <View className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_5px_#22c55e]" />
                                ) : (
                                    <ChevronRight size={16} color="#6b7280" />
                                )}
                            </View>
                        </GlassCard>

                        {/* Simple Stats Row */}
                        <View className="flex-row gap-4">
                            <GlassCard className="flex-1 p-4 items-center justify-center h-28 bg-blue-500/10">
                                <BarChart3 size={24} color="#60a5fa" className="mb-2" />
                                <Text className="text-2xl font-black text-white">{socialStats?.follower_count ? (socialStats.follower_count / 1000).toFixed(1) + 'K' : '-'}</Text>
                                <Text className="text-blue-400 text-[10px] font-bold uppercase tracking-wider">Takipçi</Text>
                            </GlassCard>

                            <GlassCard className="flex-1 p-4 items-center justify-center h-28 bg-purple-500/10" onPress={navigateToAnalysis}>
                                <Zap size={24} color="#c084fc" className="mb-2" />
                                <Text className="text-2xl font-black text-white">{socialStats?.engagement_rate || '-'}%</Text>
                                <Text className="text-purple-400 text-[10px] font-bold uppercase tracking-wider">Etkileşim</Text>
                            </GlassCard>
                        </View>

                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
