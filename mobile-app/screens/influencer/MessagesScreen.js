import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, ChevronRight } from 'lucide-react-native';

export default function MessagesScreen() {
    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 border-b border-white/5 bg-midnight">
                    <Text className="text-white text-3xl font-bold mb-6">Mesajlar</Text>
                    <View className="h-10 bg-surface border border-white/10 rounded-xl flex-row items-center px-4">
                        <Search color="#6B7280" size={18} />
                        <Text className="text-gray-500 ml-3 text-sm">Mesajlarda ara...</Text>
                    </View>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    {/* Admin Message (Pinned) */}
                    <TouchableOpacity className="flex-row items-center px-6 py-4 bg-soft-gold/5 border-b border-white/5">
                        <View className="w-12 h-12 rounded-full bg-soft-gold items-center justify-center mr-4 shadow-lg shadow-soft-gold/20">
                            <Text className="text-midnight font-bold text-lg">IM</Text>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row justify-between mb-1">
                                <Text className="text-white font-bold text-base">Influmatch Destek</Text>
                                <Text className="text-soft-gold text-xs font-bold">12:30</Text>
                            </View>
                            <Text className="text-gray-300 text-sm" numberOfLines={1}>Hoş geldin! Profilini tamamlayarak rozet kazanabilirsin.</Text>
                        </View>
                        {/* Unread Badge */}
                        <View className="w-2 h-2 bg-soft-gold rounded-full ml-2" />
                    </TouchableOpacity>

                    {/* Example Brand Message */}
                    <TouchableOpacity className="flex-row items-center px-6 py-4 border-b border-white/5">
                        <View className="w-12 h-12 rounded-full bg-gray-700 items-center justify-center mr-4 border border-white/10">
                            <Text className="text-white font-bold text-lg">LC</Text>
                        </View>
                        <View className="flex-1">
                            <View className="flex-row justify-between mb-1">
                                <Text className="text-white font-bold text-base">LC Waikiki</Text>
                                <Text className="text-gray-500 text-xs">Dün</Text>
                            </View>
                            <Text className="text-gray-500 text-sm" numberOfLines={1}>Kampanya detaylarını ilettim, dönüşünü bekliyoruz.</Text>
                        </View>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
