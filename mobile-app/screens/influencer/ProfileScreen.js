import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Settings, ChevronRight, Star, Award, ShieldCheck,
    User, LogOut, TrendingUp, Instagram, BarChart2,
    BadgeCheck, MessageSquare
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Design ───────────────────────────────────────────────────────────────────
const MenuLink = ({ icon: Icon, iconColor = '#D4AF37', title, subtitle, badge, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.75}
        className="flex-row items-center bg-white/[0.04] px-4 py-4 rounded-[20px] border border-white/[0.07] mb-3 overflow-hidden relative"
    >
        <LinearGradient
            colors={['rgba(255,255,255,0.04)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        <View className="w-10 h-10 rounded-[14px] bg-white/5 border border-white/[0.08] items-center justify-center mr-4"
            style={{ backgroundColor: `${iconColor}10`, borderColor: `${iconColor}20` }}>
            <Icon color={iconColor} size={19} />
        </View>
        <View className="flex-1">
            <Text className="text-white font-bold text-[15px]">{title}</Text>
            {subtitle && <Text className="text-gray-500 text-[12px] mt-0.5">{subtitle}</Text>}
        </View>
        {badge && (
            <View className="px-2 py-0.5 rounded-lg mr-2" style={{ backgroundColor: `${badge.color}15` }}>
                <Text className="text-[10px] font-bold" style={{ color: badge.color }}>{badge.label}</Text>
            </View>
        )}
        <ChevronRight color="#374151" size={18} />
    </TouchableOpacity>
);

const SectionLabel = ({ title }) => (
    <Text className="text-soft-gold/60 text-[10px] font-bold tracking-widest uppercase mb-3 mt-7 ml-1">{title}</Text>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [socialAccount, setSocialAccount] = useState(null);
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: prof }, { data: social }, { data: earnedBadges }] = await Promise.all([
                supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
                supabase.from('social_accounts').select('follower_count, engagement_rate, username').eq('user_id', user.id).eq('platform', 'instagram').maybeSingle(),
                supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
            ]);

            if (prof) setProfile(prof);
            if (social) setSocialAccount(social);
            setBadges(earnedBadges?.map(b => b.badge_id) || []);
        } catch (e) {
            console.error('[ProfileScreen]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    const followerText = socialAccount?.follower_count
        ? (socialAccount.follower_count >= 1000
            ? (socialAccount.follower_count / 1000).toFixed(1) + 'K'
            : String(socialAccount.follower_count))
        : '—';

    const isVerified = profile?.verification_status === 'verified';
    const hasBlueTick = badges.includes('verified-account');
    const isSpotlight = profile?.spotlight_active;
    const initials = (profile?.full_name || profile?.username || 'U').substring(0, 2).toUpperCase();

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* Master backgrounds */}
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                >
                    {/* ── Hero ── */}
                    <View className="items-center pt-8 pb-6">
                        {/* Avatar with glow */}
                        <View className="relative mb-4">
                            <View className="absolute w-28 h-28 bg-soft-gold/15 rounded-full blur-[40px]" />
                            <View className={`w-24 h-24 rounded-full items-center justify-center border-[3px] overflow-hidden
                                ${isSpotlight ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'border-soft-gold/50 shadow-[0_0_16px_rgba(212,175,55,0.2)]'}`}
                                style={{ backgroundColor: '#1A1D24' }}>
                                {profile?.avatar_url
                                    ? <Image source={{ uri: profile.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                    : <Text className="text-white font-black text-2xl">{initials}</Text>}
                            </View>

                            {/* Badge icon overlay */}
                            {hasBlueTick && (
                                <View className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-500 rounded-full items-center justify-center border-2 border-[#020617]">
                                    <BadgeCheck color="white" size={14} />
                                </View>
                            )}
                        </View>

                        <Text className="text-white text-2xl font-black tracking-tight">{profile?.full_name || 'İsimsiz Kullanıcı'}</Text>
                        <Text className="text-gray-400 text-sm font-medium mt-0.5">
                            @{profile?.username || 'kullanici'}
                            {socialAccount?.username && socialAccount.username !== profile?.username && ` · @${socialAccount.username}`}
                        </Text>

                        {profile?.category && (
                            <View className="bg-white/5 px-4 py-1.5 rounded-full mt-3 border border-white/10">
                                <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">{profile.category}</Text>
                            </View>
                        )}

                        {/* Spotlight badge */}
                        {isSpotlight && (
                            <View className="mt-3 flex-row items-center gap-2 bg-purple-500/10 border border-purple-500/25 px-4 py-2 rounded-full">
                                <Star color="#a855f7" size={12} fill="#a855f7" />
                                <Text className="text-purple-300 text-xs font-bold">Spotlight Aktif</Text>
                            </View>
                        )}

                        {/* Stats row */}
                        <View className="flex-row gap-3 mt-6 w-full">
                            {[
                                { label: 'Takipçi', value: followerText, color: '#D4AF37' },
                                { label: 'Etkileşim', value: socialAccount?.engagement_rate ? `%${socialAccount.engagement_rate}` : '—', color: '#a855f7' },
                                { label: 'Rozet', value: String(badges.length), color: '#4ade80' },
                            ].map((stat) => (
                                <View key={stat.label} className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-[20px] p-4 items-center">
                                    <LinearGradient colors={['rgba(255,255,255,0.05)', 'transparent']} className="absolute inset-0 rounded-[20px]" />
                                    <Text className="font-black text-xl" style={{ color: stat.color }}>{stat.value}</Text>
                                    <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-wide mt-0.5">{stat.label}</Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* ── Profile & Features ── */}
                    <SectionLabel title="HESAP" />
                    <MenuLink icon={User} title="Profilim" subtitle="Profil bilgileri ve Instagram bağlantısı" onPress={() => navigation.navigate('MyProfile')} />
                    <MenuLink icon={ShieldCheck} iconColor={isVerified ? '#4ade80' : '#fbbf24'} title="Kişilik Doğrulama"
                        subtitle={isVerified ? 'Hesabın doğrulandı ✓' : 'Mavi tik için doğrula'}
                        badge={isVerified ? { label: 'DOĞRULANMIŞ', color: '#4ade80' } : null}
                        onPress={() => navigation.navigate('Verification')} />

                    <SectionLabel title="ÖZELLİKLER" />
                    <MenuLink icon={BarChart2} iconColor="#60a5fa" title="İstatistikler" subtitle="Performans ve erişim metrikleri" onPress={() => navigation.navigate('Statistics')} />
                    <MenuLink icon={Star} iconColor="#a855f7" title="Spotlight"
                        subtitle={isSpotlight ? 'Aktif plan görüntüle' : 'Markalar arasında öne çık'}
                        badge={isSpotlight ? { label: 'AKTİF', color: '#a855f7' } : null}
                        onPress={() => navigation.navigate('Spotlight')} />
                    <MenuLink icon={Award} iconColor="#D4AF37" title="Rozetler"
                        subtitle={`${badges.length} rozet kazanıldı`}
                        onPress={() => navigation.navigate('Badges')} />

                    <SectionLabel title="UYGULAMA" />
                    <MenuLink icon={Settings} iconColor="#9CA3AF" title="Ayarlar" subtitle="Şifre, bildirimler, destek" onPress={() => navigation.navigate('Settings')} />

                    {/* Logout */}
                    <TouchableOpacity
                        onPress={handleSignOut}
                        activeOpacity={0.8}
                        className="flex-row items-center bg-red-500/8 border border-red-500/20 px-4 py-4 rounded-[20px] mt-4 mb-4"
                    >
                        <View className="w-10 h-10 rounded-[14px] bg-red-500/10 border border-red-500/20 items-center justify-center mr-4">
                            <LogOut color="#EF4444" size={19} />
                        </View>
                        <Text className="text-red-500 font-bold text-[15px] flex-1">Çıkış Yap</Text>
                        <ChevronRight color="#374151" size={18} />
                    </TouchableOpacity>

                    <Text className="text-gray-700 text-[11px] text-center mt-2">InfluMatch v1.0</Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
