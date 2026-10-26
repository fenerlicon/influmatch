import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CHAT_READ_EVENT, CHAT_TYPING_EVENT, CHAT_TYPING_SHOW_MS, CHAT_TYPING_THROTTLE_MS, chatLiveChannel, isSeenBy } from '../constants/chatLive';
import { View, ScrollView, Image, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Bell, MessageCircle, ChevronLeft, ArrowUp, Briefcase, Send, Megaphone, ChevronRight, ImagePlus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { pickChatImage, sendChatImage } from '../utils/chatImage';
import { PUBLIC_CARD_COLUMNS } from '../lib/userColumns';
import { timeAgo, formatDate } from '../lib/format';
import {
    Screen, LargeHeader, Text, IconButton, SearchBar, ListGroup, ListRow, Avatar, NameWithTick, IconBox,
    EmptyState, colors, fonts, ICON_STROKE,
} from '../components/ui';

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

const preview = (content) => (attachmentPath(content) ? 'Fotoğraf' : content);
const formatTime = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
// Liste saati: bugün "14:20", sonra "dün", "Pzt", "12 Eki"
const listTime = (iso) => (!iso ? '' : isToday(iso) ? formatTime(iso) : timeAgo(iso));

function dayLabel(iso) {
    if (isToday(iso)) return 'Bugün';
    const y = new Date();
    y.setDate(y.getDate() - 1);
    if (new Date(iso).toDateString() === y.toDateString()) return 'Dün';
    return formatDate(iso);
}

// Kapalı oda (3.6-S8): marka teklifini geri çekince teklif sohbeti salt okunur olur (web ile aynı metin).
const ROOM_CLOSED_TEXT = { offer_withdrawn: 'Marka teklifini geri çekti.' };
const closedNoticeOf = (reason) =>
    `${ROOM_CLOSED_TEXT[reason] || ROOM_CLOSED_TEXT.offer_withdrawn} Bu sohbet kapandı; mesaj geçmişi görünür, yeni mesaj yazılamaz.`;

const partnerName = (partner, fallback) => partner?.full_name || (partner?.username ? `@${partner.username}` : fallback);

// İş birliği durumu → sohbet etiketinde ve sohbet üstündeki iş kartında görünen metin
const COLLAB_CONTEXT = {
    agreed: { tag: 'Aktif iş', detail: 'Anlaşıldı' },
    in_progress: { tag: 'Aktif iş', detail: 'İçerik aşaması' },
    published: { tag: 'Aktif iş', detail: 'Yayında' },
    completed: { tag: 'Tamamlandı', detail: 'Tamamlandı' },
    cancelled: { tag: 'İptal edildi', detail: 'İptal edildi' },
};

// Sohbetin bağlı olduğu iş: iş birliği varsa o, yoksa kaynağı (teklif / ilan başvurusu)
function roomContext(room) {
    const collabs = (room.collaborations || []).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const collab = collabs.find((c) => c.status !== 'cancelled') || collabs[0];
    if (collab) {
        const c = COLLAB_CONTEXT[collab.status] || COLLAB_CONTEXT.agreed;
        return { icon: Briefcase, title: collab.title, tag: c.tag, detail: c.detail, collaborationId: collab.id };
    }
    if (room.offer) return { icon: Send, title: room.offer.campaign_name || 'Teklif', tag: 'Teklif', detail: 'Teklif' };
    if (room.application) return { icon: Megaphone, title: room.application.advert?.title || 'İlan', tag: 'Başvuru', detail: 'İlan başvurusu' };
    return null;
}

export default function MessagesScreen({ route, navigation }) {
    const [role, setRole] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [contexts, setContexts] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState('');

    const [selectedChat, setSelectedChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [imageUrls, setImageUrls] = useState({});
    const [inputText, setInputText] = useState('');
    // Açık sohbet kapalıysa nedeni (null = yazılabilir)
    const [closedReason, setClosedReason] = useState(null);
    const [sendingImage, setSendingImage] = useState(false);

    const scrollRef = useRef(null);
    const roomSubRef = useRef(null);
    const listSubRef = useRef(null);
    const userIdRef = useRef(null);
    const openedRoomRef = useRef(null);
    const openRoomIdRef = useRef(null);
    // Canlı durum (web ile aynı kanal, constants/chatLive.js): karşı tarafın son okuma zamanı ve "yazıyor…".
    const [otherReadAt, setOtherReadAt] = useState(null);
    const [otherTyping, setOtherTyping] = useState(false);
    const liveRef = useRef(null);
    const typingSentAt = useRef(0);
    const typingTimer = useRef(null);

    const startLive = (partnerId) => {
        if (liveRef.current) supabase.removeChannel(liveRef.current);
        liveRef.current = null;
        setOtherTyping(false);
        if (!partnerId || !userIdRef.current) return;
        liveRef.current = supabase
            .channel(chatLiveChannel(userIdRef.current, partnerId), { config: { broadcast: { self: false } } })
            .on('broadcast', { event: CHAT_TYPING_EVENT }, ({ payload }) => {
                if (payload?.userId !== partnerId) return;
                setOtherTyping(true);
                if (typingTimer.current) clearTimeout(typingTimer.current);
                typingTimer.current = setTimeout(() => setOtherTyping(false), CHAT_TYPING_SHOW_MS);
            })
            .on('broadcast', { event: CHAT_READ_EVENT }, ({ payload }) => {
                if (payload?.userId !== partnerId || typeof payload?.at !== 'string') return;
                setOtherReadAt((prev) => (prev && prev > payload.at ? prev : payload.at));
            })
            .subscribe();
    };

    const stopLive = () => {
        if (typingTimer.current) clearTimeout(typingTimer.current);
        if (liveRef.current) supabase.removeChannel(liveRef.current);
        liveRef.current = null;
        setOtherTyping(false);
        setOtherReadAt(null);
    };

    const notifyTyping = () => {
        const now = Date.now();
        if (now - typingSentAt.current < CHAT_TYPING_THROTTLE_MS) return;
        typingSentAt.current = now;
        liveRef.current?.send({ type: 'broadcast', event: CHAT_TYPING_EVENT, payload: { userId: userIdRef.current } });
    };

    // Odayı okundu işaretler (web ile aynı room_reads, sunucu ucu üzerinden).
    const markRead = (roomId) => {
        if (!roomId) return;
        apiRequest('messages', { method: 'PATCH', body: { roomIds: [roomId] } }).then((r) => {
            // Karşı tarafa "Görüldü" sinyali (sohbet açıkken).
            if (!r?.error && openRoomIdRef.current === roomId) {
                liveRef.current?.send({ type: 'broadcast', event: CHAT_READ_EVENT, payload: { userId: userIdRef.current, at: new Date().toISOString() } });
            }
        });
    };

    // Bağlı iş bilgisi ayrı sorguda: okunamazsa sohbet listesi yine açılır, yalnızca etiket görünmez.
    const fetchContexts = async (roomIds) => {
        if (!roomIds.length) return;
        const { data, error } = await supabase
            .from('rooms')
            .select('id, offer:offer_id(campaign_name), application:advert_application_id(advert:advert_id(title)), collaborations(id, title, status, created_at)')
            .in('id', roomIds);
        if (error) { console.log('[Messages] context:', error.message); return; }
        const map = {};
        (data || []).forEach((room) => { map[room.id] = roomContext(room); });
        setContexts(map);
    };

    const fetchConversations = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            userIdRef.current = user.id;

            const { data: me } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
            setRole(me?.role === 'brand' ? 'brand' : 'influencer');

            const { data: rooms, error } = await supabase
                .from('rooms')
                .select(`id, brand_id, influencer_id, closed_at, closed_reason, brand:brand_id(${PUBLIC_CARD_COLUMNS}), influencer:influencer_id(${PUBLIC_CARD_COLUMNS})`)
                .or(`brand_id.eq.${user.id},influencer_id.eq.${user.id}`);
            if (error) throw error;

            // Okundu bilgisi web ile ortak room_reads tablosundan (kullanıcı yalnızca kendi satırlarını görür).
            const { data: reads } = await supabase
                .from('room_reads')
                .select('room_id, last_read_at')
                .eq('user_id', user.id);
            const lastReadByRoom = new Map((reads || []).map((r) => [r.room_id, r.last_read_at]));

            const list = await Promise.all((rooms || []).map(async (room) => {
                const lastRead = lastReadByRoom.get(room.id);
                let unreadQuery = supabase
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .eq('room_id', room.id)
                    .neq('sender_id', user.id);
                if (lastRead) unreadQuery = unreadQuery.gt('created_at', lastRead);
                const [{ data: msgs }, { count }] = await Promise.all([
                    supabase
                        .from('messages')
                        .select('content, created_at, sender_id, is_system')
                        .eq('room_id', room.id)
                        .order('created_at', { ascending: false })
                        .limit(1),
                    unreadQuery,
                ]);
                const last = msgs?.[0] || null;
                return {
                    id: room.id,
                    partner: room.brand_id === user.id ? room.influencer : room.brand,
                    lastMessage: last ? preview(last.content) : null,
                    lastMine: last?.sender_id === user.id && !last?.is_system,
                    closedReason: room.closed_at ? (room.closed_reason || 'offer_withdrawn') : null,
                    lastAt: last?.created_at || null,
                    unread: openRoomIdRef.current === room.id ? 0 : (count || 0),
                };
            }));
            list.sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
            setConversations(list);
            fetchContexts(list.map((c) => c.id));

            listSubRef.current?.unsubscribe();
            const roomIds = list.map((c) => c.id);
            if (roomIds.length > 0) {
                listSubRef.current = supabase.channel(`convos-${user.id}`)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
                        const nm = payload.new;
                        if (!roomIds.includes(nm.room_id)) return;
                        const mine = nm.sender_id === userIdRef.current;
                        setConversations((prev) => prev.map((c) => c.id !== nm.room_id ? c : {
                            ...c,
                            lastMessage: preview(nm.content),
                            lastMine: mine && !nm.is_system,
                            lastAt: nm.created_at,
                            unread: !mine && openRoomIdRef.current !== nm.room_id ? c.unread + 1 : c.unread,
                        }).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')));
                    })
                    .subscribe();
            }
        } catch (e) {
            console.error('[Messages] fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
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
        setConversations((prev) => prev.map((c) => c.id === conv.id ? { ...c, unread: 0 } : c));
        markRead(conv.id);
        setMessages([]);
        setClosedReason(conv.closedReason || null);
        setLoadingMessages(true);
        roomSubRef.current?.unsubscribe();
        const partnerId = conv.partner?.id || null;
        startLive(partnerId);
        setOtherReadAt(null);
        if (partnerId) {
            apiRequest(`messages?participantId=${encodeURIComponent(partnerId)}&roomIds=${encodeURIComponent(conv.id)}`).then((r) => {
                if (openRoomIdRef.current === conv.id && r?.lastReadAt) setOtherReadAt((prev) => (prev && prev > r.lastReadAt ? prev : r.lastReadAt));
            });
        }

        const [{ data }, { data: roomRow }] = await Promise.all([
            supabase
                .from('messages')
                .select('id, content, sender_id, created_at, is_system')
                .eq('room_id', conv.id)
                .order('created_at', { ascending: true }),
            supabase.from('rooms').select('closed_at, closed_reason').eq('id', conv.id).maybeSingle(),
        ]);
        if (openRoomIdRef.current !== conv.id) return;
        setClosedReason(roomRow?.closed_at ? (roomRow.closed_reason || 'offer_withdrawn') : null);
        const rows = data || [];
        setMessages(rows);
        setLoadingMessages(false);
        signImages(rows);

        roomSubRef.current = supabase.channel(`room-${conv.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${conv.id}` }, (payload) => {
                const nm = payload.new;
                setMessages((prev) => prev.some((m) => m.id === nm.id) ? prev : [...prev, nm]);
                if (nm.sender_id !== userIdRef.current) {
                    setOtherTyping(false);
                    markRead(conv.id);
                }
                signImages([nm]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            })
            // Sohbet açıkken oda kapanırsa (teklif geri çekildi) yazma alanı hemen kapanır.
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${conv.id}` }, (payload) => {
                if (payload.new?.closed_at) setClosedReason(payload.new.closed_reason || 'offer_withdrawn');
            })
            .subscribe();
    };

    const closeChat = () => {
        setSelectedChat(null);
        setInputText('');
        setClosedReason(null);
        openRoomIdRef.current = null;
        roomSubRef.current?.unsubscribe();
        stopLive();
        fetchConversations();
    };

    // İyimser gönderim (web ile aynı): mesaj hemen görünür ("Gönderiliyor…"), sunucu yanıtıyla gerçek kayda dönüşür.
    const sendMessage = async () => {
        const text = inputText.trim();
        if (!text || !selectedChat || closedReason) return;
        const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setInputText('');
        setMessages((prev) => [...prev, { id: tempId, sender_id: userIdRef.current, content: text, created_at: new Date().toISOString(), pending: true }]);
        const result = await apiRequest('messages', { method: 'POST', body: { roomId: selectedChat.id, content: text } });
        if (!result.success) {
            setMessages((prev) => prev.filter((m) => m.id !== tempId));
            setInputText((current) => current || text);
            Alert.alert('Mesaj gönderilemedi', result.error || 'Lütfen tekrar deneyin.');
            return;
        }
        setMessages((prev) => {
            const rest = prev.filter((m) => m.id !== tempId);
            return rest.some((m) => m.id === result.data.id) ? rest : [...rest, result.data];
        });
    };

    // Görsel gönderme (3.22-N2): seçilen görsel küçültülür, imzalı adresle gizli kovaya yüklenir, mesaj web'in sunucu koduyla gider.
    const sendImage = async () => {
        if (!selectedChat || closedReason || sendingImage) return;
        const picked = await pickChatImage().catch(() => ({ error: 'Galeri açılamadı.' }));
        if (!picked) return;
        if (picked.error) return Alert.alert('Görsel seçilemedi', picked.error);
        const roomId = selectedChat.id;
        setSendingImage(true);
        try {
            const result = await sendChatImage(roomId, picked.asset);
            if (!result.success) {
                Alert.alert('Görsel gönderilemedi', result.error);
                return;
            }
            if (openRoomIdRef.current === roomId) {
                setMessages((prev) => (prev.some((m) => m.id === result.data.id) ? prev : [...prev, result.data]));
                signImages([result.data]);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
            }
        } finally {
            setSendingImage(false);
        }
    };

    // "Görüldü / Gönderildi" yalnızca son kendi mesajının altında.
    const lastOwnId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].sender_id === userIdRef.current && !messages[i].is_system) return messages[i].id;
        }
        return null;
    }, [messages]);

    // İş kartından iş birliği detayına: önce sohbet kapanır, dönüşte liste yenilenir
    const openCollaboration = (id) => {
        closeChat();
        navigation.navigate('CollaborationDetail', { id });
    };

    const fallbackName = role === 'brand' ? 'Influencer' : 'Marka';
    const filtered = useMemo(() => {
        const q = search.trim().toLocaleLowerCase('tr-TR');
        if (!q) return conversations;
        return conversations.filter((c) =>
            [partnerName(c.partner, ''), contexts[c.id]?.title].some((s) => (s || '').toLocaleLowerCase('tr-TR').includes(q))
        );
    }, [conversations, contexts, search]);

    // Sohbet açıkken eksik kişi bilgisini listeden tamamla (başka ekrandan açıldığında yalnızca ad gelir)
    const listed = selectedChat ? conversations.find((c) => c.id === selectedChat.id) : null;
    const chat = selectedChat ? { ...selectedChat, ...(listed || {}) } : null;
    const chatContext = chat ? contexts[chat.id] : null;

    // Mesajlar gün ayraçlarıyla
    const timeline = useMemo(() => {
        const out = [];
        let day = null;
        for (const m of messages) {
            const d = new Date(m.created_at).toDateString();
            if (d !== day) { day = d; out.push({ type: 'day', key: `d-${d}`, label: dayLabel(m.created_at) }); }
            out.push({ type: 'msg', key: m.id, msg: m });
        }
        return out;
    }, [messages]);

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchConversations(); }}
            header={
                <LargeHeader
                    title="Mesajlar"
                    right={<IconButton icon={Bell} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Bildirimler" />}
                />
            }
        >
            {conversations.length > 0 ? (
                <SearchBar value={search} onChangeText={setSearch} placeholder="Sohbetlerde ara" />
            ) : null}

            {loading ? (
                <View className="py-16"><ActivityIndicator color={colors.gold} /></View>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={MessageCircle}
                    title={conversations.length ? 'Sonuç yok' : 'Henüz sohbet yok'}
                    text={conversations.length ? 'Aramanla eşleşen sohbet bulunamadı.' : 'Sohbetler bir teklif ya da ilan başvurusu üzerinden açılır ve burada görünür.'}
                />
            ) : (
                <ListGroup>
                    {filtered.map((conv) => {
                        const ctx = contexts[conv.id];
                        const CtxIcon = ctx?.icon;
                        const name = partnerName(conv.partner, fallbackName);
                        const unread = conv.unread > 0;
                        return (
                            <ListRow
                                key={conv.id}
                                onPress={() => openChat(conv)}
                                left={<Avatar name={name} uri={conv.partner?.avatar_url} square />}
                                title={
                                    <NameWithTick
                                        name={name}
                                        verified={conv.partner?.verification_status === 'verified'}
                                        weight={unread ? 'semibold' : 'medium'}
                                    />
                                }
                                subtitle={
                                    <View>
                                        <Text variant="small" tone={unread ? 'fg' : 'fg2'} numberOfLines={1}>
                                            {conv.lastMessage ? `${conv.lastMine ? 'Sen: ' : ''}${conv.lastMessage}` : 'Henüz mesaj yok'}
                                        </Text>
                                        {ctx ? (
                                            <View className="flex-row items-center mt-[3px]" style={{ gap: 4 }}>
                                                <CtxIcon size={12} color={colors.fg3} strokeWidth={ICON_STROKE} />
                                                <Text variant="caption" tone="fg3" style={{ fontSize: 11.5, flexShrink: 1 }} numberOfLines={1}>
                                                    {ctx.title} · {ctx.tag}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                }
                                right={
                                    <View className="items-end self-start pt-0.5" style={{ gap: 6 }}>
                                        <Text variant="caption" tone="fg3">{listTime(conv.lastAt)}</Text>
                                        {unread ? (
                                            <View className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold items-center justify-center">
                                                <Text weight="bold" tone="goldInk" style={{ fontSize: 11.5, lineHeight: 14 }}>
                                                    {conv.unread > 99 ? '99+' : conv.unread}
                                                </Text>
                                            </View>
                                        ) : null}
                                    </View>
                                }
                            />
                        );
                    })}
                </ListGroup>
            )}

            <Modal animationType="slide" visible={!!chat} onRequestClose={closeChat} statusBarTranslucent>
                <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-bg">
                    <StatusBar style="light" />
                    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        {/* Üst çubuk: geri + karşı taraf */}
                        <View className="flex-row items-center px-2 pt-1.5 pb-2.5 min-h-[52px]" style={{ gap: 6 }}>
                            <IconButton icon={ChevronLeft} onPress={closeChat} accessibilityLabel="Geri" />
                            <Avatar name={partnerName(chat?.partner, fallbackName)} uri={chat?.partner?.avatar_url} size="sm" square />
                            <View className="flex-1 min-w-0 ml-1">
                                <NameWithTick
                                    name={partnerName(chat?.partner, fallbackName)}
                                    verified={chat?.partner?.verification_status === 'verified'}
                                    variant="small"
                                    weight="semibold"
                                />
                                <Text variant="caption" tone="fg3">{role === 'brand' ? 'Influencer' : 'Marka'}</Text>
                            </View>
                        </View>

                        {/* Sohbetin neden açık olduğu: bağlı iş. İş birliği varsa dokununca detayı açılır. */}
                        {chatContext ? (
                            <Pressable
                                onPress={chatContext.collaborationId ? () => openCollaboration(chatContext.collaborationId) : undefined}
                                disabled={!chatContext.collaborationId}
                                accessibilityRole={chatContext.collaborationId ? 'button' : undefined}
                                className="mx-4 flex-row items-center px-3 py-2.5 rounded-[14px] bg-s1 border border-line"
                                style={{ gap: 10 }}
                            >
                                <IconBox icon={chatContext.icon} tone="gold" size={34} />
                                <View className="flex-1 min-w-0">
                                    <Text variant="small" weight="semibold" numberOfLines={1}>{chatContext.title}</Text>
                                    <Text variant="caption" tone="fg3" numberOfLines={1}>{chatContext.detail}</Text>
                                </View>
                                {chatContext.collaborationId ? <ChevronRight size={18} color={colors.fg3} strokeWidth={ICON_STROKE} /> : null}
                            </Pressable>
                        ) : null}

                        <ScrollView
                            ref={scrollRef}
                            className="flex-1"
                            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 8 }}
                            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
                            keyboardShouldPersistTaps="handled"
                        >
                            {loadingMessages ? (
                                <View className="py-16"><ActivityIndicator color={colors.gold} /></View>
                            ) : messages.length === 0 ? (
                                <Text variant="small" tone="fg3" style={{ textAlign: 'center', marginTop: 40 }}>Henüz mesaj yok. İlk mesajı sen yaz.</Text>
                            ) : timeline.map((item) => {
                                if (item.type === 'day') {
                                    return (
                                        <View key={item.key} className="self-center px-2.5 py-1 rounded-full bg-s1 border border-line my-1">
                                            <Text variant="caption" tone="fg3" style={{ fontSize: 11.5 }}>{item.label}</Text>
                                        </View>
                                    );
                                }
                                const msg = item.msg;
                                if (msg.is_system) {
                                    return (
                                        <View key={item.key} className="self-center px-3 py-1.5 rounded-full bg-s1 border border-line my-1">
                                            <Text variant="caption" tone="fg2" style={{ fontSize: 12, textAlign: 'center' }}>
                                                {msg.content} · {formatTime(msg.created_at)}
                                            </Text>
                                        </View>
                                    );
                                }
                                const mine = msg.sender_id === userIdRef.current;
                                const path = attachmentPath(msg.content);
                                const status = msg.id === lastOwnId
                                    ? (msg.pending ? 'Gönderiliyor…' : isSeenBy(otherReadAt, msg.created_at) ? 'Görüldü' : 'Gönderildi')
                                    : null;
                                return (
                                    <React.Fragment key={item.key}>
                                    <View
                                        style={msg.pending ? { opacity: 0.7 } : undefined}
                                        className={`max-w-[78%] border rounded-[18px] ${mine ? 'self-end bg-s3 border-line-strong rounded-br-md' : 'self-start bg-s2 border-line rounded-bl-md'} ${path ? 'p-1' : 'px-[13px] py-2.5'}`}
                                    >
                                        {path ? (
                                            imageUrls[path]
                                                ? <Image source={{ uri: imageUrls[path] }} style={{ width: 220, height: 165, borderRadius: 14 }} resizeMode="cover" />
                                                : <View style={{ width: 220, height: 165 }} className="items-center justify-center"><ActivityIndicator color={colors.gold} /></View>
                                        ) : (
                                            <Text style={{ fontSize: 14.5, lineHeight: 20 }}>{msg.content}</Text>
                                        )}
                                        <Text variant="caption" tone="fg3" style={{ fontSize: 11, textAlign: 'right', marginTop: 4, marginRight: path ? 6 : 0 }}>
                                            {formatTime(msg.created_at)}
                                        </Text>
                                    </View>
                                    {status ? (
                                        <Text variant="caption" tone={status === 'Görüldü' ? 'gold' : 'fg3'} style={{ fontSize: 11, alignSelf: 'flex-end', marginTop: -4, marginRight: 4 }}>
                                            {status}
                                        </Text>
                                    ) : null}
                                    </React.Fragment>
                                );
                            })}
                            {otherTyping ? (
                                <View className="self-start px-3 py-2 rounded-[18px] rounded-bl-md bg-s2 border border-line">
                                    <Text variant="caption" tone="fg2">{partnerName(chat?.partner, fallbackName).split(' ')[0]} yazıyor…</Text>
                                </View>
                            ) : null}
                        </ScrollView>

                        {/* Yazma alanı; kapalı sohbette yerine açıklama */}
                        {closedReason ? (
                            <View className="px-4 py-3.5 border-t border-line bg-bg">
                                <Text variant="small" tone="fg2" style={{ textAlign: 'center' }}>{closedNoticeOf(closedReason)}</Text>
                            </View>
                        ) : (
                        <View className="flex-row items-end px-3 py-2.5 border-t border-line bg-bg" style={{ gap: 10 }}>
                            <Pressable
                                onPress={sendImage}
                                disabled={sendingImage}
                                accessibilityRole="button"
                                accessibilityLabel="Fotoğraf gönder"
                                className="w-11 h-11 rounded-full items-center justify-center bg-s2 border border-line-strong"
                            >
                                {sendingImage
                                    ? <ActivityIndicator color={colors.gold} size="small" />
                                    : <ImagePlus size={20} color={colors.fg2} strokeWidth={ICON_STROKE} />}
                            </Pressable>
                            <View className="flex-1 min-h-[44px] max-h-[120px] rounded-[22px] bg-s2 border border-line-strong px-4 justify-center">
                                <TextInput
                                    value={inputText}
                                    onChangeText={(t) => {
                                        setInputText(t);
                                        if (t.trim()) notifyTyping();
                                    }}
                                    placeholder="Mesaj yaz"
                                    placeholderTextColor={colors.fg3}
                                    selectionColor={colors.gold}
                                    cursorColor={colors.gold}
                                    multiline
                                    maxLength={5000}
                                    style={{ color: colors.fg, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 10, outlineStyle: 'none' }}
                                />
                            </View>
                            <Pressable
                                onPress={sendMessage}
                                disabled={!inputText.trim()}
                                accessibilityRole="button"
                                accessibilityLabel="Gönder"
                                className={`w-11 h-11 rounded-full items-center justify-center ${inputText.trim() ? 'bg-gold' : 'bg-s3'}`}
                            >
                                <ArrowUp size={20} color={inputText.trim() ? colors.goldInk : colors.fg3} strokeWidth={2} />
                            </Pressable>
                        </View>
                        )}
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </Screen>
    );
}
