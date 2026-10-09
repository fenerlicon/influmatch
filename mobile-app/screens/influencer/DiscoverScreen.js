import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, ActivityIndicator, Modal, Dimensions, Alert, RefreshControl, ScrollView, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Sliders, BadgeCheck, Heart, MapPin, ChevronRight, ArrowLeft, X, Instagram, Music, Zap, BarChart3, Users, TrendingUp, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import { RATE_CARD_ITEMS, RATE_CARD_SELECT } from '../../constants/rateCard';
import { supabase } from '../../lib/supabase';
import { influencerCategoryLabel } from '../../constants/categories';
import { getThumbnailUrl } from '../../utils/image';
import { apiRequest } from '../../lib/api';
import DiscoveryWheelCard from '../../components/DiscoveryWheelCard';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48 - 12) / 2;

// Etiketler web listesinden (constants/categories.js).
const getCategoryLabel = (cat) => (cat ? influencerCategoryLabel(cat) : 'Genel');

const WavyBackground = () => (
    <View className="absolute top-[-50px] left-0 right-0 h-[200px] opacity-20">
        <Svg height="100%" width="100%" viewBox="0 0 1440 320">
            <Path
                fill="#ec4899"
                d="M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,133.3C672,117,768,139,864,165.3C960,192,1056,224,1152,218.7C1248,213,1344,171,1392,149.3L1440,128L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
            />
        </Svg>
    </View>
);

const InfluencerCard = memo(({ item, onPress, horizontal = false, canFavorite = false }) => {
    const isVerified = item.isVerified;
    const [isFav, setIsFav] = useState(item.isFavorited);
    
    const currentWidth = horizontal ? width * 0.45 : COLUMN_WIDTH;
    const cardHeight = horizontal ? 300 : (item.id.charCodeAt(0) % 2 === 0 ? 320 : 360);
    const firstName = (item.full_name || item.username || 'Influencer').split(' ')[0];

    const toggleFavorite = async (e) => {
        e.stopPropagation();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return Alert.alert('Hata', 'Favorilere eklemek için giriş yapmalısınız.');
            if (isFav) {
                const { error } = await supabase.from('favorites').delete().eq('brand_id', user.id).eq('influencer_id', item.id);
                if (error) throw error;
                setIsFav(false);
            } else {
                const { error } = await supabase.from('favorites').insert({ brand_id: user.id, influencer_id: item.id });
                if (error) throw error;
                setIsFav(true);
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Hata', 'Favoriler güncellenemedi.');
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => onPress(item)}
            style={{ width: currentWidth, marginBottom: 16 }}
            className={horizontal ? "mr-4" : ""}
        >
            <View style={{ height: cardHeight, width: currentWidth }} className="rounded-[32px] overflow-hidden bg-slate-900 border border-white/10 shadow-2xl">
                {item.avatar_url ? (
                    <Image source={{ uri: getThumbnailUrl(item.avatar_url) }} className="absolute inset-0 w-full h-full" resizeMode="cover" fadeDuration={0} />
                ) : (
                    <View className="absolute inset-0 items-center justify-center bg-slate-800">
                        <Text className="text-white/20 font-bold text-4xl">{item.username?.charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.9)']} className="absolute inset-0" />
                
                {/* Favorite */}
                {canFavorite && <TouchableOpacity onPress={toggleFavorite} className="z-50 absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 items-center justify-center border border-white/10 backdrop-blur-md">
                    <Heart color={isFav ? "#ef4444" : "white"} fill={isFav ? "#ef4444" : "transparent"} size={16} />
                </TouchableOpacity>}

                <View className="absolute bottom-5 left-5 right-5">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                        <Text className="text-white font-black text-xl tracking-tight" numberOfLines={1}>{firstName}</Text>
                        {isVerified && <BadgeCheck color="white" size={20} fill="#3b82f6" />}
                    </View>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-pink-500 text-[8px] font-black uppercase tracking-[3px]">
                            {getCategoryLabel(item.category).toUpperCase()}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const CategorySection = memo(({ title, data, onProfilePress, canFavorite }) => (
    <View className="mb-10">
        <View className="flex-row items-center justify-between px-6 mb-5">
            <Text className="text-white font-black text-xl tracking-tight uppercase" style={{ letterSpacing: 1 }}>
                {getCategoryLabel(title)}
            </Text>
        </View>
        <FlatList
            horizontal
            data={data}
            renderItem={({ item }) => <InfluencerCard item={item} onPress={() => onProfilePress(item)} horizontal={true} canFavorite={canFavorite} />}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 24 }}
            showsHorizontalScrollIndicator={false}
        />
    </View>
));

export default function DiscoverScreen({ navigation }) {
    const [sections, setSections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isBrand, setIsBrand] = useState(false);
    // Keşif çarkı (ücretsiz marka sınırları açıkken; web ile aynı kural, /api/mobile/discovery-wheel).
    // null: sınır yok, liste bugünkü gibi.
    const [wheel, setWheel] = useState(null);
    // Onaysız marka: web ile aynı kural, profil listelenmez.
    const [locked, setLocked] = useState(false);
    const [spinning, setSpinning] = useState(false);
    // Bütçe filtresi (yalnızca marka): girilince fiyat kartında en az bir başlangıç fiyatı bütçeye sığanlar kalır.
    // Fiyat kartlarını RLS yalnızca doğrulanmış markaya döndürür (web keşfiyle aynı kural).
    const [budgetInput, setBudgetInput] = useState('');
    const budget = Number(budgetInput) || 0;

    const fetchInfluencers = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const myId = user?.id;

            // Favoriler yalnızca markalar içindir (tablo brand_id ile tutulur).
            const { data: me } = myId
                ? await supabase.from('users').select('role').eq('id', myId).maybeSingle()
                : { data: null };
            const viewerIsBrand = me?.role === 'brand';
            setIsBrand(viewerIsBrand);

            // Liste web sunucusundan gelir (lib/profile-reads.ts; başka hesapların satırları istemciden okunamaz).
            // Onaysız marka profil görmez; ücretsiz markada (sınırlar açıkken) yalnızca güncel çarktaki profiller listelenir.
            const result = await apiRequest('discover');
            if (result.error) throw new Error(result.error);
            setLocked(!!result.locked);
            const limited = !!result.limited;
            setWheel(limited ? result : null);
            const users = result.profiles || [];

            const { data: myFavs } = viewerIsBrand ? await supabase
                .from('favorites')
                .select('influencer_id')
                .eq('brand_id', myId) : { data: [] };

            const favIds = new Set(myFavs?.map(f => f.influencer_id));

            const minPrices = new Map();
            if (viewerIsBrand && budget > 0) {
                const { data: cards } = await supabase.from('rate_cards').select(RATE_CARD_SELECT).limit(1000);
                (cards || []).forEach((card) => {
                    const values = RATE_CARD_ITEMS.map((item) => card[item.column]).filter((v) => typeof v === 'number' && v > 0);
                    if (values.length) minPrices.set(card.user_id, Math.min(...values));
                });
            }

            const usersWithStats = users.map(u => {
                const isVerified = Array.isArray(u.displayed_badges) && u.displayed_badges.includes('verified-account');
                
                return {
                    ...u,
                    isVerified,
                    isFavorited: favIds.has(u.id)
                }
            });

            // Client-side search filter
            const searched = searchQuery 
                ? usersWithStats.filter(u => 
                    (u.full_name || u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (u.category || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : usersWithStats;
            const filtered = viewerIsBrand && budget > 0
                ? searched.filter((u) => minPrices.has(u.id) && minPrices.get(u.id) <= budget)
                : searched;

            // Group by Categories
            const spotlight = filtered.filter(u => u.spotlight_active);
            const others = filtered.filter(u => !u.spotlight_active);
            
            const categoryGroups = others.reduce((acc, user) => {
                const cat = user.category || 'Lifestyle';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(user);
                return acc;
            }, {});

            const results = [];
            if (limited) {
                if (filtered.length > 0) results.push({ title: 'Çarktaki profiller', data: filtered });
                setSections(results);
                return;
            }
            if (spotlight.length > 0) results.push({ title: 'Featured', data: spotlight });
            
            Object.keys(categoryGroups).forEach(cat => {
                results.push({ title: cat, data: categoryGroups[cat] });
            });

            setSections(results);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchInfluencers(); }, [searchQuery, budget]);

    const spinWheel = async () => {
        setSpinning(true);
        const result = await apiRequest('discovery-wheel', { method: 'POST' });
        setSpinning(false);
        if (result.error) {
            Alert.alert('Çark çevrilemedi', result.error);
            return;
        }
        await fetchInfluencers();
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchInfluencers();
        setRefreshing(false);
    }, []);

    return (
        <View className="flex-1 bg-black">
            <StatusBar style="light" />
            <WavyBackground />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pt-6 pb-2">
                    <Text className="text-orange-200 text-3xl font-black leading-[42px] mb-8 w-[90%] tracking-tighter">
                        Best Influencers for your marketing campaigns
                    </Text>

                    {/* Search Section */}
                    <View className="flex-row items-center gap-2 mb-8">
                        <View className="flex-1 bg-white/10 rounded-[24px] h-14 flex-row items-center px-4 border border-white/5 backdrop-blur-xl">
                            <Search color="#64748b" size={20} />
                            <TextInput
                                placeholder="Influencer Ara"
                                placeholderTextColor="#475569"
                                className="flex-1 ml-3 text-white font-bold text-sm"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                        </View>
                        <TouchableOpacity className="w-14 h-14 rounded-[24px] bg-white/10 items-center justify-center border border-white/5 backdrop-blur-xl">
                            <Sliders color="white" size={20} />
                        </TouchableOpacity>
                    </View>
                    {isBrand && (
                        <View className="bg-white/10 rounded-[20px] h-12 flex-row items-center px-4 border border-white/5 -mt-4 mb-6">
                            <Text className="text-gray-400 text-xs font-bold mr-2">Bütçem ₺</Text>
                            <TextInput
                                placeholder="Örn. 5000"
                                placeholderTextColor="#475569"
                                keyboardType="number-pad"
                                maxLength={8}
                                className="flex-1 text-white font-bold text-sm"
                                value={budgetInput}
                                onChangeText={(v) => setBudgetInput(v.replace(/[^0-9]/g, ''))}
                            />
                        </View>
                    )}
                </View>

                {!loading && wheel && (
                    <View className="px-6 mb-4">
                        <DiscoveryWheelCard
                            profilesPerSpin={wheel.profilesPerSpin}
                            windowHours={wheel.windowHours}
                            expiresAt={wheel.spin?.expires_at || null}
                            spinning={spinning}
                            onSpin={spinWheel}
                        />
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator color="#ec4899" className="mt-10" />
                ) : (
                    <FlatList
                        data={sections}
                        keyExtractor={item => item.title}
                        renderItem={({ item }) => (
                            <CategorySection 
                                title={item.title} 
                                data={item.data} 
                                canFavorite={isBrand}
                                onProfilePress={(inf) => navigation.navigate('InfluencerDetail', { influencer: inf })} 
                            />
                        )}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
                        ListEmptyComponent={locked
                            ? <Text className="text-gray-400 text-center mt-10 px-8">Profilleri görebilmek için hesabınızın onaylanması gerekmektedir.</Text>
                            : wheel && !wheel.spin ? null : <Text className="text-gray-600 text-center mt-10">Hiçbir influencer bulunamadı.</Text>}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}
