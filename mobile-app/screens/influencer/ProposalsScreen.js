import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Clock, CheckCircle2, XCircle, ChevronRight, FileText, Briefcase } from 'lucide-react-native';

export default function ProposalsScreen() {
    const [activeTab, setActiveTab] = useState('projects'); // projects (Marka Projeleri), applications (Başvurularım)

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 border-b border-white/5 bg-midnight">
                    <Text className="text-white text-3xl font-bold mb-2">İlanlar</Text>
                    <Text className="text-gray-400 text-xs mb-6">Açık iş birliklerini incele ve başvur.</Text>

                    {/* Tabs */}
                    <View className="flex-row bg-surface border border-white/10 rounded-xl p-1">
                        <TouchableOpacity
                            onPress={() => setActiveTab('projects')}
                            className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'projects' ? 'bg-soft-gold' : 'transparent'}`}
                        >
                            <Text className={`text-xs font-bold ${activeTab === 'projects' ? 'text-midnight' : 'text-gray-400'}`}>Marka Projeleri</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('applications')}
                            className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'applications' ? 'bg-soft-gold' : 'transparent'}`}
                        >
                            <Text className={`text-xs font-bold ${activeTab === 'applications' ? 'text-midnight' : 'text-gray-400'}`}>Başvurularım</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

                    {/* Marka Projeleri (Open Projects) */}
                    {activeTab === 'projects' && (
                        <View className="space-y-4">
                            {[1, 2, 3].map((item) => (
                                <View key={item} className="bg-surface p-4 rounded-3xl border border-white/10 mb-4 shadow-lg shadow-black/30">
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3">
                                                <Text className="font-bold text-black">LC</Text>
                                            </View>
                                            <View>
                                                <Text className="text-white font-bold text-base">LC Waikiki</Text>
                                                <Text className="text-gray-500 text-xs">Moda • İstanbul</Text>
                                            </View>
                                        </View>
                                        <View className="bg-soft-gold/10 px-2 py-1 rounded border border-soft-gold/30">
                                            <Text className="text-soft-gold text-[10px] font-bold">YENİ</Text>
                                        </View>
                                    </View>

                                    <Text className="text-white font-bold text-lg mb-1">Kış Koleksiyonu Reels</Text>
                                    <Text className="text-gray-400 text-sm mb-4 leading-5" numberOfLines={2}>
                                        Yeni sezon kış ürünlerimizi tanıtacak, enerjik ve stil sahibi Reels içerikleri arıyoruz.
                                    </Text>

                                    <View className="flex-row justify-between items-center pt-3 border-t border-white/5">
                                        <Text className="text-soft-gold font-bold text-lg">₺5.000 - ₺10.000</Text>
                                        <TouchableOpacity className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                                            <Text className="text-white text-xs font-bold">Detaylar</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Başvurularım (My Applications) */}
                    {activeTab === 'applications' && (
                        <View className="space-y-4">
                            <View className="bg-surface p-4 rounded-2xl border border-white/10">
                                <View className="flex-row justify-between mb-2">
                                    <Text className="text-white font-bold text-lg">Trendyol Yaz Kampanyası</Text>
                                    <View className="bg-yellow-500/20 px-2 py-1 rounded text-yellow-500 text-[10px] font-bold border border-yellow-500/20">
                                        <Text className="text-yellow-500 text-[10px] font-bold">BEKLİYOR</Text>
                                    </View>
                                </View>
                                <Text className="text-gray-400 text-xs mb-3">Başvuru Tarihi: 08 Ocak 2026</Text>
                                <View className="flex-row justify-between items-center border-t border-white/5 pt-3">
                                    <Text className="text-soft-gold font-bold">₺12.500</Text>
                                    <View className="flex-row items-center space-x-1">
                                        <Text className="text-gray-500 text-xs text-right">Teklifiniz</Text>
                                    </View>
                                </View>
                            </View>

                            <View className="items-center justify-center py-10 opacity-50">
                                <Text className="text-gray-600 text-center text-xs">Daha fazla başvuru bulunamadı.</Text>
                            </View>
                        </View>
                    )}

                    <View className="h-24" />
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
