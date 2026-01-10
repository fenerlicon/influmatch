import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, RefreshControl, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Search, TrendingUp, ShieldCheck, PieChart, Star, Instagram, Eye, EyeOff } from 'lucide-react-native';
import { CustomToast } from '../components/CustomToast';

export default function DashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [socialAccount, setSocialAccount] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    // Instagram Connect State
    const [instaUsername, setInstaUsername] = useState('');
    const [connectLoading, setConnectLoading] = useState(false);

    // Stats
    const [stats, setStats] = useState({
        trustScore: 85,
        profileCompletion: 70,
        favorites: 12,
        pendingOffers: 3
    });

    useEffect(() => {
        getProfile();
    }, []);

    async function getProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setUser(user);

            // Fetch Profile
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (data) {
                setProfile(data);
                // Instagram Linkini profile.social_links'den veya social_accounts tablosundan al
            }

            // Fetch Social Account (Statistics)
            const { data: social, error: socialError } = await supabase
                .from('social_accounts')
                .select('*')
                .eq('user_id', user.id)
                .eq('platform', 'instagram')
                .single();

            if (social) setSocialAccount(social);

            // Mock Stats Update based on real data if available
            if (data) {
                // Calculate basic completion (Mock logic)
                let score = 20;
                if (data.avatar_url) score += 20;
                if (data.bio) score += 20;
                if (data.city) score += 20;
                if (social) score += 20;
                setStats(prev => ({ ...prev, profileCompletion: score }));
            }

        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const toggleSpotlight = async () => {
        if (!profile) return;
        const newVal = !profile.is_showcase_visible;

        // Optimistic Update
        setProfile({ ...profile, is_showcase_visible: newVal });

        const { error } = await supabase
            .from('users')
            .update({ is_showcase_visible: newVal })
            .eq('id', user.id);

        if (error) {
            Alert.alert('Hata', 'Spotlight durumu güncellenemedi.');
            setProfile({ ...profile, is_showcase_visible: !newVal }); // Rollback
        }
    };

    const handleConnectInstagram = async () => {
        if (!instaUsername.trim()) {
            Alert.alert('Hata', 'Lütfen bir kullanıcı adı girin.');
            return;
        }
        setConnectLoading(true);

        // Simulating API Call / Integration Logic
        // In reality, this would call your Backend API to fetch stats from Instagram
        setTimeout(async () => {
            // Mock success
            try {
                // Insert dummy social account for demo if not exists
                const { error } = await supabase.from('social_accounts').upsert({
                    user_id: user.id,
                    platform: 'instagram',
                    username: instaUsername.replace('@', ''),
                    follower_count: 12500, // Mock
                    engagement_rate: 4.8, // Mock
                    has_stats: true,
                    updated_at: new Date()
                });

                if (!error) {
                    Alert.alert('Başarılı', 'Instagram hesabı başarıyla bağlandı ve doğrulandı!');
                    getProfile(); // Refresh
                } else {
                    Alert.alert('Hata', 'Veritabanı hatası: ' + error.message);
                }
            } catch (e) {
                Alert.alert('Hata', 'Bağlantı hatası.');
            } finally {
                setConnectLoading(false);
            }
        }, 1500);
    };

    const onRefresh = () => {
        setRefreshing(true);
        getProfile();
    };

    if (loading) {
        return (
            <View className="flex-1 bg-midnight items-center justify-center">
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row justify-between items-center bg-midnight z-10">
                    <View className="flex-row items-center space-x-3">
                        <View className="w-10 h-10 rounded-full bg-soft-gold items-center justify-center border-2 border-white/10 overflow-hidden">
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                            ) : (
                                <Text className="text-[#0B0F19] font-bold text-base">
                                    {profile?.username ? profile.username.substring(0, 2).toUpperCase() : 'US'}
                                </Text>
                            )}
                        </View>
                        <View>
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Influencer Paneli</Text>
                            <Text className="text-white font-bold text-base">
                                @{profile?.username || 'kullanici'}
                            </Text>
                        </View>
                    </View>
                    <View className="flex-row items-center space-x-3">
                        {/* Spotlight Status Badge in Header */}
                        {profile?.spotlight_active && (
                            <View className="bg-soft-gold/20 px-2 py-1 rounded border border-soft-gold/50">
                                <Text className="text-soft-gold text-[8px] font-bold">PRO</Text>
                            </View>
                        )}
                        <TouchableOpacity className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-white/5">
                            <Bell color="white" size={18} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
                >
                    {/* Welcome Text */}
                    <View className="mt-2 mb-6">
                        <Text className="text-white text-2xl font-bold mb-1">Genel Bakış</Text>
                        <Text className="text-gray-400 text-sm">Profil gücünü artır ve teklifleri yönet.</Text>
                    </View>

                    {/* Spotlight Toggle Card */}
                    <LinearGradient
                        colors={['rgba(212,175,55,0.1)', 'rgba(212,175,55,0.05)']}
                        className="p-4 rounded-2xl border border-soft-gold/30 mb-6 flex-row items-center justify-between"
                    >
                        <View className="flex-1 mr-4">
                            <Text className="text-soft-gold font-bold text-lg mb-1">Vitrine Çık</Text>
                            <Text className="text-gray-400 text-xs">
                                {profile?.is_showcase_visible
                                    ? 'Profilin şu an markalar tarafından görüntülenebilir.'
                                    : 'Profilin gizli. Görünür olmak için aç.'}
                            </Text>
                        </View>
                        <Switch
                            trackColor={{ false: "#3e3e3e", true: "#D4AF37" }}
                            thumbColor={profile?.is_showcase_visible ? "#FFFFFF" : "#f4f3f4"}
                            onValueChange={toggleSpotlight}
                            value={profile?.is_showcase_visible}
                        />
                    </LinearGradient>

                    {/* Stats Grid */}
                    <View className="flex-row flex-wrap justify-between mb-2">
                        <View className="w-[48%] p-4 rounded-2xl mb-4 bg-surface border border-white/10">
                            <View className="flex-row justify-between items-start mb-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase">PROFİL</Text>
                                <PieChart color="#D4AF37" size={20} />
                            </View>
                            <Text className="text-white text-2xl font-bold mb-1">%{stats.profileCompletion}</Text>
                            <Text className="text-gray-500 text-[10px]">Doluluk oranı</Text>
                        </View>
                        <View className="w-[48%] p-4 rounded-2xl mb-4 bg-surface border border-white/10">
                            <View className="flex-row justify-between items-start mb-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase">TEKLİF</Text>
                                <TrendingUp color="#D4AF37" size={20} />
                            </View>
                            <Text className="text-white text-2xl font-bold mb-1">{stats.pendingOffers}</Text>
                            <Text className="text-gray-500 text-[10px]">Bekleyen teklif</Text>
                        </View>
                    </View>

                    {/* Instagram Verification Section */}
                    {!(socialAccount && socialAccount.has_stats) ? (
                        <View className="p-6 rounded-3xl border border-white/10 bg-surface mb-6 relative overflow-hidden">
                            <LinearGradient
                                colors={['rgba(131, 58, 180, 0.1)', 'rgba(253, 29, 29, 0.05)', 'rgba(252, 176, 69, 0.05)']}
                                className="absolute inset-0"
                            />
                            <View className="flex-row items-center mb-4">
                                <View className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-orange-500 items-center justify-center mr-4">
                                    <Instagram color="white" size={24} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-lg">Hesabını Doğrula</Text>
                                    <Text className="text-gray-400 text-xs">İstatistiklerini göster, güven kazan.</Text>
                                </View>
                            </View>

                            <View className="flex-row items-center space-x-3">
                                <View className="flex-1 bg-black/30 border border-white/10 rounded-xl h-12 justify-center px-4">
                                    <TextInput
                                        placeholder="Instagram Kullanıcı Adı"
                                        placeholderTextColor="#6B7280"
                                        className="text-white font-medium"
                                        value={instaUsername}
                                        onChangeText={setInstaUsername}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={handleConnectInstagram}
                                    disabled={connectLoading}
                                    className="bg-white h-12 px-6 rounded-xl items-center justify-center"
                                >
                                    {connectLoading ? (
                                        <ActivityIndicator color="black" size="small" />
                                    ) : (
                                        <Text className="text-black font-bold">Bağla</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        // Connected State
                        <View className="p-4 rounded-3xl border border-green-500/20 bg-green-500/5 mb-6 flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-green-500/20 items-center justify-center mr-3">
                                    <Instagram color="#4ade80" size={20} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold">Instagram Bağlı</Text>
                                    <Text className="text-green-400 text-xs">@{socialAccount.username} • Doğrulandı</Text>
                                </View>
                            </View>
                            <ShieldCheck color="#4ade80" size={24} />
                        </View>
                    )}

                    <View className="h-10" />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
