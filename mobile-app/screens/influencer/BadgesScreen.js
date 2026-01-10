import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Award, Lock } from 'lucide-react-native';

export default function BadgesScreen({ navigation }) {
    const badges = [
        { id: 1, name: 'Onaylı Hesap', description: 'Kimlik doğrulaması tamamlanmış hesap.', earned: true, icon: '🛡️' },
        { id: 2, name: 'Yükselen Yıldız', description: 'Son 30 günde yüksek etkileşim.', earned: true, icon: '⭐' },
        { id: 3, name: 'Güvenilir Partner', description: '5 başarılı işbirliği tamamla.', earned: false, icon: '🤝' },
        { id: 4, name: 'Mega Influencer', description: '100K+ takipçiye ulaş.', earned: false, icon: '👑' },
    ];

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center space-x-4 border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-white/10">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Rozetlerim</Text>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    <View className="flex-row flex-wrap justify-between">
                        {badges.map((badge) => (
                            <View key={badge.id} className={`w-[48%] mb-4 p-4 rounded-3xl border ${badge.earned ? 'bg-soft-gold/10 border-soft-gold/30' : 'bg-surface border-white/5 opacity-60'}`}>
                                <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${badge.earned ? 'bg-soft-gold/20' : 'bg-white/5'}`}>
                                    <Text className="text-2xl">{badge.icon}</Text>
                                </View>
                                <Text className={`font-bold mb-1 ${badge.earned ? 'text-white' : 'text-gray-400'}`}>{badge.name}</Text>
                                <Text className="text-gray-500 text-[10px] leading-3">{badge.description}</Text>
                                {!badge.earned && (
                                    <View className="absolute top-4 right-4">
                                        <Lock color="#6B7280" size={14} />
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
