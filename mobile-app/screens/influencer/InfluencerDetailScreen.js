import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Dimensions, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, BadgeCheck, MapPin, TrendingUp, Zap, Briefcase, Star, Award, Instagram, Music, Sparkles, Users, Heart, MessageCircle, Activity } from 'lucide-react-native';
import { Svg, Path } from 'react-native-svg';
import { supabase } from '../../lib/supabase';
import { getThumbnailUrl, getLargeUrl } from '../../utils/image';

const { width } = Dimensions.get('window');

const Crown = ({ color, size }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <Path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7Z" />
        <Path d="M12 17H12" />
    </Svg>
);

const AchievementCard = ({ title, description, color = '#fbbf24', icon: Icon = Award }) => (
    <View className="bg-white/5 rounded-[24px] p-5 mb-4 border border-white/10 flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-full items-center justify-center shadow-lg" style={{ backgroundColor: `${color}20` }}>
                <Icon color={color} size={24} />
            </View>
            <View className="flex-1 w-[200px]">
                <Text className="text-white font-black text-base">{title}</Text>
                <Text className="text-white/40 text-[10px] leading-4 mt-1">{description}</Text>
            </View>
        </View>
    </View>
);

const RealMetric = ({ title, value, color = '#fbbf24', icon: Icon = Zap }) => (
    <View className="w-[48%] bg-white/5 rounded-[24px] p-4 border border-white/10 flex-col py-5 shadow-sm">
        <View className="flex-row items-center gap-2">
            <Icon color="#fbbf24" size={14} className="opacity-80" />
            <Text className="text-white/40 text-[8px] font-black tracking-[2px] uppercase">{title}</Text>
        </View>
        <Text className="text-white font-black text-xl mt-1 tracking-tight">{value}</Text>
    </View>
);

export default function InfluencerDetailScreen({ navigation, route }) {
    const { influencer } = route.params;
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('instagram');

    const resolveAvatar = (url) => {
        if (!url) return null;
        if (url.startsWith('http')) return url;
        const cleanPath = url.replace('influencer-avatars/', '');
        return `https://aiftdpagcnwqzzemtkwt.supabase.co/storage/v1/object/public/influencer-avatars/${cleanPath}`;
    };

    const badgeMap = {
        'verified': { title: 'Onaylı Hesap', desc: 'Kimliği doğrulanmış influencer hesabı.', color: '#3b82f6', icon: BadgeCheck },
        'verified_account': { title: 'Onaylı Hesap', desc: 'Kimliği doğrulanmış influencer hesabı.', color: '#3b82f6', icon: BadgeCheck },
        'high_engagement': { title: 'Yüksek Etkileşim', desc: 'Kitle bağları oldukça güçlüdür.', color: '#10b981', icon: Zap },
        'fast_growth': { title: 'Hızlı Büyüme', desc: 'Takipçi ivmesi hızla yükselmektedir.', color: '#f59e0b', icon: TrendingUp },
        'premium': { title: 'Kurucu Üye', desc: 'Platformun ilk üyelerinden.', color: '#fbbf24', icon: Crown },
        'top_creator': { title: 'En İyi Kreatör', desc: 'Üst düzey içerik kalitesine sahiptir.', color: '#ec4899', icon: Star },
        'elite': { title: 'Elite Üye', desc: 'En seçkin kitle üyelerimizden biri.', color: '#a855f7', icon: Award }
    };

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
                setCurrentUserRole(data?.role);
            }
        };
        checkRole();
    }, []);

    const startConversation = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return Alert.alert('Hata', 'İletişime geçmek için giriş yapmalısınız.');
            let { data: existingRoom } = await supabase.from('rooms').select('id').eq('brand_id', user.id).eq('influencer_id', influencer.id).maybeSingle();
            if (!existingRoom) {
                const { data: newRoom, error } = await supabase.from('rooms').insert({ brand_id: user.id, influencer_id: influencer.id }).select('id').single();
                if (error) throw error;
                existingRoom = newRoom;
            }
            navigation.navigate('Mesajlar', { openRoomId: existingRoom.id, partnerName: influencer.full_name || influencer.username, partnerAvatar: influencer.avatar_url });
        } catch (e) {
            Alert.alert('Hata', 'Mesajlaşma başlatılamadı');
        }
    }, [navigation, influencer]);

    const formatFollowers = (count) => {
        if (!count) return '-';
        if (count >= 1000000) return (count / 1000000).toFixed(1).replace('.', ',') + 'M';
        if (count >= 1000) {
            const k = (count / 1000).toFixed(1);
            return k.replace('.', ',') + 'K';
        }
        return count;
    };

    const currentStats = selectedPlatform === 'instagram' ? influencer.instagram : influencer.tiktok;

    return (
        <View className="flex-1 bg-[#010204]">
            <StatusBar style="light" />
            
            <ScrollView 
                className="flex-1" 
                showsVerticalScrollIndicator={true} 
                contentContainerStyle={{ paddingBottom: 40, paddingTop: 60 }}
            >
                <View className="px-6 mb-6">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 bg-white/5 rounded-[18px] items-center justify-center border border-white/10 backdrop-blur-md">
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                </View>

                <View className="px-6 mb-8">
                    <View className="bg-[#0f1118] rounded-[32px] p-6 border border-white/10 relative overflow-hidden shadow-2xl">
                        <View className="flex-row items-center gap-5">
                            <View className="w-16 h-16 rounded-[20px] overflow-hidden border border-white/10 bg-slate-900 shadow-xl">
                                {resolveAvatar(influencer.avatar_url) ? (
                                    <Image 
                                        key={`profile-${influencer.id}`}
                                        source={{ uri: getThumbnailUrl(resolveAvatar(influencer.avatar_url)) }} 
                                        className="w-full h-full" 
                                        resizeMode="cover" 
                                        fadeDuration={0}
                                    />
                                ) : (
                                    <View className="w-full h-full items-center justify-center">
                                        <Text className="text-white/20 text-3xl font-black">{influencer.username?.charAt(0)}</Text>
                                    </View>
                                )}
                            </View>

                            <View className="flex-1">
                                <View className="flex-row items-center gap-2 mb-1">
                                    <Text className="text-[8px] font-black text-amber-500 uppercase tracking-[2px]">INFLUENCER</Text>
                                    <View className="px-2 py-0.5 bg-white/5 rounded-md border border-white/10">
                                        <Text className="text-white/40 text-[7px] font-black uppercase text-center">{influencer.category || 'Yaşam Tarzı'}</Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center gap-1.5 mb-1">
                                    <Text className="text-white text-lg font-black tracking-tight flex-1" numberOfLines={1}>
                                        {influencer.full_name || influencer.username}
                                    </Text>
                                    {influencer.isVerified && <BadgeCheck color="#3b82f6" size={16} fill="#3b82f620" />}
                                </View>
                                <Text className="text-white/30 text-[10px] font-semibold">@{influencer.username || 'user'}</Text>
                            </View>
                        </View>

                        <View className="mt-6 pt-6 border-t border-white/5">
                            <Text className="text-white/50 text-[11px] leading-5 font-medium mb-5">
                                {influencer.bio || "İşbirlikleri ve profesyonel içerik üretimi için hazır."}
                            </Text>
                            <View className="flex-row items-center gap-2 self-start bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 justify-center">
                                <MapPin color="#fbbf24" size={12} fill="#fbbf2420" />
                                <Text className="text-white/80 text-[10px] font-black text-center uppercase">{influencer.city || 'ANKARA'}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                <View className="px-6 mb-8">
                    <View className="bg-[#0f1118] rounded-[24px] p-1.5 flex-row border border-white/5">
                        <TouchableOpacity 
                            onPress={() => setSelectedPlatform('instagram')}
                            activeOpacity={0.8}
                            className={`flex-1 h-12 flex-row items-center justify-center rounded-[20px] gap-2 ${selectedPlatform === 'instagram' ? 'bg-[#fbbf24] shadow-xl shadow-amber-500/30' : ''}`}
                        >
                            <Instagram color={selectedPlatform === 'instagram' ? 'black' : '#64748b'} size={15} />
                            <Text className={`text-[10px] font-black uppercase tracking-widest text-center ${selectedPlatform === 'instagram' ? 'text-black' : 'text-gray-500'}`}>Instagram</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => setSelectedPlatform('tiktok')}
                            activeOpacity={0.8}
                            className={`flex-1 h-12 flex-row items-center justify-center rounded-[20px] gap-2 ${selectedPlatform === 'tiktok' ? 'bg-[#fbbf24] shadow-xl shadow-amber-500/30' : ''}`}
                        >
                            <Music color={selectedPlatform === 'tiktok' ? 'black' : '#64748b'} size={15} />
                            <Text className={`text-[10px] font-black uppercase tracking-widest text-center ${selectedPlatform === 'tiktok' ? 'text-black' : 'text-gray-500'}`}>TikTok</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="px-6 flex-row flex-wrap justify-between mb-8">
                    <RealMetric title="TAKİPÇİ" value={formatFollowers(currentStats?.follower_count)} icon={Users} />
                    <RealMetric title="ETKİLEŞİM" value={currentStats?.engagement_rate ? `%${currentStats.engagement_rate}` : '-'} icon={TrendingUp} />
                    <View style={{ width: '100%', height: 12 }} />
                    <RealMetric title="ORT. BEĞENİ" value={formatFollowers(currentStats?.stats_payload?.avg_likes)} icon={Heart} />
                    <RealMetric title="ORT. YORUM" value={formatFollowers(currentStats?.stats_payload?.avg_comments)} icon={MessageCircle} />
                    <View style={{ width: '100%', height: 12 }} />
                    <RealMetric title="ORT. İZLENME" value={formatFollowers(currentStats?.stats_payload?.avg_views)} icon={Zap} />
                    <RealMetric title="PAYLAŞIM SIKLIĞI" value={currentStats?.stats_payload?.posting_frequency_per_week ? `${(7 / currentStats.stats_payload.posting_frequency_per_week).toFixed(0)} günde bir` : '-'} icon={Activity} />
                </View>

                <View className="px-6 mb-12">
                    <View className="bg-[#0f1118] rounded-[32px] p-6 border border-white/10 shadow-lg">
                        <View className="flex-row items-center gap-3 mb-6">
                            <View className="w-10 h-10 bg-amber-400 rounded-2xl items-center justify-center">
                                <Zap color="black" size={20} fill="black" />
                            </View>
                            <View className="flex-row items-center gap-2">
                                <Text className="text-white font-black text-lg tracking-tight">Detaylı Profil Analizi</Text>
                                <View className="bg-amber-400/20 px-1.5 py-0.5 rounded-md">
                                    <Text className="text-amber-400 text-[8px] font-black uppercase">BETA</Text>
                                </View>
                            </View>
                        </View>

                        {[
                            selectedPlatform === 'instagram' ? "Gelişmekte olan bir etkileşim grafiği var." : "TikTok verileri manuel inceleme aşamasında.",
                            selectedPlatform === 'instagram' ? "Niş kitlelere hitap eden Micro Influencer." : "Kitle trendleri analiz ediliyor.",
                            selectedPlatform === 'instagram' ? "Takipçileriyle güçlü bir iletişimi var." : "Video performansları inceleniyor."
                        ].map((insight, idx) => (
                            <View key={idx} className="bg-white/5 rounded-2xl p-4 flex-row items-center gap-3 border border-white/5 mb-3">
                                <TrendingUp color="#fbbf24" size={14} />
                                <Text className="text-white/80 text-[11px] font-semibold">{insight}</Text>
                            </View>
                        ))}
                        
                        <Text className="text-white/20 text-[8px] italic mt-2">* Bu analiz Influmatch Akıllı Algoritması tarafından oluşturulmuştur. Kesin yatırım tavsiyesi değildir.</Text>
                    </View>
                </View>

                <View className="px-6 mb-12">
                    <Text className="text-white font-black text-xl tracking-tight uppercase mb-6">Rozetler</Text>
                    <View className="bg-[#0f1118] rounded-[32px] p-6 border border-white/10 shadow-lg">
                        <Text className="text-amber-500 text-[10px] font-black tracking-[4px] uppercase mb-6 text-center">ROZETLER</Text>
                        {influencer.displayed_badges && influencer.displayed_badges.length > 0 ? (
                            influencer.displayed_badges.map((bId) => {
                                const badge = badgeMap[bId] || { title: bId, desc: 'Sistem ödül rozeti.', color: '#64748b', icon: Award };
                                return <AchievementCard key={bId} title={badge.title} description={badge.desc} color={badge.color} icon={badge.icon} />;
                            })
                        ) : (
                            <Text className="text-white/20 text-xs italic text-center">Henüz rozet kazanılmamış.</Text>
                        )}
                    </View>
                </View>

                {currentUserRole === 'brand' && (
                    <View className="px-6 mb-12">
                        <View className="bg-[#0f1118] rounded-[32px] p-6 border border-white/10 items-center justify-center shadow-lg">
                            <Text className="text-white font-black text-lg mb-1">İş Birliği Yap</Text>
                            <Text className="text-white/40 text-[10px] mb-6">Bu influencer ile çalışmak için teklif gönder.</Text>
                            <TouchableOpacity 
                                onPress={startConversation}
                                activeOpacity={0.8}
                                className="w-full h-15 bg-amber-400 rounded-2xl items-center justify-center flex-row shadow-2xl shadow-amber-400/50"
                            >
                                <Text className="text-black font-black text-base tracking-tight">Teklif Gönder</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
