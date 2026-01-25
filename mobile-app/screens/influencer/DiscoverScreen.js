import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, ActivityIndicator, Modal, Dimensions, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Filter, BadgeCheck, X, MapPin, Briefcase, Sparkles, TrendingUp, Smartphone, ChevronRight, Award, Check, ArrowLeft } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.42;

// Genişletilmiş Rozet İsimleri (Türkçe)
const BADGE_NAMES = {
    'verified-account': 'Doğrulanmış Hesap',
    'founder-member': 'Kurucu Üye',
    'profile-expert': 'Profil Uzmanı',
    'rising-star': 'Yükselen Yıldız',
    'high-engagement': 'Yüksek Etkileşim',
    'creative-mind': 'Yaratıcı Zihin',
    'trend-setter': 'Trend Belirleyici',
    'community-leader': 'Topluluk Lideri',
    'early-adopter': 'Erken Üye',
    'pro-member': 'Pro Üye',
    'content-creator': 'İçerik Üreticisi',
    'super-seller': 'Süper Satıcı',
    'brand-favorite': 'Marka Favorisi',
    'consistent-poster': 'İstikrarlı Paylaşım',
    'elite-influencer': 'Elit Influencer'
};

// Kategori Çevirileri ve Normalizasyon
const CATEGORY_MAP = {
    'lifestyle': 'Yaşam Tarzı',
    'Lifestyle': 'Yaşam Tarzı',
    'food': 'Yeme & İçme',
    'Food': 'Yeme & İçme',
    'technology': 'Teknoloji',
    'Technology': 'Teknoloji',
    'tech': 'Teknoloji',
    'fashion': 'Moda',
    'Fashion': 'Moda',
    'travel': 'Seyahat',
    'Travel': 'Seyahat',
    'beauty': 'Güzellik',
    'Beauty': 'Güzellik',
    'fitness': 'Spor & Fitness',
    'Fitness': 'Spor & Fitness',
    'gaming': 'Oyun',
    'Gaming': 'Oyun',
    'music': 'Müzik',
    'art': 'Sanat',
    'finance': 'Finans',
    'education': 'Eğitim',
    'health': 'Sağlık',
    'business': 'İş Dünyası'
};

// Custom Verified Badge Component
const VerifiedBadge = ({ size = 14 }) => (
    <View className="relative items-center justify-center ml-1" style={{ width: size, height: size }}>
        <BadgeCheck color="#3b82f6" fill="#3b82f6" size={size} className="absolute" />
        <Check color="white" size={size * 0.6} strokeWidth={4} />
    </View>
);

// --- COMPONENTS ---

// Horizontal Influencer Card
const InfluencerCard = memo(({ item, onPress, width: customWidth }) => {
    const instagram = item.social_accounts?.[0];
    const isVerified = item.verification_status === 'verified';
    const isSpotlight = item.spotlight_active;

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPress}
            style={{ width: customWidth || CARD_WIDTH }}
            className={`mr-4 relative ${customWidth ? 'mb-4 mr-0' : ''}`}
        >
            <View className={`h-64 rounded-2xl overflow-hidden bg-[#15171e] border ${isSpotlight ? 'border-purple-500 border-2 shadow-sm shadow-purple-500/30' : 'border-white/5'}`}>
                <View className="h-40 w-full relative">
                    {item.avatar_url ? (
                        <Image
                            source={{ uri: item.avatar_url?.includes('?') ? item.avatar_url : `${item.avatar_url}?w=400&q=80` }}
                            className="w-full h-full"
                            resizeMode="cover"
                            fadeDuration={0}
                        />
                    ) : (
                        <View className="w-full h-full items-center justify-center bg-[#1F2128]">
                            <Text className="text-white font-bold text-2xl opacity-50">{item.username?.charAt(0).toUpperCase()}</Text>
                        </View>
                    )}

                    <LinearGradient
                        colors={['transparent', 'rgba(21, 23, 30, 1)']}
                        className="absolute bottom-0 left-0 right-0 h-20"
                    />

                    {isSpotlight && (
                        <LinearGradient
                            colors={['rgba(168, 85, 247, 0.9)', 'rgba(168, 85, 247, 0.5)']}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            className="absolute top-2 right-2 px-2 py-0.5 rounded-md"
                        >
                            <Text className="text-white text-[9px] font-black tracking-widest">ÖNE ÇIKAN</Text>
                        </LinearGradient>
                    )}
                </View>

                <View className="flex-1 px-3 py-2 justify-between pb-3">
                    <View>
                        <View className="flex-row items-center space-x-1 mb-0.5">
                            <Text className="text-white font-bold text-sm leading-5" numberOfLines={1}>
                                {item.full_name || item.username}
                            </Text>
                            {isVerified && instagram && <VerifiedBadge size={14} />}
                        </View>
                        <Text className="text-gray-500 text-[10px]" numberOfLines={1}>@{item.username}</Text>
                    </View>

                    <View className="flex-row items-center space-x-3">
                        <View>
                            <Text className="text-white font-bold text-xs">
                                {instagram?.follower_count ? (instagram.follower_count > 1000 ? (instagram.follower_count / 1000).toFixed(1) + 'K' : instagram.follower_count) : '-'}
                            </Text>
                            <Text className="text-gray-600 text-[8px] uppercase">Takipçi</Text>
                        </View>
                        <View className="w-[1px] h-4 bg-white/10" />
                        <View>
                            <Text className="text-soft-gold font-bold text-xs">
                                {instagram?.engagement_rate ? instagram.engagement_rate + '%' : '-'}
                            </Text>
                            <Text className="text-gray-600 text-[8px] uppercase">Etkileşim</Text>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const CategorySection = memo(({ title, data, onProfilePress, onViewAll }) => {
    if (!data || data.length === 0) return null;

    return (
        <View className="mb-8">
            <View className="flex-row items-center justify-between px-6 mb-4">
                <Text className="text-white font-bold text-lg tracking-tight">{title}</Text>
                <TouchableOpacity onPress={() => onViewAll(title, data)} className="flex-row items-center p-1">
                    <Text className="text-gray-500 text-xs font-medium mr-1">Tümü</Text>
                    <ChevronRight color="#6b7280" size={14} />
                </TouchableOpacity>
            </View>

            <FlatList
                horizontal
                data={data}
                renderItem={({ item }) => <InfluencerCard item={item} onPress={() => onProfilePress(item)} />}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 24 }}
                showsHorizontalScrollIndicator={false}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                    length: CARD_WIDTH + 16, // Card width + margin (mr-4 = 16px)
                    offset: (CARD_WIDTH + 16) * index,
                    index,
                })}
            />
        </View>
    );
});


export default function DiscoverScreen() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal & Selection
    const [selectedInfluencer, setSelectedInfluencer] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Category Detail Modal
    const [selectedCategoryData, setSelectedCategoryData] = useState(null);
    const [categoryModalVisible, setCategoryModalVisible] = useState(false);

    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [detailedBadges, setDetailedBadges] = useState([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const openProfile = useCallback((influencer) => {
        // If coming from category modal, keep category modal open beneath
        setSelectedInfluencer(influencer);
        setModalVisible(true);
        fetchUserBadges(influencer.id);
    }, []);

    const closeProfile = useCallback(() => {
        setModalVisible(false);
        setSelectedInfluencer(null);
        setDetailedBadges([]);
    }, []);

    const openCategory = useCallback((title, data) => {
        setSelectedCategoryData({ title, data });
        setCategoryModalVisible(true);
    }, []);

    const closeCategory = useCallback(() => {
        setCategoryModalVisible(false);
        setSelectedCategoryData(null);
    }, []);

    const fetchUserBadges = async (userId) => {
        setLoadingDetails(true);
        try {
            const { data, error } = await supabase
                .from('user_badges')
                .select('badge_id')
                .eq('user_id', userId);

            if (data) {
                setDetailedBadges(data.map(b => b.badge_id));
            }
        } catch (e) {
            console.log("Badge fetch error", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    useEffect(() => {
        const fetchUserRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                if (userData) setCurrentUserRole(userData.role);
            }
        };
        fetchUserRole();
    }, []);

    const fetchInfluencers = async () => {
        try {
            const { data: users, error: userError } = await supabase
                .from('users')
                .select('id, full_name, username, avatar_url, category, city, spotlight_active, is_showcase_visible, verification_status')
                .eq('role', 'influencer')
                .is('is_showcase_visible', true)  // Vitrin görünürlüğü AKTİF
                // .eq('verification_status', 'verified') // (İsteğe bağlı: Doğrulanmış hesap şartı kapalı)
                .neq('verification_status', 'pending') // Bekleyen hesaplar GİZLİ
                .neq('verification_status', 'rejected') // Reddedilenler GİZLİ
                .order('spotlight_active', { ascending: false });

            if (userError) {
                console.log("User fetch error:", userError.message);
                return;
            }
            console.log("Fetched users count:", users ? users.length : 0);

            if (!users || users.length === 0) {
                console.log("No users found with role='influencer'");
                setCategories([]);
                return;
            }

            const userIds = users.map(u => u.id);
            const { data: socialAccounts } = await supabase
                .from('social_accounts')
                .select('user_id, platform, follower_count, engagement_rate')
                .in('user_id', userIds)
                .eq('platform', 'instagram');

            const allInfluencers = users.map(user => {
                const account = socialAccounts?.find(a => a.user_id === user.id);
                // Kategori Normalizasyonu
                let cat = user.category || 'Diğer';
                if (CATEGORY_MAP[cat]) {
                    cat = CATEGORY_MAP[cat];
                } else {
                    cat = cat.charAt(0).toUpperCase() + cat.slice(1);
                }

                return {
                    ...user,
                    displayCategory: cat,
                    social_accounts: account ? [account] : []
                };
            });

            const grouped = [];

            // Spotlight
            // Verisi olmayan (Instagram bağlamamış) kullanıcılar öne çıkanlarda görünmesin
            const spotlightUsers = allInfluencers.filter(u => u.spotlight_active && u.social_accounts && u.social_accounts.length > 0);
            if (spotlightUsers.length > 0) {
                grouped.push({ title: '🔥 Öne Çıkanlar', data: spotlightUsers });
            }

            // Categories
            const categoryMap = {};
            allInfluencers.forEach(user => {
                const cat = user.displayCategory;
                if (!categoryMap[cat]) categoryMap[cat] = [];
                categoryMap[cat].push(user);
            });

            Object.keys(categoryMap).forEach(catTitle => {
                if (categoryMap[catTitle].length > 0) {
                    grouped.push({ title: catTitle, data: categoryMap[catTitle] });
                }
            });

            setCategories(grouped);

        } catch (error) {
            console.log('Error:', error);
            Alert.alert("Hata", "Veriler yüklenirken bir sorun oluştu.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchInfluencers();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchInfluencers();
        setRefreshing(false);
    }, []);

    if (loading && !refreshing) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pb-2 pt-2">
                    <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mb-1">KEŞFET</Text>
                    <Text className="text-white text-3xl font-bold mb-4 tracking-tight">Vitrin</Text>

                    <View className="bg-white/5 border border-white/10 rounded-2xl flex-row items-center px-4 h-12 mb-4">
                        <Search color="#6B7280" size={18} />
                        <TextInput
                            placeholder="Influencer ara..."
                            placeholderTextColor="#6B7280"
                            className="flex-1 ml-3 text-white font-medium text-sm"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>
                </View>

                <FlatList
                    data={categories}
                    keyExtractor={(item) => item.title}
                    renderItem={({ item }) => (
                        <CategorySection
                            title={item.title}
                            data={item.data}
                            onProfilePress={openProfile}
                            onViewAll={openCategory}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />
                    }
                    ListEmptyComponent={
                        !loading && <Text className="text-gray-500 text-center mt-10">Kriterlere uygun influencer bulunamadı.</Text>
                    }
                />
            </SafeAreaView>

            {/* --- CATEGORY DETAIL MODAL (FULL SCREEN) --- */}
            <Modal
                animationType="slide"
                transparent={false}
                visible={categoryModalVisible}
                onRequestClose={closeCategory}
            >
                <View className="flex-1 bg-[#020617]">
                    <StatusBar style="light" />
                    <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

                    <SafeAreaView className="flex-1" edges={['top']}>
                        {/* Header */}
                        <View className="px-6 py-4 flex-row items-center space-x-4 border-b border-white/5">
                            <TouchableOpacity onPress={closeCategory} className="w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/10">
                                <ArrowLeft color="white" size={24} />
                            </TouchableOpacity>
                            <Text className="text-white text-xl font-bold flex-1" numberOfLines={1}>{selectedCategoryData?.title}</Text>
                        </View>

                        {/* Grid List */}
                        <FlatList
                            data={selectedCategoryData?.data}
                            keyExtractor={item => item.id}
                            numColumns={2}
                            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 24 }}
                            contentContainerStyle={{ paddingVertical: 20, paddingBottom: 100 }}
                            renderItem={({ item }) => (
                                <InfluencerCard
                                    item={item}
                                    onPress={() => openProfile(item)}
                                    width={(width - 48 - 16) / 2} // (Screen - Padding - Gap) / 2
                                />
                            )}
                        />
                    </SafeAreaView>
                </View>
            </Modal>


            {/* --- PROFILE DETAIL MODAL (BOTTOM SHEET) --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeProfile}
            >
                {selectedInfluencer && (
                    <View className="flex-1 bg-black/90 justify-end">
                        <TouchableOpacity className="flex-1" onPress={closeProfile} />

                        <View className="h-[90%] bg-[#0B0F19] rounded-t-[32px] overflow-hidden relative shadow-2xl border-t border-white/10">
                            <View className="absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-6 pt-5 pb-2">
                                <View />
                                <TouchableOpacity onPress={closeProfile} className="w-9 h-9 bg-black/40 rounded-full items-center justify-center border border-white/10 backdrop-blur-md">
                                    <X color="white" size={18} />
                                </TouchableOpacity>
                            </View>

                            <FlatList
                                data={[selectedInfluencer]}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ paddingBottom: 100 }}
                                renderItem={({ item }) => {
                                    const instagram = item.social_accounts?.[0];
                                    const hasInstagram = !!instagram;
                                    const updateDate = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
                                    const isVerified = item.verification_status === 'verified';

                                    return (
                                        <View>
                                            {/* Header */}
                                            <View className="items-center pt-16 pb-6 px-6 bg-[#0F1119] border-b border-dashed border-white/5 relative">
                                                <LinearGradient colors={['rgba(168, 85, 247, 0.05)', 'transparent']} className="absolute inset-0" />

                                                <View className={`w-28 h-28 rounded-full border-4 items-center justify-center overflow-hidden bg-[#15171e] mb-4 shadow-xl ${item.spotlight_active ? 'border-purple-500 shadow-purple-500/20' : 'border-[#2A2D35]'}`}>
                                                    {item.avatar_url ? (
                                                        <Image source={{ uri: item.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                                    ) : (
                                                        <Text className="text-white text-3xl font-bold opacity-50">{item.username?.charAt(0).toUpperCase()}</Text>
                                                    )}
                                                </View>

                                                <View className="flex-row items-center space-x-2 mb-1">
                                                    <Text className="text-white text-2xl font-bold tracking-tight text-center">{item.full_name || item.username}</Text>
                                                    {isVerified && hasInstagram && <VerifiedBadge size={22} />}
                                                </View>
                                                <Text className="text-gray-400 text-sm font-medium mb-3">@{item.username}</Text>

                                                <View className="flex-row items-center space-x-2">
                                                    {item.displayCategory && (
                                                        <View className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                                            <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">{item.displayCategory}</Text>
                                                        </View>
                                                    )}
                                                    <View className="bg-white/5 px-3 py-1 rounded-full border border-white/10 flex-row items-center">
                                                        <MapPin size={10} color="#9ca3af" className="mr-1" />
                                                        <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">{item.city || 'Türkiye'}</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <View className="px-6 py-6">
                                                {/* Stats */}
                                                <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">PERFORMANS</Text>

                                                {hasInstagram ? (
                                                    <View className="flex-row space-x-3 mb-4">
                                                        <View className="flex-1 bg-[#15171e] rounded-2xl p-4 border border-white/5 relative overflow-hidden">
                                                            <LinearGradient colors={['rgba(255,255,255,0.03)', 'transparent']} className="absolute inset-0" />
                                                            <Text className="text-gray-400 text-[10px] uppercase font-bold mb-1">Takipçi</Text>
                                                            <Text className="text-white text-2xl font-black">
                                                                {instagram.follower_count > 1000 ? (instagram.follower_count / 1000).toFixed(1) + 'K' : instagram.follower_count}
                                                            </Text>
                                                        </View>
                                                        <View className="flex-1 bg-[#15171e] rounded-2xl p-4 border border-white/5 relative overflow-hidden">
                                                            <LinearGradient colors={['rgba(168, 85, 247, 0.05)', 'transparent']} className="absolute inset-0" />
                                                            <Text className="text-purple-400 text-[10px] uppercase font-bold mb-1">Etkileşim</Text>
                                                            <Text className="text-white text-2xl font-black">%{instagram.engagement_rate}</Text>
                                                        </View>
                                                    </View>
                                                ) : (
                                                    <View className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-4">
                                                        <Text className="text-red-200 text-xs font-medium">Veriler henüz doğrulanmadı.</Text>
                                                    </View>
                                                )}

                                                {/* AI Summary */}
                                                <View className="mb-8 mt-4">
                                                    <View className="flex-row items-center justify-between mb-3">
                                                        <View className="flex-row items-center">
                                                            <Sparkles color="#a855f7" size={14} className="mr-2" />
                                                            <Text className="text-white font-bold text-sm">Yapay Zeka Özeti</Text>
                                                        </View>
                                                        <View className="bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                                            <Text className="text-purple-300 text-[9px] font-bold">INFLU AI</Text>
                                                        </View>
                                                    </View>
                                                    <View className="bg-[#15171e] p-4 rounded-2xl border border-white/5">
                                                        <Text className="text-gray-300 text-xs leading-5 font-light">
                                                            Bu profil, özellikle <Text className="text-purple-300 font-bold">{item.displayCategory}</Text> alanında tutarlı bir büyüme sergiliyor.
                                                            {hasInstagram && instagram.engagement_rate > 3 && " Marka işbirlikleri için yüksek potansiyel."}
                                                        </Text>
                                                    </View>
                                                </View>

                                                {/* BADGES (Fetched Full List) */}
                                                <View className="mb-8">
                                                    <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">ROZETLER</Text>
                                                    <View className="flex-row flex-wrap">
                                                        {detailedBadges.length > 0 ? (
                                                            detailedBadges.map((badge, index) => (
                                                                <View key={index} className="bg-[#15171e] border border-white/5 px-3 py-2 rounded-xl mr-2 mb-2 flex-row items-center">
                                                                    <Award size={14} color="#D4AF37" className="mr-2" />
                                                                    <Text className="text-gray-300 text-[11px] font-medium">
                                                                        {BADGE_NAMES[badge] || badge.replace(/[-_]/g, ' ')}
                                                                    </Text>
                                                                </View>
                                                            ))
                                                        ) : (
                                                            <Text className="text-gray-600 text-xs italic ml-1">Henüz rozet kazanılmamış.</Text>
                                                        )}
                                                    </View>
                                                </View>

                                                {/* About */}
                                                <View className="mb-24">
                                                    <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">HAKKINDA</Text>
                                                    <Text className="text-gray-300 text-sm leading-6 font-light">
                                                        {item.bio || 'Merhaba! Influmatch topluluğunun bir parçasıyım.'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                }}
                            />

                            {currentUserRole === 'brand' && (
                                <View className="absolute bottom-0 left-0 right-0 p-6 bg-[#0B0F19] border-t border-white/5">
                                    <TouchableOpacity
                                        onPress={() => Alert.alert("Bilgi", "Mesajlaşma özelliği yakında aktif!")}
                                        className="w-full bg-soft-gold h-14 rounded-2xl items-center justify-center flex-row shadow-lg shadow-soft-gold/20"
                                    >
                                        <Text className="text-black font-extrabold text-base tracking-wide uppercase">İLETİŞİME GEÇ</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    );
}
