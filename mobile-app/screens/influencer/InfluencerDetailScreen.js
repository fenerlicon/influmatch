import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, BadgeCheck, MapPin, TrendingUp, Zap, Award, Instagram, Music, Users, Heart, MessageCircle, Activity, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { getThumbnailUrl } from '../../utils/image';
import { apiRequest } from '../../lib/api';
import { influencerBadges } from '../../constants/badges';
import { influencerCategoryLabel } from '../../constants/categories';
import { RATE_CARD_ITEMS, RATE_CARD_SELECT, formatTry } from '../../constants/rateCard';

const BADGES_BY_ID = Object.fromEntries(influencerBadges.map((b) => [b.id, b]));

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

    // Avatar adresi tam URL olarak saklanır (avatars kovası).
    const resolveAvatar = (url) => (url && url.startsWith('http') ? url : null);

    // Teklif formu (yalnızca onaylı markalar; kurallar sunucuda, lib/offers.ts)
    const [offerVisible, setOfferVisible] = useState(false);
    const [sending, setSending] = useState(false);
    const [existingRoomId, setExistingRoomId] = useState(null);
    // Tamamlanan iş birliği sayısı herkese açık; fiyat kartını RLS yalnızca doğrulanmış markaya ve sahibine döndürür.
    const [completedCount, setCompletedCount] = useState(0);
    const [rateCard, setRateCard] = useState(null);
    const [form, setForm] = useState({ campaignName: '', campaignType: '', paymentType: 'cash', budget: '', message: '' });

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
                setCurrentUserRole(data?.role);
                if (data?.role === 'brand') {
                    // Bu influencer ile teklif veya başvuru üzerinden açılmış bir sohbet varsa gösterilir.
                    const { data: rooms } = await supabase.from('rooms').select('id').eq('brand_id', user.id).eq('influencer_id', influencer.id).limit(1);
                    setExistingRoomId(rooms?.[0]?.id ?? null);
                }
            }
        };
        const loadTrust = async () => {
            const [{ data: counts }, { data: card }] = await Promise.all([
                supabase.rpc('completed_collaboration_counts', { p_user_ids: [influencer.id] }),
                supabase.from('rate_cards').select(RATE_CARD_SELECT).eq('user_id', influencer.id).maybeSingle(),
            ]);
            setCompletedCount(counts?.[0]?.completed_count ?? 0);
            setRateCard(card || null);
        };
        checkRole();
        loadTrust();
    }, []);

    const openChat = useCallback(() => {
        if (!existingRoomId) return;
        navigation.navigate('BrandDashboard', {
            screen: 'Mesajlar',
            params: { openRoomId: existingRoomId, partnerName: influencer.full_name || influencer.username, partnerAvatar: influencer.avatar_url },
        });
    }, [navigation, influencer, existingRoomId]);

    // Sohbet yalnızca teklif veya başvuru üzerinden açılır (web ile aynı kural); burada teklif gönderilir.
    const sendOffer = async () => {
        if (!form.campaignName.trim()) {
            Alert.alert('Eksik bilgi', 'Kampanya adını yazın.');
            return;
        }
        setSending(true);
        const result = await apiRequest('offers', { method: 'POST', body: { receiverId: influencer.id, ...form } });
        setSending(false);
        if (result.error) {
            Alert.alert('Teklif gönderilemedi', result.error);
            return;
        }
        setOfferVisible(false);
        setForm({ campaignName: '', campaignType: '', paymentType: 'cash', budget: '', message: '' });
        Alert.alert('Teklif gönderildi', 'Influencer yanıt verdiğinde bildirim alacaksınız.', [
            { text: 'Tamam' },
            { text: 'Tekliflerim', onPress: () => navigation.navigate('BrandDashboard', { screen: 'Teklifler' }) },
        ]);
    };

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
                                        <Text className="text-white/40 text-[7px] font-black uppercase text-center">{influencerCategoryLabel(influencer.category) || '-'}</Text>
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
                                {influencer.bio || ''}
                            </Text>
                            <View className="flex-row items-center gap-2 self-start bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 mb-3">
                                <Text className="text-white font-black text-[11px]">{completedCount}</Text>
                                <Text className="text-white/60 text-[10px] font-semibold">tamamlanan iş birliği</Text>
                            </View>
                            {influencer.city ? (
                                <View className="flex-row items-center gap-2 self-start bg-white/5 px-4 py-1.5 rounded-xl border border-white/10 justify-center">
                                    <MapPin color="#fbbf24" size={12} fill="#fbbf2420" />
                                    <Text className="text-white/80 text-[10px] font-black text-center uppercase">{influencer.city}</Text>
                                </View>
                            ) : null}
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

                {rateCard && RATE_CARD_ITEMS.some((item) => rateCard[item.column]) ? (
                    <View className="px-6 mb-8">
                        <View className="bg-[#0f1118] rounded-[32px] p-6 border border-white/10">
                            <Text className="text-amber-500 text-[10px] font-black tracking-[4px] uppercase">FİYAT KARTI</Text>
                            <Text className="text-white/40 text-[10px] mt-1 mb-4">Teslimat başına başlangıç fiyatları</Text>
                            {RATE_CARD_ITEMS.filter((item) => rateCard[item.column]).map((item) => (
                                <View key={item.key} className="flex-row justify-between items-center py-2.5 border-b border-white/5">
                                    <Text className="text-white/80 text-sm font-semibold">{item.label}</Text>
                                    <Text className="text-white text-sm font-black">{formatTry(rateCard[item.column])}+</Text>
                                </View>
                            ))}
                            {rateCard.negotiable ? <Text className="text-emerald-400 text-xs mt-3">Pazarlığa açık</Text> : null}
                        </View>
                    </View>
                ) : null}

                <View className="px-6 mb-12">
                    <Text className="text-white font-black text-xl tracking-tight uppercase mb-6">Rozetler</Text>
                    <View className="bg-[#0f1118] rounded-[32px] p-6 border border-white/10 shadow-lg">
                        <Text className="text-amber-500 text-[10px] font-black tracking-[4px] uppercase mb-6 text-center">ROZETLER</Text>
                        {influencer.displayed_badges && influencer.displayed_badges.length > 0 ? (
                            influencer.displayed_badges.map((bId) => {
                                const badge = BADGES_BY_ID[bId];
                                if (!badge) return null;
                                return <AchievementCard key={bId} title={badge.name} description={badge.description} color={bId === 'verified-account' ? '#3b82f6' : '#fbbf24'} icon={badge.icon || Award} />;
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
                            <Text className="text-white/40 text-[10px] mb-6 text-center">Bu influencer ile çalışmak için teklif gönderin. Sohbet, teklif yanıtlanınca açılır.</Text>
                            <TouchableOpacity
                                onPress={() => setOfferVisible(true)}
                                activeOpacity={0.8}
                                className="w-full h-14 bg-amber-400 rounded-2xl items-center justify-center flex-row"
                            >
                                <Text className="text-black font-black text-base tracking-tight">Teklif Gönder</Text>
                            </TouchableOpacity>
                            {existingRoomId && (
                                <TouchableOpacity onPress={openChat} className="w-full h-12 mt-3 rounded-2xl border border-white/15 items-center justify-center flex-row gap-2">
                                    <MessageCircle color="white" size={16} />
                                    <Text className="text-white font-bold">Sohbete git</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
            </ScrollView>

            <Modal animationType="slide" transparent visible={offerVisible} onRequestClose={() => setOfferVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/70 justify-end">
                    <ScrollView className="bg-[#0F1014] rounded-t-[28px] border-t border-white/10" style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 24, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                        <View className="flex-row items-center justify-between mb-5">
                            <Text className="text-white text-xl font-bold">Teklif Gönder</Text>
                            <TouchableOpacity onPress={() => setOfferVisible(false)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                <X color="white" size={18} />
                            </TouchableOpacity>
                        </View>

                        <Text className="text-gray-400 text-xs mb-2">Kampanya adı *</Text>
                        <TextInput value={form.campaignName} onChangeText={(v) => setForm((f) => ({ ...f, campaignName: v }))} maxLength={120}
                            placeholder="Örn. Sonbahar koleksiyonu" placeholderTextColor="#6b7280"
                            className="bg-white/5 border border-white/10 rounded-2xl px-4 h-12 text-white mb-4" />

                        <Text className="text-gray-400 text-xs mb-2">Kampanya türü</Text>
                        <TextInput value={form.campaignType} onChangeText={(v) => setForm((f) => ({ ...f, campaignType: v }))} maxLength={60}
                            placeholder="Örn. Reels, story, UGC video" placeholderTextColor="#6b7280"
                            className="bg-white/5 border border-white/10 rounded-2xl px-4 h-12 text-white mb-4" />

                        <View className="flex-row gap-2 mb-4">
                            {[['cash', 'Nakit'], ['barter', 'Barter']].map(([value, label]) => (
                                <TouchableOpacity key={value} onPress={() => setForm((f) => ({ ...f, paymentType: value }))}
                                    className={`flex-1 h-11 rounded-2xl items-center justify-center border ${form.paymentType === value ? 'bg-amber-400 border-amber-400' : 'bg-white/5 border-white/10'}`}>
                                    <Text className={`font-bold ${form.paymentType === value ? 'text-black' : 'text-gray-300'}`}>{label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text className="text-gray-400 text-xs mb-2">{form.paymentType === 'barter' ? 'Ürün piyasa değeri (₺)' : 'Bütçe (₺)'}</Text>
                        <TextInput value={form.budget} onChangeText={(v) => setForm((f) => ({ ...f, budget: v.replace(/[^0-9]/g, '') }))}
                            keyboardType="number-pad" placeholder="0" placeholderTextColor="#6b7280"
                            className="bg-white/5 border border-white/10 rounded-2xl px-4 h-12 text-white mb-4" />

                        <Text className="text-gray-400 text-xs mb-2">Mesaj</Text>
                        <TextInput value={form.message} onChangeText={(v) => setForm((f) => ({ ...f, message: v }))} maxLength={2000} multiline
                            placeholder="Beklentilerinizi kısaca yazın" placeholderTextColor="#6b7280"
                            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white mb-6" style={{ minHeight: 90, textAlignVertical: 'top' }} />

                        <TouchableOpacity onPress={sendOffer} disabled={sending} className="h-14 rounded-2xl bg-amber-400 items-center justify-center">
                            {sending ? <ActivityIndicator color="black" /> : <Text className="text-black font-black text-base">Gönder</Text>}
                        </TouchableOpacity>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
