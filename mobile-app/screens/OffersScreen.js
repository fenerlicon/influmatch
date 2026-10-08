import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, X, MessageCircle, CheckCircle2, XCircle, Clock } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../lib/api';

// Teklifler: influencer gelen teklifleri yanıtlar (Kabul / Reddet / Markayla görüş), marka gönderdiklerini izler.
// Tüm işlemler web'in sunucu kodundan geçer (lib/offers.ts): yetki, doğrulama, sohbet odası, bildirim.

const STATUS = {
    pending: { label: 'Beklemede', color: '#fbbf24', Icon: Clock },
    accepted: { label: 'Kabul edildi', color: '#34d399', Icon: CheckCircle2 },
    rejected: { label: 'Reddedildi', color: '#f87171', Icon: XCircle },
};

const formatBudget = (value) =>
    value === null || value === undefined ? 'Belirtilmedi' : `${Number(value).toLocaleString('tr-TR')} ₺`;

const GlassCard = ({ children, className, onPress }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress}
        className={`rounded-[22px] overflow-hidden border border-white/10 relative ${className}`}>
        <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </TouchableOpacity>
);

const Avatar = ({ person, size = 44 }) => (
    <View style={{ width: size, height: size }} className="rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden items-center justify-center">
        {person?.avatar_url
            ? <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size }} resizeMode="cover" />
            : <Text className="text-white font-bold">{(person?.full_name || person?.username || '?').charAt(0).toUpperCase()}</Text>}
    </View>
);

const StatusChip = ({ status }) => {
    const s = STATUS[status] || STATUS.pending;
    return (
        <View className="flex-row items-center gap-1 px-2.5 py-1 rounded-full border" style={{ borderColor: `${s.color}66`, backgroundColor: `${s.color}1A` }}>
            <s.Icon color={s.color} size={12} />
            <Text style={{ color: s.color }} className="text-[11px] font-semibold">{s.label}</Text>
        </View>
    );
};

export default function OffersScreen({ navigation }) {
    const [role, setRole] = useState(null);
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        const result = await apiRequest('offers');
        if (result.error) {
            Alert.alert('Teklifler yüklenemedi', result.error);
        } else {
            setRole(result.role);
            setOffers(result.offers || []);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const counterpart = (offer) => (role === 'brand' ? offer.receiver : offer.sender);

    const goToChat = (offer, roomId) => {
        const person = counterpart(offer);
        setSelected(null);
        navigation.navigate('Mesajlar', {
            openRoomId: roomId,
            partnerName: person?.full_name || person?.username,
            partnerAvatar: person?.avatar_url,
        });
    };

    const respond = async (offer, response) => {
        setBusy(response);
        const result = await apiRequest(`offers/${offer.id}/respond`, { method: 'POST', body: { response } });
        setBusy(null);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        await load();
        if ((response === 'accepted' || response === 'hold') && result.roomId) {
            goToChat(offer, result.roomId);
        } else {
            setSelected(null);
        }
    };

    const confirmReject = (offer) => {
        Alert.alert('Teklifi reddet', 'Bu teklifi reddetmek istediğinize emin misiniz?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Reddet', style: 'destructive', onPress: () => respond(offer, 'rejected') },
        ]);
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    const pending = offers.filter((o) => o.status === 'pending').length;

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pt-4 pb-2">
                    <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mb-1">TEKLİFLER</Text>
                    <Text className="text-white text-3xl font-bold tracking-tight">
                        {role === 'brand' ? 'Gönderdiklerim' : 'Gelen Teklifler'}
                    </Text>
                    {pending > 0 && (
                        <Text className="text-gray-400 text-sm mt-1">
                            {role === 'brand' ? `${pending} teklif yanıt bekliyor` : `${pending} teklif yanıtınızı bekliyor`}
                        </Text>
                    )}
                </View>

                {offers.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-8">
                        <View className="w-16 h-16 bg-white/5 rounded-full items-center justify-center mb-4 border border-white/10">
                            <Mail color="#4b5563" size={28} />
                        </View>
                        <Text className="text-white font-bold text-lg mb-2">Henüz teklif yok</Text>
                        <Text className="text-gray-500 text-sm text-center leading-5">
                            {role === 'brand'
                                ? 'Keşfet ekranından bir influencer profilini açıp teklif gönderebilirsiniz.'
                                : 'Markalar size teklif gönderdiğinde burada görünür.'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        className="flex-1 px-6 pt-4"
                        contentContainerStyle={{ paddingBottom: 100 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#D4AF37" />}
                    >
                        {offers.map((offer) => {
                            const person = counterpart(offer);
                            return (
                                <GlassCard key={offer.id} className="p-4 mb-3" onPress={() => setSelected(offer)}>
                                    <View className="flex-row items-center gap-3">
                                        <Avatar person={person} />
                                        <View className="flex-1">
                                            <Text className="text-white font-bold text-sm" numberOfLines={1}>{offer.campaign_name || 'İsimsiz kampanya'}</Text>
                                            <Text className="text-gray-500 text-xs" numberOfLines={1}>
                                                {person?.full_name || (person?.username ? `@${person.username}` : '')}
                                            </Text>
                                        </View>
                                        <StatusChip status={offer.status} />
                                    </View>
                                    <View className="flex-row justify-between mt-3">
                                        <Text className="text-gray-400 text-xs">
                                            {offer.payment_type === 'barter' ? 'Barter (ürün değeri)' : 'Bütçe (nakit)'}
                                        </Text>
                                        <Text className="text-soft-gold text-xs font-semibold">{formatBudget(offer.budget)}</Text>
                                    </View>
                                </GlassCard>
                            );
                        })}
                    </ScrollView>
                )}
            </SafeAreaView>

            <Modal animationType="slide" transparent visible={!!selected} onRequestClose={() => setSelected(null)}>
                <View className="flex-1 bg-black/70 justify-end">
                    {selected && (
                        <View className="bg-[#0F1014] rounded-t-[28px] border-t border-white/10 p-6 pb-10">
                            <View className="flex-row items-center justify-between mb-4">
                                <StatusChip status={selected.status} />
                                <TouchableOpacity onPress={() => setSelected(null)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                    <X color="white" size={18} />
                                </TouchableOpacity>
                            </View>
                            <Text className="text-white text-xl font-bold">{selected.campaign_name || 'İsimsiz kampanya'}</Text>
                            {selected.campaign_type ? <Text className="text-gray-400 text-xs uppercase tracking-widest mt-1">{selected.campaign_type}</Text> : null}

                            <View className="flex-row items-center gap-3 mt-4">
                                <Avatar person={counterpart(selected)} size={36} />
                                <Text className="text-gray-300 text-sm">
                                    {role === 'brand' ? 'Alıcı: ' : 'Gönderen: '}
                                    {counterpart(selected)?.full_name || `@${counterpart(selected)?.username || ''}`}
                                </Text>
                            </View>

                            <View className="flex-row justify-between mt-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                <Text className="text-gray-400 text-sm">{selected.payment_type === 'barter' ? 'Barter (ürün değeri)' : 'Bütçe (nakit)'}</Text>
                                <Text className="text-soft-gold font-bold">{formatBudget(selected.budget)}</Text>
                            </View>

                            {selected.message ? (
                                <Text className="text-gray-300 text-sm leading-5 mt-4">{selected.message}</Text>
                            ) : null}

                            {role === 'influencer' && selected.status === 'pending' && (
                                <View className="mt-6 gap-3">
                                    <TouchableOpacity disabled={!!busy} onPress={() => respond(selected, 'accepted')} className="h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 items-center justify-center">
                                        {busy === 'accepted' ? <ActivityIndicator color="#34d399" /> : <Text className="text-emerald-300 font-bold">Kabul et</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity disabled={!!busy} onPress={() => respond(selected, 'hold')} className="h-12 rounded-2xl bg-amber-500/15 border border-amber-400/50 items-center justify-center">
                                        {busy === 'hold' ? <ActivityIndicator color="#fbbf24" /> : <Text className="text-amber-200 font-bold">Markayla görüş</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity disabled={!!busy} onPress={() => confirmReject(selected)} className="h-12 rounded-2xl bg-red-500/10 border border-red-400/40 items-center justify-center">
                                        {busy === 'rejected' ? <ActivityIndicator color="#f87171" /> : <Text className="text-red-300 font-bold">Reddet</Text>}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {selected.room_id && (
                                <TouchableOpacity onPress={() => goToChat(selected, selected.room_id)} className="mt-4 h-12 rounded-2xl bg-soft-gold flex-row items-center justify-center gap-2">
                                    <MessageCircle color="black" size={18} />
                                    <Text className="text-black font-bold">Sohbete git</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>
            </Modal>
        </View>
    );
}
