import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Filter, Instagram, Award, ShieldCheck, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { BlurView } from 'expo-blur';

export default function DiscoverScreen() {
    const [influencers, setInfluencers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchInfluencers();
    }, []);

    const fetchInfluencers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select(`
                    id, 
                    full_name, 
                    username, 
                    avatar_url, 
                    category, 
                    spotlight_active, 
                    displayed_badges, 
                    verification_status,
                    social_accounts (
                        platform,
                        follower_count,
                        engagement_rate
                    )
                `)
                .eq('role', 'influencer')
                .eq('is_showcase_visible', true)
                .order('spotlight_active', { ascending: false })
                .limit(20);

            if (error) throw error;
            setInfluencers(data || []);
        } catch (error) {
            console.log('Error fetching influencers:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderBadge = (badgeCode) => {
        // Simple badge mapper based on string or ID
        // In real app, you might map IDs to Icons
        return (
            <View className="bg-white/10 p-1 rounded-full mr-1">
                <Star color="#D4AF37" size={10} fill="#D4AF37" />
            </View>
        );
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
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pb-4 border-b border-white/5 bg-midnight pt-2">
                    <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mb-1">VİTRİN</Text>
                    <Text className="text-white text-3xl font-bold mb-4">Topluluğu Keşfet</Text>

                    <Text className="text-gray-400 text-xs mb-4 leading-5">
                        Diğer influencer profillerini incele, Spotlight vitrininde nasıl göründüğünü karşılaştır.
                    </Text>

                    <View className="flex-row space-x-3">
                        <View className="flex-1 h-12 bg-surface border border-white/10 rounded-xl flex-row items-center px-4">
                            <Search color="#6B7280" size={20} />
                            <TextInput
                                placeholder="Kullanıcı adı veya kategori..."
                                placeholderTextColor="#6B7280"
                                className="flex-1 ml-3 text-white font-medium"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <TouchableOpacity className="w-12 h-12 bg-surface border border-white/10 rounded-xl items-center justify-center">
                            <Filter color="#D4AF37" size={20} />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    <View className="flex-row flex-wrap justify-between">
                        {influencers.map((item) => {
                            const instagram = item.social_accounts?.find(acc => acc.platform === 'instagram');
                            const isVerified = item.verification_status === 'verified';
                            const isSpotlight = item.spotlight_active;

                            return (
                                <TouchableOpacity
                                    key={item.id}
                                    activeOpacity={0.9}
                                    className={`w-[48%] mb-4 bg-surface rounded-3xl overflow-hidden shadow-lg shadow-black/50 border ${isSpotlight ? 'border-soft-gold' : 'border-white/10'}`}
                                >
                                    <View className="h-32 bg-gray-800 relative items-center justify-center">
                                        {/* Avatar Background Blur Effect */}
                                        {item.avatar_url ? (
                                            <Image
                                                source={{ uri: item.avatar_url }}
                                                className="absolute inset-0 w-full h-full opacity-50"
                                                blurRadius={10}
                                            />
                                        ) : (
                                            <LinearGradient colors={['#2A2D35', '#1F2128']} className="absolute inset-0" />
                                        )}

                                        <LinearGradient
                                            colors={['transparent', 'rgba(15, 16, 20, 0.9)']}
                                            className="absolute inset-0"
                                        />

                                        {/* Avatar */}
                                        <View className={`absolute bottom-[-20px] w-16 h-16 rounded-full border-4 z-10 items-center justify-center overflow-hidden bg-gray-700 ${isSpotlight ? 'border-soft-gold shadow-soft-gold/50' : 'border-surface'}`}>
                                            {item.avatar_url ? (
                                                <Image source={{ uri: item.avatar_url }} className="w-full h-full" />
                                            ) : (
                                                <Text className="text-white font-bold text-lg">{item.username?.charAt(0).toUpperCase()}</Text>
                                            )}
                                        </View>

                                        {/* Spotlight Crown / Badge */}
                                        {isSpotlight && (
                                            <View className="absolute top-2 right-2 bg-soft-gold px-2 py-0.5 rounded text-[8px]">
                                                <Text className="text-midnight text-[8px] font-bold">PRO</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View className="pt-8 pb-4 px-3 items-center">
                                        <View className="flex-row items-center justify-center space-x-1 mb-0.5">
                                            <Text className="text-white font-bold text-base text-center" numberOfLines={1}>
                                                {item.full_name || item.username}
                                            </Text>
                                            {isVerified && <ShieldCheck color="#4ade80" size={14} fill="#4ade80" />}
                                        </View>

                                        <Text className="text-gray-500 text-xs mb-2 text-center">@{item.username}</Text>

                                        {/* Category Badge */}
                                        {item.category && (
                                            <View className="bg-white/5 py-1 px-3 rounded-full mb-3 border border-white/5">
                                                <Text className="text-gray-300 text-[10px] uppercase font-bold" numberOfLines={1}>
                                                    {Array.isArray(item.category) ? item.category[0] : item.category}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Stats Row */}
                                        <View className="flex-row items-center justify-center space-x-3 w-full border-t border-white/5 pt-3">
                                            <View className="items-center">
                                                <Text className="text-white font-bold text-xs">
                                                    {instagram?.follower_count ? (instagram.follower_count > 1000 ? (instagram.follower_count / 1000).toFixed(1) + 'K' : instagram.follower_count) : '-'}
                                                </Text>
                                                <Text className="text-gray-600 text-[8px] uppercase">Takipçi</Text>
                                            </View>
                                            <View className="w-[1px] h-6 bg-white/10" />
                                            <View className="items-center">
                                                <Text className="text-white font-bold text-xs">
                                                    {instagram?.engagement_rate ? instagram.engagement_rate + '%' : '-'}
                                                </Text>
                                                <Text className="text-gray-600 text-[8px] uppercase">Etkileşim</Text>
                                            </View>
                                        </View>

                                        {/* Badges Row */}
                                        {/* <View className="flex-row mt-3 justify-center">
                                            {renderBadge()}
                                            {renderBadge()}
                                        </View> */}
                                    </View>
                                </TouchableOpacity>
                            )
                        })}
                        {influencers.length === 0 && !loading && (
                            <Text className="text-gray-500 text-center w-full mt-10">Kriterlere uygun influencer bulunamadı.</Text>
                        )}
                    </View>
                    <View className="h-24" />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
