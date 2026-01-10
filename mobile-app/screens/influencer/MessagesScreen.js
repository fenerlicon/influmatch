import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, ChevronRight, Check, Pin, ArrowLeft, MoreVertical, Send, ImagePlus, Mic } from 'lucide-react-native';

export default function MessagesScreen() {
    const [selectedChat, setSelectedChat] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [inputText, setInputText] = useState('');
    const [messages, setMessages] = useState({}); // Messages keyed by chat ID

    // Mock Conversations
    const conversations = [
        {
            id: 'support',
            name: 'Influmatch Destek',
            avatar: 'IM',
            isBrand: false,
            lastMessage: 'Hoş geldin! Profilini tamamlayarak rozet kazanabilirsin.',
            time: '12:30',
            unread: true,
            pinned: true,
            initialMessages: [
                { id: 1, text: 'Merhaba! Influmatch dünyasına hoş geldin. 🚀', sender: 'them', time: '12:28' },
                { id: 2, text: 'Hoş geldin! Profilini tamamlayarak rozet kazanabilirsin.', sender: 'them', time: '12:30' }
            ]
        },
        {
            id: 'lcwaikiki',
            name: 'LC Waikiki',
            avatar: 'LC',
            isBrand: true,
            lastMessage: 'Kampanya detaylarını ilettim, dönüşünü bekliyoruz.',
            time: 'Dün',
            unread: false,
            initialMessages: [
                { id: 1, text: 'Merhaba, son Instagram Reels paylaşımınızı çok beğendik.', sender: 'them', time: 'Dün 14:00' },
                { id: 2, text: 'Teşekkür ederim! 🙏 Yeni projeler için heyecanlıyım.', sender: 'me', time: 'Dün 14:05' },
                { id: 3, text: 'Harika! Kış koleksiyonumuz için bir iş birliği düşünüyoruz.', sender: 'them', time: 'Dün 14:10' },
                { id: 4, text: 'Kampanya detaylarını ilettim, dönüşünü bekliyoruz.', sender: 'them', time: 'Dün 14:11' }
            ]
        },
        {
            id: 'trendyol',
            name: 'Trendyol',
            avatar: 'TY',
            isBrand: true,
            lastMessage: 'Teklifiniz onaylandı! 🎉 İşlem adımlarını...',
            time: 'Paz',
            unread: true,
            initialMessages: [
                { id: 1, text: 'Yaz kampanyası başvurunuzu aldık.', sender: 'them', time: 'Paz 09:00' },
                { id: 2, text: 'Teklifiniz onaylandı! 🎉 İşlem adımlarını e-posta ile gönderdik.', sender: 'them', time: 'Paz 10:30' }
            ]
        }
    ];

    const openChat = (chat) => {
        setSelectedChat(chat);
        // Load messages for this chat if not already loaded, otherwise use initials
        if (!messages[chat.id]) {
            setMessages(prev => ({ ...prev, [chat.id]: chat.initialMessages }));
        }
        setModalVisible(true);
    };

    const closeChat = () => {
        setModalVisible(false);
        setSelectedChat(null);
    };

    const sendMessage = () => {
        if (inputText.trim() === '') return;

        const newMessage = {
            id: Date.now(),
            text: inputText,
            sender: 'me',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => ({
            ...prev,
            [selectedChat.id]: [...(prev[selectedChat.id] || []), newMessage]
        }));

        setInputText('');
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
