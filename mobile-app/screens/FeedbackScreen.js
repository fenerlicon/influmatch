import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, MessageSquare, Send } from 'lucide-react-native';
import { apiRequest } from '../lib/api';

const { width } = Dimensions.get('window');

export default function FeedbackScreen({ navigation }) {
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState(5);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Hata', 'Lütfen bir mesaj yazın.');
            return;
        }

        // Web ile aynı sunucu kodu (lib/feedback.ts): admin panelindeki geri bildirim listesine düşer.
        setLoading(true);
        const description = rating ? `[Mobil · ${rating}/5] ${message.trim()}` : `[Mobil] ${message.trim()}`;
        const result = await apiRequest('feedback', { method: 'POST', body: { description } });
        setLoading(false);
        if (!result.success) {
            Alert.alert('Hata', result.error || 'Geri bildirim gönderilemedi. Lütfen tekrar deneyin.');
            return;
        }
        Alert.alert('Teşekkürler', 'Geri bildiriminiz başarıyla gönderildi.');
        navigation.goBack();
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Geri Bildirim</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

                    <View className="items-center mb-8">
                        <View className="w-20 h-20 bg-blue-500/20 rounded-full items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                            <MessageSquare color="#60a5fa" size={40} />
                        </View>
                        <Text className="text-white font-bold text-2xl text-center mb-2">Fikirlerinizi Önemsiyoruz</Text>
                        <Text className="text-gray-400 text-center text-sm leading-6">
                            Uygulamayı geliştirmemize yardımcı olmak için hata bildirebilir veya öneride bulunabilirsiniz.
                        </Text>
                    </View>

                    <View className="bg-[#15171e] p-6 rounded-[24px] border border-white/10 mb-6">
                        <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">MESAJINIZ</Text>
                        <TextInput
                            className="bg-black/20 text-white p-4 rounded-xl border border-white/5 h-40 mb-4"
                            placeholder="Neyi geliştirebiliriz?"
                            placeholderTextColor="#4B5563"
                            multiline
                            textAlignVertical="top"
                            value={message}
                            onChangeText={setMessage}
                        />

                        <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-4">PUANINIZ</Text>
                        <View className="flex-row justify-between mb-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => setRating(star)}
                                    className={`w-12 h-12 rounded-xl items-center justify-center border ${rating >= star ? 'bg-soft-gold/20 border-soft-gold' : 'bg-white/5 border-white/10'}`}
                                >
                                    <Text className={`font-bold text-lg ${rating >= star ? 'text-soft-gold' : 'text-gray-500'}`}>{star}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={loading}
                        className="w-full bg-soft-gold h-14 rounded-2xl items-center justify-center flex-row shadow-lg shadow-soft-gold/20"
                    >
                        {loading ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <>
                                <Text className="text-black font-bold text-base mr-2">GÖNDER</Text>
                                <Send color="black" size={18} />
                            </>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
