import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ArrowLeft, Send, MessageCircle } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { PUBLIC_CARD_COLUMNS } from '../lib/userColumns';

// Influencer ve marka için ortak mesaj kutusu. Sohbetler yalnızca teklif veya ilan başvurusu üzerinden açılır
// (web ile aynı kural); mesajlar web'in sunucu kodu üzerinden gönderilir (engel kontrolü, bildirim).

const IMAGE_PREFIX = '![image](';
const ATTACHMENT_MARKER = '/storage/v1/object/public/chat-attachments/';

// Görsel mesaj: "![image](<public url>)". Kova gizli; yol çıkarılıp imzalı bağlantı istenir.
function attachmentPath(content) {
    if (!content?.startsWith(IMAGE_PREFIX) || !content.endsWith(')')) return null;
    const url = content.slice(IMAGE_PREFIX.length, -1);
    const i = url.indexOf(ATTACHMENT_MARKER);
    if (i < 0) return null;
    const path = decodeURIComponent(url.slice(i + ATTACHMENT_MARKER.length).split('?')[0]);
    return path && !path.includes('..') ? path : null;
}

const formatTime = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

const GlassCard = ({ children, className, onPress }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.8 : 1} onPress={onPress}
        className={`rounded-[22px] overflow-hidden border border-white/10 relative ${className}`}>
        <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </TouchableOpacity>
);

const Avatar = ({ name, uri, size = 48 }) => (
    <View style={{ width: size, height: size }} className="rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden items-center justify-center">
        {uri ? <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="cover" />
            : <Text className="text-white font-bold text-lg">{(name || '?').charAt(0).toUpperCase()}</Text>}
    </View>
);

const partnerName = (partner, fallback) => partner?.full_name || (partner?.username ? `@${partner.username}` : fallback);

export default function MessagesScreen({ route }) {
    const [role, setRole] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [imageUrls, setImageUrls] = useState({});
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);

    const scrollRef = useRef(null);
    const roomSubRef = useRef(null);
    const listSubRef = useRef(null);
    const userIdRef = useRef(null);
    const openedRoomRef = useRef(null);
    const openRoomIdRef = useRef(null);

    // Odayı okundu işaretler (web ile aynı room_reads, sunucu ucu üzerinden).
    const markRead = (roomId) => {
        if (!roomId) return;
        apiRequest('messages', { method: 'PATCH', body: { roomIds: [roomId] } });
    };

    const fetchConversations = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            userIdRef.current = user.id;

            const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
            const myRole = me?.role === 'brand' ? 'brand' : 'influencer';
            setRole(myRole);

            const { data: rooms, error } = await supabase
                .from('rooms')
                .select(`id, brand_id, influencer_id, brand:brand_id(${PUBLIC_CARD_COLUMNS}), influencer:influencer_id(${PUBLIC_CARD_COLUMNS})`)
                .or(`brand_id.eq.${user.id},influencer_id.eq.${user.id}`);
            if (error) throw error;

            // Okundu bilgisi web ile ortak room_reads tablosundan (kullanıcı yalnızca kendi satırlarını görür).
            const { data: reads } = await supabase
                .from('room_reads')
                .select('room_id, last_read_at')
                .eq('user_id', user.id);
            const lastReadByRoom = new Map((reads || []).map((r) => [r.room_id, r.last_read_at]));

            const list = await Promise.all((rooms || []).map(async (room) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('content, created_at, sender_id')
                    .eq('room_id', room.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                const last = msgs?.[0] || null;
                const partner = room.brand_id === user.id ? room.influencer : room.brand;
                return {
                    id: room.id,
                    partner,
                    lastMessage: last ? (attachmentPath(last.content) ? '📷 Fotoğraf' : last.content) : 'Henüz mesaj yok.',
                    lastAt: last?.created_at || null,
                    unread: last
                        ? last.sender_id !== user.id
                            && (!lastReadByRoom.get(room.id) || new Date(last.created_at) > new Date(lastReadByRoom.get(room.id)))
                        : false,
                };
            }));
            list.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
            setConversations(list);

            listSubRef.current?.unsubscribe();
            const roomIds = list.map((c) => c.id);
            if (roomIds.length > 0) {
                listSubRef.current = supabase.channel(`convos-${user.id}`)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                        const nm = payload.new;
                        if (!roomIds.includes(nm.room_id)) return;
                        setConversations((prev) => prev.map((c) => c.id !== nm.room_id ? c : {
                            ...c,
                            lastMessage: attachmentPath(nm.content) ? '📷 Fotoğraf' : nm.content,
                            lastAt: nm.created_at,
                            unread: nm.sender_id !== userIdRef.current && openRoomIdRef.current !== nm.room_id,
                        }));
                    })
                    .subscribe();
            }
        } catch (e) {
            console.error('[Messages] fetch error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchConversations(); }, [fetchConversations]));

    useEffect(() => () => {
        roomSubRef.current?.unsubscribe();
        listSubRef.current?.unsubscribe();
    }, []);

    // Teklif / başvuru ekranından gelen belirli bir sohbet
    useEffect(() => {
        const roomId = route?.params?.openRoomId;
        if (!roomId || openedRoomRef.current === roomId) return;
        openedRoomRef.current = roomId;
        openChat({
            id: roomId,
            partner: { full_name: route?.params?.partnerName, avatar_url: route?.params?.partnerAvatar },
        });
    }, [route?.params?.openRoomId]);

    const signImages = async (rows) => {
        const paths = Array.from(new Set(rows.map((m) => attachmentPath(m.content)).filter(Boolean)));
        if (paths.length === 0) return;
        const { data } = await supabase.storage.from('chat-attachments').createSignedUrls(paths, 60 * 60);
        if (!data) return;
        setImageUrls((prev) => {
            const next = { ...prev };
            data.forEach((item) => { if (item.path && item.signedUrl) next[item.path] = item.signedUrl; });
            return next;
        });
    };

    const openChat = async (conv) => {
        setSelectedChat(conv);
        openRoomIdRef.current = conv.id;
        setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread: false } : c));
        markRead(conv.id);
        setMessages([]);
        roomSubRef.current?.unsubscribe();

        const { data } = await supabase
            .from('messages')
            .select('id, content, sender_id, created_at')
            .eq('room_id', conv.id)
            .order('created_at', { ascending: true });
        const rows = data || [];
        setMessages(rows);
        signImages(rows);

        roomSubRef.current = supabase.channel(`room-${conv.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${conv.id}` }, (payload) => {
                const nm = payload.new;
                setMessages((prev) => prev.some((m) => m.id === nm.id) ? prev : [...prev, nm]);
                if (nm.sender_id !== userIdRef.current) markRead(conv.id);
                signImages([nm]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            })
            .subscribe();
    };

    const closeChat = () => {
        setSelectedChat(null);
        openRoomIdRef.current = null;
        roomSubRef.current?.unsubscribe();
        fetchConversations();
    };

    const sendMessage = async () => {
        const text = inputText.trim();
        if (!text || !selectedChat || sending) return;
        setSending(true);
        const result = await apiRequest('messages', { method: 'POST', body: { roomId: selectedChat.id, content: text } });
        setSending(false);
        if (!result.success) {
            Alert.alert('Mesaj gönderilemedi', result.error || 'Lütfen tekrar deneyin.');
            return;
        }
        setInputText('');
        setMessages((prev) => prev.some((m) => m.id === result.data.id) ? prev : [...prev, result.data]);
    };

    const fallbackName = role === 'brand' ? 'Influencer' : 'Marka';
    const filtered = conversations.filter((c) =>
        (partnerName(c.partner, '') || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pt-4 pb-2">
                    <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mb-1">MESAJLAR</Text>
                    <Text className="text-white text-3xl font-bold tracking-tight mb-4">Gelen Kutusu</Text>
                    <View className="bg-white/5 border border-white/10 rounded-2xl flex-row items-center px-4 h-11">
                        <Search color="#6b7280" size={16} />
                        <TextInput
                            className="flex-1 ml-3 text-white text-sm"
                            placeholder={role === 'brand' ? 'Influencer ara...' : 'Marka ara...'}
                            placeholderTextColor="#6b7280"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>
                </View>

                {filtered.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-8">
                        <View className="w-16 h-16 bg-white/5 rounded-full items-center justify-center mb-4 border border-white/10">
                            <MessageCircle color="#4b5563" size={28} />
                        </View>
                        <Text className="text-white font-bold text-lg mb-2">Mesaj Yok</Text>
                        <Text className="text-gray-500 text-sm text-center leading-5">
                            Sohbetler bir teklif ya da ilan başvurusu üzerinden açılır ve burada görünür.
                        </Text>
                    </View>
                ) : (
                    <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {filtered.map((conv) => (
                            <GlassCard key={conv.id} className="p-4 mb-3" onPress={() => openChat(conv)}>
                                <View className="flex-row items-center gap-3">
                                    <View className="relative">
                                        <Avatar name={partnerName(conv.partner, fallbackName)} uri={conv.partner?.avatar_url} />
                                        {conv.unread && <View className="absolute -top-1 -right-1 w-3 h-3 bg-soft-gold rounded-full border-2 border-[#020617]" />}
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center justify-between mb-0.5">
                                            <Text className="text-white font-bold text-sm">{partnerName(conv.partner, fallbackName)}</Text>
                                            <Text className="text-gray-600 text-xs">{conv.lastAt ? formatTime(conv.lastAt) : ''}</Text>
                                        </View>
                                        <Text className={`text-xs ${conv.unread ? 'text-gray-300 font-medium' : 'text-gray-500'}`} numberOfLines={1}>
                                            {conv.lastMessage}
                                        </Text>
                                    </View>
                                </View>
                            </GlassCard>
                        ))}
                    </ScrollView>
                )}
            </SafeAreaView>

            <Modal animationType="slide" transparent visible={!!selectedChat} onRequestClose={closeChat}>
                <View className="flex-1 bg-[#020617]">
                    <StatusBar style="light" />
                    <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
                    <SafeAreaView className="flex-1">
                        <View className="px-4 py-3 flex-row items-center gap-3 border-b border-white/5">
                            <TouchableOpacity onPress={closeChat} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                                <ArrowLeft color="white" size={18} />
                            </TouchableOpacity>
                            <Avatar name={partnerName(selectedChat?.partner, fallbackName)} uri={selectedChat?.partner?.avatar_url} size={36} />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm">{partnerName(selectedChat?.partner, fallbackName)}</Text>
                                {selectedChat?.partner?.username ? <Text className="text-gray-500 text-xs">@{selectedChat.partner.username}</Text> : null}
                            </View>
                        </View>

                        <ScrollView
                            ref={scrollRef}
                            className="flex-1 px-4 py-4"
                            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
                            contentContainerStyle={{ paddingBottom: 16 }}
                        >
                            {messages.map((msg) => {
                                const mine = msg.sender_id === userIdRef.current;
                                const path = attachmentPath(msg.content);
                                return (
                                    <View key={msg.id} className={`mb-3 ${mine ? 'items-end' : 'items-start'}`}>
                                        <View className={`max-w-[80%] rounded-2xl ${path ? 'p-1' : 'px-4 py-3'} ${mine ? 'bg-soft-gold rounded-tr-sm' : 'bg-white/8 border border-white/10 rounded-tl-sm'}`}>
                                            {path ? (
                                                imageUrls[path]
                                                    ? <Image source={{ uri: imageUrls[path] }} style={{ width: 220, height: 165, borderRadius: 14 }} resizeMode="cover" />
                                                    : <View style={{ width: 220, height: 165 }} className="items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>
                                            ) : (
                                                <Text className={`text-sm leading-5 ${mine ? 'text-midnight font-medium' : 'text-white'}`}>{msg.content}</Text>
                                            )}
                                        </View>
                                        <Text className="text-gray-600 text-[10px] mt-1 mx-1">{formatTime(msg.created_at)}</Text>
                                    </View>
                                );
                            })}
                        </ScrollView>

                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
                            <View className="px-4 pb-6 pt-2 border-t border-white/5 flex-row items-center gap-3">
                                <View className="flex-1 bg-white/5 border border-white/10 rounded-2xl flex-row items-center px-4 min-h-[48px]">
                                    <TextInput
                                        className="flex-1 text-white text-sm py-3"
                                        placeholder="Mesaj yaz..."
                                        placeholderTextColor="#6b7280"
                                        value={inputText}
                                        onChangeText={setInputText}
                                        multiline
                                        maxLength={5000}
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={sendMessage}
                                    disabled={!inputText.trim() || sending}
                                    className={`w-12 h-12 rounded-2xl items-center justify-center ${inputText.trim() ? 'bg-soft-gold' : 'bg-white/5'}`}
                                >
                                    {sending ? <ActivityIndicator color="black" /> : <Send color={inputText.trim() ? 'black' : '#4b5563'} size={18} />}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
