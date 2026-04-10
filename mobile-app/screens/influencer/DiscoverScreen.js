import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, TextInput, ActivityIndicator, Modal, Dimensions, Alert, RefreshControl, ScrollView, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Sliders, BadgeCheck, Heart, MapPin, ChevronRight, ArrowLeft, X, Instagram, Music, Zap, BarChart3, Users, TrendingUp, ShieldCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { getThumbnailUrl } from '../../utils/image';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48 - 12) / 2;

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

const MiniMetric = ({ icon: Icon, value, label, color = '#fbbf24' }) => (
    <View className="flex-1 bg-white/5 rounded-2xl p-2 border border-white/5 items-center justify-center">
        <Icon color={color} size={10} />
        <Text className="text-white font-black text-[9px] mt-1">{value}</Text>
        <Text className="text-white/30 text-[7px] uppercase font-bold tracking-tighter">{label}</Text>
    </View>
);

const MiniBadge = ({ text, color = '#3b82f6' }) => (
    <View className="mr-1.5 mb-1.5 px-2 py-0.5 rounded-md border border-white/10 bg-white/5 flex-row items-center">
        <View className="w-1 h-1 rounded-full mr-1" style={{ backgroundColor: color }} />
        <Text className="text-white text-[7px] font-black uppercase tracking-widest">{text}</Text>
    </View>
);

const InfluencerCard = memo(({ item, onPress, horizontal = false }) => {
    const isVerified = item.isVerified;
    const [isFav, setIsFav] = useState(item.isFavorited);
    
    const currentWidth = horizontal ? width * 0.45 : COLUMN_WIDTH;
    const cardHeight = horizontal ? 300 : (item.id.charCodeAt(0) % 2 === 0 ? 320 : 360);
    const firstName = (item.full_name || item.username || 'Influencer').split(' ')[0];
    const trustScore = Math.floor(75 + (item.id.charCodeAt(0) % 22));

    const toggleFavorite = async (e) => {
        e.stopPropagation();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return Alert.alert('Hata', 'Favorilere eklemek için giriş yapmalısınız.');
            if (isFav) {
                await supabase.from('favorites').delete().eq('user_id', user.id).eq('influencer_id', item.id);
                setIsFav(false);
            } else {
                await supabase.from('favorites').insert({ user_id: user.id, influencer_id: item.id });
                setIsFav(true);
            }
        } catch (err) { console.error(err); }
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
                <TouchableOpacity onPress={toggleFavorite} className="z-50 absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 items-center justify-center border border-white/10 backdrop-blur-md">
                    <Heart color={isFav ? "#ef4444" : "white"} fill={isFav ? "#ef4444" : "transparent"} size={16} />
                </TouchableOpacity>

                <View className="absolute bottom-5 left-5 right-5">
                    <View className="flex-row items-center gap-1.5 mb-1.5">
                        <Text className="text-white font-black text-xl tracking-tight" numberOfLines={1}>{firstName}</Text>
                        {isVerified && <BadgeCheck color="white" size={20} fill="#3b82f6" />}
                    </View>
                    <View className="flex-row items-center gap-2">
                        <Text className="text-pink-500 text-[8px] font-black uppercase tracking-[3px]">
                            {item.category?.toUpperCase() || 'MODA'}
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const CategorySection = memo(({ title, data, onProfilePress }) => (
    <View className="mb-10">
        <View className="flex-row items-center justify-between px-6 mb-5">
            <Text className="text-white font-black text-xl tracking-tight uppercase" style={{ letterSpacing: 1 }}>
                {title === 'Featured' ? 'Öne Çıkanlar' : title}
            </Text>
            <TouchableOpacity className="bg-white/5 px-4 py-2 rounded-full border border-white/10">
                <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Tümünü Gör</Text>
            </TouchableOpacity>
        </View>
        <FlatList
            horizontal
            data={data}
            renderItem={({ item }) => <InfluencerCard item={item} onPress={() => onProfilePress(item)} horizontal={true} />}
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

    const fetchInfluencers = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const myId = user?.id;

            const { data: users, error } = await supabase
                .from('users')
                .select('id, full_name, username, avatar_url, category, bio, spotlight_active, verification_status, is_showcase_visible, displayed_badges')
                .eq('role', 'influencer')
                .eq('verification_status', 'verified')
                .eq('is_showcase_visible', true);
            
            if (error) throw error;

            // Fetch Real Stats (Instagram)
            const { data: socialAccounts } = await supabase
                .from('social_accounts')
                .select('user_id, platform, follower_count, engagement_rate, stats_payload')
                .in('user_id', users.map(u => u.id));

            // Fetch Favorites
            const { data: myFavs } = myId ? await supabase
                .from('favorites')
                .select('influencer_id')
                .eq('user_id', myId) : { data: [] };

            const favIds = new Set(myFavs?.map(f => f.influencer_id));

            const usersWithStats = users.map(u => {
                const ig = socialAccounts?.find(s => s.user_id === u.id && s.platform === 'instagram');
                const tt = socialAccounts?.find(s => s.user_id === u.id && s.platform === 'tiktok');
                const isVerified = Array.isArray(u.displayed_badges) && u.displayed_badges.includes('verified-account');
                
                return {
                    ...u,
                    isVerified,
                    instagram: ig,
                    tiktok: tt,
                    isFavorited: favIds.has(u.id)
                }
            });

            // Client-side search filter
            const filtered = searchQuery 
                ? usersWithStats.filter(u => 
                    (u.full_name || u.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (u.category || '').toLowerCase().includes(searchQuery.toLowerCase())
                  )
                : usersWithStats;

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

    useEffect(() => { fetchInfluencers(); }, [searchQuery]);

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
                                placeholder="Search Influencer"
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
                </View>

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
                                onProfilePress={(inf) => navigation.navigate('InfluencerDetail', { influencer: inf })} 
                            />
                        )}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
                        ListEmptyComponent={<Text className="text-gray-600 text-center mt-10">No influencers found.</Text>}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}
