import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, ImageBackground, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Filter, Instagram, Award, ShieldCheck, Star, X, MapPin, Briefcase, Globe, Zap, Lock, Info, Sparkles, TrendingUp } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { BlurView } from 'expo-blur';

export default function DiscoverScreen() {
    const [influencers, setInfluencers] = useState([
        {
            id: 'mock1',
            full_name: 'Aslı Yılmaz',
            username: 'asliyilmaz',
            avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80',
            category: 'Moda & Giyim',
            spotlight_active: true,
            verification_status: 'verified',
            social_accounts: [{ platform: 'instagram', follower_count: 45200, engagement_rate: 5.2 }]
        },
        {
            id: 'mock2',
            full_name: 'Berk Demir',
            username: 'berkfit',
            avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80',
            category: 'Spor & Fitness',
            spotlight_active: false,
            verification_status: 'verified',
            social_accounts: [{ platform: 'instagram', follower_count: 12800, engagement_rate: 8.4 }]
        },
        {
            id: 'mock3',
            full_name: 'Selin Tech',
            username: 'selintech',
            avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80',
            category: 'Teknoloji',
            spotlight_active: true,
            verification_status: 'pending',
            social_accounts: [{ platform: 'instagram', follower_count: 8500, engagement_rate: 3.1 }]
        },
        {
            id: 'mock4',
            full_name: 'Gurme Can',
            username: 'yiyelimgezelim',
            avatar_url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&q=80',
            category: 'Yeme & İçme',
            spotlight_active: false,
            verification_status: 'verified',
            social_accounts: [{ platform: 'instagram', follower_count: 156000, engagement_rate: 2.8 }]
        }
    ]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInfluencer, setSelectedInfluencer] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    const openProfile = (influencer) => {
        setSelectedInfluencer(influencer);
        setModalVisible(true);
    };

    const closeProfile = () => {
        setModalVisible(false);
        setSelectedInfluencer(null);
    };

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

            if (data && data.length > 0) {
                setInfluencers(data);
            }
            // If empty, keep dummy data (demo mode)
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
                                    onPress={() => openProfile(item)}
                                    className={`w-[48%] mb-4 bg-surface rounded-3xl overflow-hidden shadow-lg shadow-black/50 border ${isSpotlight ? 'border-purple-500 shadow-purple-500/20' : 'border-white/10'}`}
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
                                        <View className={`absolute bottom-[-20px] w-16 h-16 rounded-full border-4 z-10 items-center justify-center overflow-hidden bg-gray-700 ${isSpotlight ? 'border-purple-500 shadow-purple-500/50' : 'border-surface'}`}>
                                            {item.avatar_url ? (
                                                <Image source={{ uri: item.avatar_url }} className="w-full h-full" />
                                            ) : (
                                                <Text className="text-white font-bold text-lg">{item.username?.charAt(0).toUpperCase()}</Text>
                                            )}
                                        </View>

                                        {/* Spotlight Crown / Badge */}
                                        {isSpotlight && (
                                            <View className="absolute top-2 right-2 bg-purple-500 px-2 py-0.5 rounded text-[8px] shadow-lg shadow-purple-500/50">
                                                <Text className="text-white text-[8px] font-bold">PRO</Text>
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
            {/* Profile Detail Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeProfile}
            >
                {selectedInfluencer && (
                    <View className="flex-1 bg-black/90 justify-end">
                        <View className="h-[90%] bg-midnight rounded-t-[32px] border-t border-white/10 overflow-hidden relative">
                            {/* Modal Header Image */}
                            <View className="h-48 w-full relative">
                                <Image
                                    source={{ uri: selectedInfluencer.avatar_url }}
                                    className="w-full h-full opacity-60"
                                    blurRadius={20}
                                />
                                <LinearGradient
                                    colors={['transparent', '#0F1014']}
                                    className="absolute inset-0"
                                />
                                <TouchableOpacity
                                    onPress={closeProfile}
                                    className="absolute top-4 right-4 w-10 h-10 bg-black/30 rounded-full items-center justify-center border border-white/10 z-50">
                                    <X color="white" size={20} />
                                </TouchableOpacity>
                            </View>

                            {/* Profile Content */}
                            <ScrollView className="flex-1 px-6 -mt-12">
                                <View className="items-center mb-6">
                                    <View className={`w-28 h-28 rounded-full border-4 items-center justify-center overflow-hidden bg-gray-700 mb-4 ${selectedInfluencer.spotlight_active ? 'border-purple-500 shadow-lg shadow-purple-500/50' : 'border-surface'}`}>
                                        <Image source={{ uri: selectedInfluencer.avatar_url }} className="w-full h-full" />
                                    </View>

                                    <View className="flex-row items-center space-x-2 mb-1">
                                        <Text className="text-white text-2xl font-bold">{selectedInfluencer.full_name}</Text>
                                        {selectedInfluencer.verification_status === 'verified' && <ShieldCheck color="#4ade80" size={20} fill="#4ade80" />}
                                    </View>
                                    <Text className="text-gray-400 text-sm font-medium mb-3">@{selectedInfluencer.username}</Text>

                                    {/* Tags */}
                                    <View className="flex-row space-x-2 mb-6">
                                        <View className="bg-white/5 px-3 py-1.5 rounded-full border border-white/10 flex-row items-center">
                                            <Briefcase color="#D4AF37" size={12} className="mr-1.5" />
                                            <Text className="text-gray-300 text-xs font-bold uppercase">{selectedInfluencer.category}</Text>
                                        </View>
                                        <View className="bg-white/5 px-3 py-1.5 rounded-full border border-white/10 flex-row items-center">
                                            <MapPin color="#6B7280" size={12} className="mr-1.5" />
                                            <Text className="text-gray-300 text-xs text-center">İstanbul, TR</Text>
                                        </View>
                                    </View>

                                    {/* Stats Cards */}
                                    <View className="flex-row justify-between w-full mb-8">
                                        <View className="bg-surface p-4 rounded-2xl border border-white/5 w-[30%] items-center">
                                            <Text className="text-white font-bold text-lg mb-1">
                                                {selectedInfluencer.social_accounts[0]?.follower_count > 1000
                                                    ? (selectedInfluencer.social_accounts[0]?.follower_count / 1000).toFixed(1) + 'K'
                                                    : selectedInfluencer.social_accounts[0]?.follower_count}
                                            </Text>
                                            <Text className="text-gray-500 text-[10px] uppercase font-bold text-center">Takipçi</Text>
                                        </View>
                                        <View className="bg-surface p-4 rounded-2xl border border-white/5 w-[30%] items-center">
                                            <Text className="text-white font-bold text-lg mb-1">%{selectedInfluencer.social_accounts[0]?.engagement_rate}</Text>
                                            <Text className="text-gray-500 text-[10px] uppercase font-bold text-center">Etkileşim</Text>
                                        </View>
                                        <View className="bg-surface p-4 rounded-2xl border border-white/5 w-[30%] items-center">
                                            <Text className="text-white font-bold text-lg mb-1">4.9</Text>
                                            <Text className="text-gray-500 text-[10px] uppercase font-bold text-center">Rating</Text>
                                        </View>
                                    </View>

                                    {/* Info Bar */}
                                    <View className="w-full bg-surface px-4 py-3 rounded-xl border border-white/5 mb-6 flex-row justify-between items-center">
                                        <View className="flex-1 mr-4">
                                            <View className="flex-row items-center mb-1">
                                                <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                                                <Text className="text-gray-300 text-[10px] font-bold">Son 6 gönderi analiz edildi</Text>
                                            </View>
                                            <View className="flex-row items-center">
                                                <Info color="#4B5563" size={10} className="mr-1" />
                                                <Text className="text-gray-500 text-[9px] flex-1" numberOfLines={1}>Not: Etkileşim verileri son paylaşılan içerikleri baz alır.</Text>
                                            </View>
                                        </View>
                                        <View className="items-end">
                                            <Text className="text-gray-600 text-[8px]">Son Güncelleme</Text>
                                            <Text className="text-gray-400 text-[9px] font-bold">8 Ocak 2026</Text>
                                        </View>
                                    </View>

                                    {/* Analysis Card */}
                                    <View className="w-full bg-surface rounded-3xl border border-soft-gold/30 p-5 mb-6 shadow-2xl shadow-soft-gold/5 relative overflow-hidden">
                                        {/* Glow Effect */}
                                        <LinearGradient
                                            colors={['rgba(212,175,55,0.05)', 'transparent']}
                                            className="absolute inset-0"
                                        />

                                        {/* Tabs */}
                                        <View className="flex-row mb-5 space-x-3">
                                            <View className="bg-soft-gold/10 border border-soft-gold/20 px-3 py-1.5 rounded-lg flex-row items-center">
                                                <Sparkles color="#D4AF37" size={10} className="mr-1.5" />
                                                <Text className="text-soft-gold text-[10px] font-bold">Genel Özet</Text>
                                            </View>
                                            <View className="bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg flex-row items-center opacity-50">
                                                <Lock color="#9CA3AF" size={10} className="mr-1.5" />
                                                <Text className="text-gray-400 text-[10px] font-bold">AI Uyum Skoru</Text>
                                                <Text className="text-[#333] text-[8px] font-bold ml-1 bg-[#111] px-1 rounded">SPOTLIGHT</Text>
                                            </View>
                                        </View>

                                        {/* Header */}
                                        <View className="flex-row items-center mb-4">
                                            <View className="w-8 h-8 rounded-full bg-soft-gold items-center justify-center mr-3 shadow-lg shadow-soft-gold/50">
                                                <Zap color="#0F1014" size={16} fill="#0F1014" />
                                            </View>
                                            <Text className="text-white font-bold text-lg mr-2">Detaylı Profil Analizi</Text>
                                            <View className="bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
                                                <Text className="text-gray-400 text-[8px] font-bold">BETA</Text>
                                            </View>
                                        </View>

                                        {/* Analysis Items */}
                                        <View className="space-y-2">
                                            <View className="bg-white/5 p-3 rounded-xl border border-white/5 flex-row items-center">
                                                <TrendingUp color="#D4AF37" size={14} className="mr-3" />
                                                <Text className="text-gray-300 text-xs font-medium">Gelişmekte olan bir etkileşim grafiği var.</Text>
                                            </View>
                                            <View className="bg-white/5 p-3 rounded-xl border border-white/5 flex-row items-center mt-2">
                                                <TrendingUp color="#D4AF37" size={14} className="mr-3" />
                                                <Text className="text-gray-300 text-xs font-medium">Niş kitlelere hitap eden Micro Influencer.</Text>
                                            </View>
                                            <View className="bg-white/5 p-3 rounded-xl border border-white/5 flex-row items-center mt-2">
                                                <TrendingUp color="#D4AF37" size={14} className="mr-3" />
                                                <Text className="text-gray-300 text-xs font-medium">Takipçileriyle güçlü bir iletişimi var.</Text>
                                            </View>
                                        </View>

                                        <Text className="text-gray-600 text-[8px] mt-4 text-center">* Bu analiz Gemini AI tarafından oluşturulmuştur.</Text>
                                    </View>

                                    {/* Badges Row in Modal */}
                                    <View className="w-full mb-6">
                                        <Text className="text-white font-bold text-base mb-3">Rozetler</Text>
                                        <View className="flex-row flex-wrap">
                                            <View className="bg-white/5 px-3 py-2 rounded-xl border border-white/10 mr-2 mb-2 flex-row items-center">
                                                <Star color="#D4AF37" size={12} className="mr-2" />
                                                <Text className="text-gray-300 text-xs text-center">Yükselen Yıldız</Text>
                                            </View>
                                            <View className="bg-white/5 px-3 py-2 rounded-xl border border-white/10 mr-2 mb-2 flex-row items-center">
                                                <Award color="#A855F7" size={12} className="mr-2" />
                                                <Text className="text-gray-300 text-xs text-center">Güvenilir</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Bio / About */}
                                    <View className="w-full bg-surface p-5 rounded-2xl border border-white/5 mb-6">
                                        <Text className="text-white font-bold text-base mb-2">Hakkında</Text>
                                        <Text className="text-gray-400 text-sm leading-6">
                                            Merhaba! Ben {selectedInfluencer.full_name}, {selectedInfluencer.category} alanında içerik üretiyorum. Markalarla yaratıcı projelerde çalışmayı seviyorum. Profesyonel iş birlikleri için bana ulaşabilirsiniz.
                                        </Text>
                                    </View>

                                    {/* Action Buttons */}
                                    {/* Only show 'Teklif Ver' if user is Brand (Currently logged in user role logic needed, but UI shown) */}
                                    <TouchableOpacity
                                        className="w-full bg-soft-gold h-14 rounded-xl items-center justify-center mb-10 shadow-lg shadow-soft-gold/20"
                                        onPress={() => alert('Teklif verme ekranına yönlendiriliyor...')}
                                    >
                                        <Text className="text-midnight font-bold text-base uppercase tracking-wider">Teklif Gönder</Text>
                                    </TouchableOpacity>

                                </View>
                            </ScrollView>
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    );
}
