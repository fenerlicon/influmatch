import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, ArrowLeft, Send, X, MessageCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

// ─── Design ───────────────────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandMessagesScreen({ route }) {
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [currentUserId, setCurrentUserId] = useState(null);

    // Chat state
    const [selectedChat, setSelectedChat] = useState(null);
    const [chatVisible, setChatVisible] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const scrollRef = useRef(null);
    const subRef = useRef(null);
    const listSubRef = useRef(null);
    const currentUserIdRef = useRef(null);

    useEffect(() => {
        fetchConversations();
        return () => {
            subRef.current?.unsubscribe();
            listSubRef.current?.unsubscribe();
        };
    }, []);

    // Auto-open a room when navigated from Keşfet (via İletişime Geç)
    const openedRoomRef = useRef(null);
    useEffect(() => {
        const roomId = route?.params?.openRoomId;
        if (!roomId || openedRoomRef.current === roomId) return;
        openedRoomRef.current = roomId;
        // Wait for conversations to load then open the specific room
        const tryOpen = async () => {
            // Build a minimal conv object from params so chat opens immediately
            const partnerName = route?.params?.partnerName || 'Influencer';
            const partnerAvatar = route?.params?.partnerAvatar || null;
            const fakeConv = { id: roomId, partner: { full_name: partnerName, avatar_url: partnerAvatar } };
            openChat(fakeConv);
        };
        // Small delay so state is ready
        const t = setTimeout(tryOpen, 500);
        return () => clearTimeout(t);
    }, [route?.params?.openRoomId]);

    const fetchConversations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);
            currentUserIdRef.current = user.id;

            // Brands are brand_id in rooms
            const { data: rooms } = await supabase
                .from('rooms')
                .select('*, influencer:influencer_id(id, full_name, username, avatar_url)')
                .eq('brand_id', user.id);

            if (!rooms) { setLoading(false); return; }

            const roomsWithMsg = await Promise.all(rooms.map(async (room) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('content, created_at, sender_id')
                    .eq('room_id', room.id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                const last = msgs?.[0] || null;
                return {
                    id: room.id,
                    partner: room.influencer,
                    lastMessage: last?.content || 'Henüz mesaj yok.',
                    time: last ? new Date(last.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
                    unread: last ? last.sender_id !== user.id : false,
                };
            }));

            setConversations(roomsWithMsg);

            // Realtime: list-level subscription
            if (listSubRef.current) listSubRef.current.unsubscribe();
            const roomIds = rooms.map(r => r.id);
            if (roomIds.length > 0) {
                listSubRef.current = supabase.channel('brand-convos-list')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                        const nm = payload.new;
                        if (!roomIds.includes(nm.room_id)) return;
                        setConversations(prev => prev.map(c => c.id !== nm.room_id ? c : {
                            ...c,
                            lastMessage: nm.content,
                            time: new Date(nm.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                            unread: nm.sender_id !== currentUserIdRef.current,
                        }));
                    })
                    .subscribe();
            }
        } catch (e) {
            console.error('[BrandMessages] fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const openChat = async (conv) => {
        setSelectedChat(conv);
        setChatVisible(true);
        subRef.current?.unsubscribe();

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('room_id', conv.id)
            .order('created_at', { ascending: true });

        setMessages(data?.map(m => ({
            id: m.id,
            text: m.content,
            sender: m.sender_id === currentUserId ? 'me' : 'them',
            time: new Date(m.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        })) || []);

        // Subscribe
        subRef.current = supabase.channel(`brand-room-${conv.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${conv.id}` }, (payload) => {
                const nm = payload.new;
                setMessages(prev => [...prev, {
                    id: nm.id, text: nm.content,
                    sender: nm.sender_id === currentUserIdRef.current ? 'me' : 'them',
                    time: new Date(nm.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
                }]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            })
            .subscribe();
    };

    const closeChat = () => {
        setChatVisible(false);
        setSelectedChat(null);
        subRef.current?.unsubscribe();
        fetchConversations();
    };

    const sendMessage = async () => {
        const text = inputText.trim();
        if (!text || !selectedChat || !currentUserId) return;
        setInputText('');
        await supabase.from('messages').insert({ room_id: selectedChat.id, sender_id: currentUserId, content: text });
    };

    const filtered = conversations.filter(c =>
        (c.partner?.full_name || c.partner?.username || '').toLowerCase().includes(search.toLowerCase())
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
                            placeholder="Influencer ara..."
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
                            Bir influencer ile başvuru üzerinden iletişime geçtiğinde mesajlar burada görünür.
                        </Text>
                    </View>
                ) : (
                    <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                        {filtered.map((conv) => (
                            <GlassCard key={conv.id} className="p-4 mb-3" onPress={() => openChat(conv)}>
                                <View className="flex-row items-center gap-3">
                                    <View className="relative">
                                        <Avatar name={conv.partner?.full_name || conv.partner?.username} uri={conv.partner?.avatar_url} />
                                        {conv.unread && (
                                            <View className="absolute -top-1 -right-1 w-3 h-3 bg-soft-gold rounded-full border-2 border-[#020617]" />
                                        )}
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row items-center justify-between mb-0.5">
                                            <Text className="text-white font-bold text-sm">
                                                {conv.partner?.full_name || conv.partner?.username || 'Influencer'}
                                            </Text>
                                            <Text className="text-gray-600 text-xs">{conv.time}</Text>
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

            {/* ─── Chat Modal ─────────────────────────────────────────────── */}
            <Modal animationType="slide" transparent visible={chatVisible} onRequestClose={closeChat}>
                <View className="flex-1 bg-[#020617]">
                    <StatusBar style="light" />
                    <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

                    <SafeAreaView className="flex-1">
                        {/* Chat Header */}
                        <View className="px-4 py-3 flex-row items-center gap-3 border-b border-white/5">
                            <TouchableOpacity onPress={closeChat} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                                <ArrowLeft color="white" size={18} />
                            </TouchableOpacity>
                            <Avatar name={selectedChat?.partner?.full_name} uri={selectedChat?.partner?.avatar_url} size={36} />
                            <View className="flex-1">
                                <Text className="text-white font-bold text-sm">
                                    {selectedChat?.partner?.full_name || selectedChat?.partner?.username || 'Influencer'}
                                </Text>
                                <Text className="text-gray-500 text-xs">@{selectedChat?.partner?.username}</Text>
                            </View>
                        </View>

                        {/* Messages */}
                        <ScrollView
                            ref={scrollRef}
                            className="flex-1 px-4 py-4"
                            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
                            contentContainerStyle={{ paddingBottom: 16 }}
                        >
                            {messages.map((msg) => (
                                <View key={msg.id} className={`mb-3 ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}>
                                    <View className={`max-w-[80%] px-4 py-3 rounded-2xl ${msg.sender === 'me' ? 'bg-soft-gold rounded-tr-sm' : 'bg-white/8 border border-white/10 rounded-tl-sm'}`}>
                                        <Text className={`text-sm leading-5 ${msg.sender === 'me' ? 'text-midnight font-medium' : 'text-white'}`}>
                                            {msg.text}
                                        </Text>
                                    </View>
                                    <Text className="text-gray-600 text-[10px] mt-1 mx-1">{msg.time}</Text>
                                </View>
                            ))}
                        </ScrollView>

                        {/* Input */}
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
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={sendMessage}
                                    disabled={!inputText.trim()}
                                    className={`w-12 h-12 rounded-2xl items-center justify-center ${inputText.trim() ? 'bg-soft-gold' : 'bg-white/5'}`}
                                >
                                    <Send color={inputText.trim() ? 'black' : '#4b5563'} size={18} />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </SafeAreaView>
                </View>
            </Modal>
        </View>
    );
}
