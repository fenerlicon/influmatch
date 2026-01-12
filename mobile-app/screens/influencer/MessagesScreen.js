import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, ChevronRight, Check, Pin, ArrowLeft, MoreVertical, Send, ImagePlus, Mic } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';

export default function MessagesScreen() {
    const [selectedChat, setSelectedChat] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [inputText, setInputText] = useState('');

    // Real Data States
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState({}); // { [roomId]: [messages...] }
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState(null);

    const subscriptionRef = useRef(null);

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchConversations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setCurrentUserId(user.id);

            // Fetch rooms where I am the influencer
            // Also fetch the brand details (partner)
            const { data: rooms, error } = await supabase
                .from('rooms')
                .select('*, brand:brand_id(*)')
                .eq('influencer_id', user.id);

            if (error) throw error;

            console.log('Rooms fetched:', rooms.length);

            // For each room, fetch the last message
            const roomsWithLastMsg = await Promise.all(rooms.map(async (room) => {
                const { data: msgs } = await supabase
                    .from('messages')
                    .select('*')
                    .eq('room_id', room.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                const lastMsg = msgs && msgs.length > 0 ? msgs[0] : null;

                return {
                    id: room.id,
                    name: room.brand?.full_name || room.brand?.email || 'Bilinmeyen Marka',
                    avatar: (room.brand?.full_name || 'B').substring(0, 2).toUpperCase(),
                    isBrand: true,
                    lastMessage: lastMsg ? lastMsg.content : 'Henüz mesaj yok.',
                    time: lastMsg ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                    unread: false, // Pending: implement unread logic
                    pinned: false
                };
            }));

            setConversations(roomsWithLastMsg);
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMessages = async (roomId) => {
        if (!roomId) return;
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true }); // Oldest first

            if (error) throw error;

            setMessages(prev => ({
                ...prev,
                [roomId]: data.map(m => ({
                    id: m.id,
                    text: m.content,
                    sender: m.sender_id === currentUserId ? 'me' : 'them',
                    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }))
            }));
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const subscribeToMessages = (roomId) => {
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
        }

        subscriptionRef.current = supabase
            .channel(`room:${roomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `room_id=eq.${roomId}`
            }, (payload) => {
                const newMsg = payload.new;
                setMessages(prev => ({
                    ...prev,
                    [roomId]: [...(prev[roomId] || []), {
                        id: newMsg.id,
                        text: newMsg.content,
                        sender: newMsg.sender_id === currentUserId ? 'me' : 'them',
                        time: new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }]
                }));
            })
            .subscribe();
    };

    const openChat = (chat) => {
        setSelectedChat(chat);
        setModalVisible(true);
        fetchMessages(chat.id);
        subscribeToMessages(chat.id);
    };

    const closeChat = () => {
        setModalVisible(false);
        setSelectedChat(null);
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }
        // Refresh conversations to update last message/time in the list
        fetchConversations();
    };

    const sendMessage = async () => {
        if (inputText.trim() === '' || !selectedChat || !currentUserId) return;

        const textToSend = inputText.trim();
        setInputText(''); // Clear immediately

        try {
            const { error } = await supabase
                .from('messages')
                .insert({
                    room_id: selectedChat.id,
                    sender_id: currentUserId,
                    content: textToSend
                });

            if (error) throw error;
            // The subscription will handle adding it to the list
        } catch (error) {
            Alert.alert('Hata', 'Mesaj gönderilemedi.');
            console.error(error);
            setInputText(textToSend); // Restore text on error
        }
    };

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 border-b border-white/5 bg-midnight">
                    <Text className="text-white text-3xl font-bold mb-6">Mesajlar</Text>
                    <View className="h-10 bg-surface border border-white/10 rounded-xl flex-row items-center px-4">
                        <Search color="#6B7280" size={18} />
                        <TextInput
                            placeholder="Mesajlarda ara..."
                            placeholderTextColor="#6B7280"
                            className="flex-1 ml-3 text-white text-sm"
                        />
                    </View>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {conversations.map((chat) => (
                        <TouchableOpacity
                            key={chat.id}
                            onPress={() => openChat(chat)}
                            className={`flex-row items-center px-6 py-4 border-b border-white/5 ${chat.pinned ? 'bg-soft-gold/5' : ''}`}
                        >
                            <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 shadow-lg ${chat.pinned ? 'bg-soft-gold shadow-soft-gold/20' : 'bg-gray-700 border border-white/10'}`}>
                                <Text className={`font-bold text-lg ${chat.pinned ? 'text-midnight' : 'text-white'}`}>{chat.avatar}</Text>
                            </View>
                            <View className="flex-1">
                                <View className="flex-row justify-between mb-1">
                                    <View className="flex-row items-center">
                                        <Text className="text-white font-bold text-base mr-1">{chat.name}</Text>
                                        {chat.pinned && <Check className="ml-1" color="#D4AF37" size={12} />}
                                    </View>
                                    <View className="flex-row items-center">
                                        {chat.pinned && <Pin color="#D4AF37" size={10} className="mr-2" />}
                                        <Text className={`text-xs font-bold ${chat.unread ? 'text-soft-gold' : 'text-gray-500'}`}>{chat.time}</Text>
                                    </View>
                                </View>
                                <Text className={`${chat.unread ? 'text-white font-medium' : 'text-gray-500'} text-sm`} numberOfLines={1}>
                                    {chat.lastMessage}
                                </Text>
                            </View>
                            {chat.unread && (
                                <View className="w-2 h-2 bg-soft-gold rounded-full ml-2" />
                            )}
                        </TouchableOpacity>
                    ))}

                    {conversations.length === 0 && (
                        <View className="flex-1 items-center justify-center mt-20">
                            <Text className="text-gray-500">Henüz mesajınız yok.</Text>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* Chat Detail Modal */}
            <Modal
                animationType="slide"
                visible={modalVisible}
                onRequestClose={closeChat}
                presentationStyle="pageSheet" // iOS standard
            >
                <View className="flex-1 bg-black">
                    {selectedChat && (
                        <KeyboardAvoidingView
                            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                            className="flex-1"
                        >
                            {/* Chat Header */}
                            <View className="px-4 py-4 border-b border-white/10 bg-midnight flex-row items-center pt-4">
                                <TouchableOpacity onPress={closeChat} className="mr-4">
                                    <ArrowLeft color="white" size={24} />
                                </TouchableOpacity>
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${selectedChat.pinned ? 'bg-soft-gold' : 'bg-gray-700'}`}>
                                        <Text className={`font-bold text-base ${selectedChat.pinned ? 'text-midnight' : 'text-white'}`}>{selectedChat.avatar}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-white font-bold text-base">{selectedChat.name}</Text>
                                        <Text className="text-gray-400 text-xs">Çevrimiçi</Text>
                                    </View>
                                </View>
                                <TouchableOpacity>
                                    <MoreVertical color="white" size={24} />
                                </TouchableOpacity>
                            </View>

                            {/* Messages Area */}
                            <ScrollView
                                className="flex-1 bg-black px-4 pt-4"
                                contentContainerStyle={{ paddingBottom: 20 }}
                            >
                                {/* Date Separator */}
                                <View className="items-center mb-6">
                                    <Text className="text-gray-500 text-xs font-bold uppercase">{selectedChat.time}</Text>
                                </View>

                                {messages[selectedChat.id]?.map((msg) => (
                                    <View
                                        key={msg.id}
                                        className={`mb-4 flex-row ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        {msg.sender !== 'me' && (
                                            <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 self-end mb-1 ${selectedChat.pinned ? 'bg-soft-gold' : 'bg-gray-700'}`}>
                                                <Text className={`text-xs font-bold ${selectedChat.pinned ? 'text-midnight' : 'text-white'}`}>{selectedChat.avatar}</Text>
                                            </View>
                                        )}
                                        <View className={`max-w-[75%] px-4 py-3 rounded-2xl ${msg.sender === 'me'
                                            ? 'bg-blue-600 rounded-tr-sm'
                                            : 'bg-surface border border-white/10 rounded-tl-sm'
                                            }`}>
                                            <Text className="text-white text-sm leading-5">{msg.text}</Text>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>

                            {/* Input Area */}
                            <View className="px-4 py-3 bg-surface border-t border-white/10 flex-row items-center pb-8">
                                <TextInput
                                    value={inputText}
                                    onChangeText={setInputText}
                                    placeholder="Mesaj yaz..."
                                    placeholderTextColor="#6B7280"
                                    className="flex-1 bg-black/40 text-white px-4 py-3 rounded-full border border-white/5 mr-3 max-h-24"
                                    multiline
                                />
                                {inputText.length > 0 ? (
                                    <TouchableOpacity
                                        onPress={sendMessage}
                                        className="w-10 h-10 bg-soft-gold rounded-full items-center justify-center transform hover:scale-105"
                                    >
                                        <Send color="#0F1014" size={20} fill="#0F1014" />
                                    </TouchableOpacity>
                                ) : (
                                    <View className="flex-row space-x-3">
                                        <TouchableOpacity>
                                            <ImagePlus color="#6B7280" size={24} />
                                        </TouchableOpacity>
                                        <TouchableOpacity>
                                            <Mic color="#6B7280" size={24} />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </KeyboardAvoidingView>
                    )}
                </View>
            </Modal>
        </View>
    );
}
