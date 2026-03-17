import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MapPin, Sparkles, Award, Star, MessageCircle, X, ShieldCheck } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const BADGE_NAMES = {
    'verified-account': 'Doğrulanmış Hesap',
    'top-performer': 'Yüksek Performans',
    'fast-responder': 'Hızlı Yanıt',
    'creative-expert': 'Yaratıcı Uzman',
    'loyal-partner': 'Sadık İş Ortağı',
    'premium-content': 'Premium İçerik'
};

const VerifiedBadge = ({ size = 16 }) => (
    <View className="bg-blue-500 rounded-full items-center justify-center border-2 border-[#0B0F19]" style={{ width: size, height: size }}>
        <ShieldCheck color="white" size={size * 0.6} />
    </View>
);

export default function InfluencerDetailScreen({ navigation, route }) {
    const { influencer: initialInfluencer } = route.params;
    const [selectedInfluencer, setSelectedInfluencer] = useState(initialInfluencer);
    const [detailedBadges, setDetailedBadges] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentUserRole, setCurrentUserRole] = useState(null);

    const fetchUserBadges = async (userId) => {
        try {
            const { data } = await supabase
                .from('user_badges')
                .select('badge_id')
                .eq('user_id', userId);

            if (data) {
                setDetailedBadges(data.map(b => b.badge_id));
            }
        } catch (error) {
            console.error('Error fetching badges:', error);
        }
    };

    const checkUserRole = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
            setCurrentUserRole(data?.role);
        }
    };

    useEffect(() => {
        if (selectedInfluencer?.id) {
            fetchUserBadges(selectedInfluencer.id);
            checkUserRole();
        }
    }, [selectedInfluencer]);

    const startConversation = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let { data: existingRoom } = await supabase
                .from('rooms')
                .select('id')
                .eq('brand_id', user.id)
                .eq('influencer_id', selectedInfluencer.id)
                .maybeSingle();

            if (!existingRoom) {
                const { data: newRoom, error } = await supabase
                    .from('rooms')
                    .insert({ brand_id: user.id, influencer_id: selectedInfluencer.id })
                    .select('id')
                    .single();
                if (error) throw error;
                existingRoom = newRoom;
            }

            navigation.navigate('Mesajlar', {
                openRoomId: existingRoom.id,
                partnerName: selectedInfluencer.full_name || selectedInfluencer.username,
                partnerAvatar: selectedInfluencer.avatar_url
            });
        } catch (e) {
            Alert.alert('Hata', 'Mesajlaşma başlatılamadı: ' + (e.message || ''));
        }
    }, [navigation, selectedInfluencer]);

    if (!selectedInfluencer) return null;

    const instagram = selectedInfluencer.social_accounts?.[0];
    const hasInstagram = !!instagram;
    const isVerified = selectedInfluencer.verification_status === 'verified';

    return (
        <View className="flex-1 bg-[#0B0F19]">
            <StatusBar style="light" />

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* Header / Avatar Area */}
                <View className="items-center pt-20 pb-8 px-6 bg-[#0F1119] border-b border-dashed border-white/5 relative">
                    <LinearGradient colors={['rgba(168, 85, 247, 0.08)', 'transparent']} className="absolute inset-0" />

                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="absolute top-12 left-6 w-10 h-10 bg-white/5 rounded-2xl items-center justify-center border border-white/10 z-50"
                    >
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>

                    <View className={`w-28 h-28 rounded-full border-4 items-center justify-center overflow-hidden bg-[#15171e] mb-4 shadow-xl ${selectedInfluencer.spotlight_active ? 'border-purple-500 shadow-purple-500/30' : 'border-[#2A2D35]'}`}>
                        {selectedInfluencer.avatar_url ? (
                            <Image source={{ uri: selectedInfluencer.avatar_url }} className="w-full h-full" resizeMode="cover" />
                        ) : (
                            <Text className="text-white text-3xl font-bold opacity-50">{selectedInfluencer.username?.charAt(0).toUpperCase()}</Text>
                        )}
                    </View>

                    <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-white text-2xl font-bold tracking-tight text-center">{selectedInfluencer.full_name || selectedInfluencer.username}</Text>
                        {isVerified && <VerifiedBadge size={22} />}
                    </View>
                    <Text className="text-gray-400 text-sm font-medium mb-4">@{selectedInfluencer.username}</Text>

                    <View className="flex-row items-center gap-2">
                        {selectedInfluencer.displayCategory && (
                            <View className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">{selectedInfluencer.displayCategory}</Text>
                            </View>
                        )}
                        <View className="bg-white/5 px-3 py-1 rounded-full border border-white/10 flex-row items-center">
                            <MapPin size={10} color="#9ca3af" style={{ marginRight: 4 }} />
                            <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">{selectedInfluencer.city || 'Türkiye'}</Text>
                        </View>
                    </View>
                </View>

                {/* Content */}
                <View className="px-6 py-6">
                    {/* Stats */}
                    <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">PERFORMANS</Text>
                    {hasInstagram ? (
                        <View className="flex-row gap-3 mb-6">
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
                        <View className="w-full bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-6">
                            <Text className="text-red-200 text-xs font-medium">Veriler henüz doğrulanmadı.</Text>
                        </View>
                    )}

                    {/* AI Summary */}
                    <View className="mb-8">
                        <View className="flex-row items-center justify-between mb-3">
                            <View className="flex-row items-center gap-2">
                                <Sparkles color="#a855f7" size={14} />
                                <Text className="text-white font-bold text-sm">Yapay Zeka Özeti</Text>
                            </View>
                            <View className="bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                                <Text className="text-purple-300 text-[9px] font-bold">INFLU AI</Text>
                            </View>
                        </View>
                        <View className="bg-[#15171e] p-4 rounded-2xl border border-white/5">
                            <Text className="text-gray-300 text-xs leading-5 font-light">
                                Bu profil, özellikle <Text className="text-purple-300 font-bold">{selectedInfluencer.displayCategory || 'Lifestyle'}</Text> alanında tutarlı bir büyüme sergiliyor.
                                {hasInstagram && instagram.engagement_rate > 3 && " Marka işbirlikleri için yüksek potansiyel."}
                            </Text>
                        </View>
                    </View>

                    {/* Badges */}
                    <View className="mb-8">
                        <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">ROZETLER</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {detailedBadges.length > 0 ? (
                                detailedBadges.map((badge, index) => (
                                    <View key={index} className="bg-[#15171e] border border-white/5 px-3 py-2 rounded-xl flex-row items-center gap-2">
                                        <Award size={14} color="#D4AF37" />
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
                    <View className="mb-10">
                        <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-3 ml-1">HAKKINDA</Text>
                        <Text className="text-gray-300 text-sm leading-6 font-light">
                            {selectedInfluencer.bio || 'Merhaba! Influmatch topluluğunun bir parçasıyım.'}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Action */}
            {currentUserRole === 'brand' && (
                <View className="absolute bottom-0 left-0 right-0 p-6 bg-[#0B0F19] border-t border-white/5">
                    <TouchableOpacity
                        onPress={startConversation}
                        className="w-full bg-soft-gold h-14 rounded-2xl items-center justify-center flex-row shadow-lg shadow-soft-gold/20"
                    >
                        <MessageCircle color="black" size={20} style={{ marginRight: 8 }} />
                        <Text className="text-black font-extrabold text-base tracking-wide uppercase">İLETİŞİME GEÇ</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}
