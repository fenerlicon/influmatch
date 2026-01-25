import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Settings, ChevronRight, Star, Award, ShieldCheck, User, LogOut, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen({ navigation }) {

    const [profile, setProfile] = useState(null);
    const [socialAccount, setSocialAccount] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getProfile();
    }, []);

    async function getProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch User Profile
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) setProfile(data);

            // Fetch Social Stats
            const { data: social } = await supabase
                .from('social_accounts')
                .select('*')
                .eq('user_id', user.id)
                .eq('platform', 'instagram')
                .single();

            if (social) setSocialAccount(social);

        } catch (error) {
            console.log('Error fetching properties:', error);
        } finally {
            setLoading(false);
        }
    }

    // Geçici Çıkış Logic'i
    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const MenuLink = ({ icon, title, subtitle, onPress }) => (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center bg-[#15171e] p-4 rounded-2xl border border-white/5 mb-3"
        >
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-4">
                {icon}
            </View>
            <View className="flex-1">
                <Text className="text-white font-bold text-base">{title}</Text>
                {subtitle && <Text className="text-gray-500 text-xs">{subtitle}</Text>}
            </View>
            <ChevronRight color="#4B5563" size={20} />
        </TouchableOpacity>
    );

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

            {/* MASTER BACKGROUND GRADIENTS */}
            <LinearGradient
                colors={['#1e1b4b', '#020617', '#020617']}
                className="absolute inset-0"
            />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView
                    className="flex-1 p-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 120 }}
                >

                    {/* Header Profile Card */}
                    <View className="items-center mb-8">
                        <View className="w-24 h-24 rounded-full bg-soft-gold items-center justify-center border-4 border-[#020617] shadow-2xl shadow-soft-gold/20 mb-4 overflow-hidden">
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                            ) : (
                                <Text className="text-[#020617] font-bold text-2xl">
                                    {(profile?.full_name || profile?.username || 'U').substring(0, 2).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text className="text-white text-2xl font-bold">{profile?.full_name || 'İsimsiz Kullanıcı'}</Text>
                        <Text className="text-soft-gold text-sm font-medium">@{profile?.username || 'kullanici'}</Text>

                        {profile?.role === 'influencer' && (
                            <View className="bg-white/5 px-3 py-1 rounded-full mt-2 border border-white/10">
                                <Text className="text-gray-400 text-[10px] uppercase font-bold tracking-widest">{profile?.category || 'Genel'}</Text>
                            </View>
                        )}

                        {/* Stats Row */}
                        <View className="flex-row mt-6 space-x-4">
                            <View className="bg-[#15171e] px-6 py-3 rounded-2xl border border-white/10 items-center min-w-[100px]">
                                <Text className="text-white font-bold text-lg">
                                    {socialAccount?.follower_count
                                        ? (socialAccount.follower_count > 1000
                                            ? (socialAccount.follower_count / 1000).toFixed(1) + 'K'
                                            : socialAccount.follower_count)
                                        : '0'}
                                </Text>
                                <Text className="text-gray-500 text-[10px] uppercase">Takipçi</Text>
                            </View>
                            <View className="bg-[#15171e] px-6 py-3 rounded-2xl border border-white/10 items-center min-w-[100px]">
                                <Text className="text-white font-bold text-lg">{socialAccount?.engagement_rate ? socialAccount.engagement_rate + '%' : '-'}</Text>
                                <Text className="text-gray-500 text-[10px] uppercase">Etkileşim</Text>
                            </View>
                        </View>
                    </View>

                    {/* Menu Items */}
                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 ml-1">Hesap & Özellikler</Text>

                    <MenuLink
                        icon={<User color="#D4AF37" size={20} />}
                        title="Profilim"
                        subtitle="Profilini düzenle ve görüntüle"
                        onPress={() => navigation.navigate('MyProfile')}
                    />

                    <MenuLink
                        icon={<Star color="#D4AF37" size={20} />}
                        title="Spotlight"
                        subtitle="Markalar arasında öne çık"
                        onPress={() => navigation.navigate('Spotlight')}
                    />

                    <MenuLink
                        icon={<Award color="#D4AF37" size={20} />}
                        title="Rozetler"
                        subtitle="Kazandığın başarımları gör"
                        onPress={() => navigation.navigate('Badges')}
                    />



                    <MenuLink
                        icon={<TrendingUp color="#D4AF37" size={20} />}
                        title="İstatistikler"
                        subtitle="Performans ve erişim analizi"
                        onPress={() => navigation.navigate('Statistics')}
                    />

                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-6 mb-4 ml-1">Uygulama</Text>

                    <MenuLink
                        icon={<Settings color="white" size={20} />}
                        title="Ayarlar"
                        onPress={() => navigation.navigate('Settings')}
                    />

                    <TouchableOpacity
                        onPress={handleSignOut}
                        className="flex-row items-center bg-red-500/10 p-4 rounded-2xl border border-red-500/20 mb-10"
                    >
                        <View className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center mr-4">
                            <LogOut color="#EF4444" size={20} />
                        </View>
                        <Text className="text-red-500 font-bold text-base">Çıkış Yap</Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
