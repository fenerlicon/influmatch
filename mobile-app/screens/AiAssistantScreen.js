import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Sparkles, Send, Bot, MessageSquare, Zap } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function AiAssistantScreen({ navigation }) {
    const [messages, setMessages] = useState([
        { id: 1, text: "Merhaba! Ben Influmatch AI Asistanı. Etkileşimlerini yorumlamak, içerik önerileri almak veya profilin hakkında konuşmak için buradayım. Sana nasıl yardımcı olabilirim?", sender: 'ai' }
    ]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(false);

    // Mock AI Response function
    const generateAiResponse = async (userMessage) => {
        setLoading(true);
        // Simulate network delay
        setTimeout(() => {
            let reply = "Bunu anladım. Profilini analiz ediyorum...";

            const lowerMsg = userMessage.toLowerCase();
            if (lowerMsg.includes('etkileşim')) {
                reply = "Son gönderilerindeki etkileşim oranların sektör ortalamasının %15 üzerinde. Özellikle Reels videoların, statik postlara göre 2.5 kat daha fazla yorum alıyor. Video içeriğe ağırlık vermeni öneririm.";
            } else if (lowerMsg.includes('içerik')) {
                reply = "Takipçi kitlen 'Teknoloji' ve 'Lifestyle' kategorilerine ilgi duyuyor. 'Bir Günüm Nasıl Geçiyor' vlogları veya 'Ürün İnceleme' videoları yüksek potansiyel taşıyor. Önümüzdeki hafta için 2 Reels fikri oluşturabilirim.";
            } else if (lowerMsg.includes('analiz')) {
                reply = "Profilin genel olarak güven verici. Biyografin net, öne çıkanlar düzenli. Ancak son 3 gönderinde hashtag kullanımın biraz düşük kalmış. #teknoloji #inceleme gibi niş etiketleri artırarak keşfette çıkma şansını yükseltebilirsin.";
            } else {
                reply = "Şu an profil verilerini tarıyorum. Bu konuda size özel bir strateji geliştirebilirim. Lütfen daha spesifik bir soru sorabilir misiniz? Örneğin: 'Etkileşimimi nasıl artırırım?'";
            }

            setMessages(prev => [...prev, { id: Date.now(), text: reply, sender: 'ai' }]);
            setLoading(false);
        }, 1500);
    };

    const sendMessage = () => {
        if (!inputText.trim()) return;

        const userMsg = { id: Date.now(), text: inputText, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = inputText;
        setInputText('');

        generateAiResponse(currentInput);
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between border-b border-white/5 bg-[#020617]/80 backdrop-blur-md z-10">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-white text-lg font-bold">AI Asistan</Text>
                        <View className="flex-row items-center">
                            <View className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                            <Text className="text-green-500 text-[10px] font-bold uppercase tracking-wider">Çevrimiçi</Text>
                        </View>
                    </View>
                    <View className="w-10" />
                </View>

                {/* Chat Area */}
                <ScrollView
                    className="flex-1 px-4 py-4"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    ref={ref => ref?.scrollToEnd({ animated: true })}
                >
                    {messages.map((msg) => (
                        <View key={msg.id} className={`flex-row mb-6 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'ai' && (
                                <View className="w-8 h-8 rounded-full bg-soft-gold items-center justify-center mr-3 mt-1 shadow-[0_0_10px_rgba(212,175,55,0.5)]">
                                    <Sparkles color="black" size={16} />
                                </View>
                            )}

                            <View className={`max-w-[80%] p-4 rounded-2xl ${msg.sender === 'user' ? 'bg-blue-600 rounded-tr-none' : 'bg-[#15171e] rounded-tl-none border border-white/10'}`}>
                                <Text className="text-white leading-6 text-sm">
                                    {msg.text}
                                </Text>
                            </View>
                        </View>
                    ))}

                    {loading && (
                        <View className="flex-row mb-6 justify-start">
                            <View className="w-8 h-8 rounded-full bg-soft-gold items-center justify-center mr-3 mt-1">
                                <Sparkles color="black" size={16} />
                            </View>
                            <View className="bg-[#15171e] p-4 rounded-2xl rounded-tl-none border border-white/10 flex-row items-center space-x-2">
                                <View className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                                <View className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-75" />
                                <View className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150" />
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Input Area */}
                <View className="p-4 bg-[#0B0F19] border-t border-white/10">
                    {/* Quick Prompts */}
                    {messages.length < 3 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                            {[
                                { text: "Etkileşim analizi yap", icon: Zap },
                                { text: "İçerik önerisi ver", icon: MessageSquare },
                                { text: "Profilimi değerlendir", icon: Bot },
                            ].map((prompt, i) => (
                                <TouchableOpacity
                                    key={i}
                                    onPress={() => { setInputText(prompt.text); sendMessage(); }}
                                    className="bg-white/5 mr-2 px-4 py-2 rounded-full border border-white/10 flex-row items-center"
                                >
                                    <prompt.icon color="#D4AF37" size={12} className="mr-2" />
                                    <Text className="text-gray-300 text-xs font-medium">{prompt.text}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <View className="flex-row items-center bg-[#15171e] rounded-[24px] border border-white/10 px-4 py-2">
                        <TextInput
                            className="flex-1 text-white h-10 font-medium"
                            placeholder="Bir şeyler sor..."
                            placeholderTextColor="#6B7280"
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={sendMessage}
                        />
                        <TouchableOpacity
                            onPress={sendMessage}
                            disabled={!inputText.trim() || loading}
                            className={`w-10 h-10 rounded-full items-center justify-center ml-2 ${!inputText.trim() ? 'bg-white/5' : 'bg-soft-gold shadow-lg shadow-soft-gold/20'}`}
                        >
                            <Send color={!inputText.trim() ? '#6B7280' : '#000'} size={18} className={!inputText.trim() ? '' : 'ml-0.5'} />
                        </TouchableOpacity>
                    </View>
                </View>

            </SafeAreaView>
        </View>
    );
}
