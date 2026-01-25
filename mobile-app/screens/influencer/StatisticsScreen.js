import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, BarChart2, TrendingUp, Users, Eye, Zap } from 'lucide-react-native';

const GlassCard = ({ children, className }) => (
    <View className={`rounded-[24px] border border-white/10 bg-white/[0.03] overflow-hidden relative ${className}`}>
        <LinearGradient colors={['rgba(255, 255, 255, 0.05)', 'transparent']} className="absolute inset-0" />
        {children}
    </View>
);

export default function StatisticsScreen({ navigation }) {
    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">İstatistikler</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

                    {/* Period Selector */}
                    <View className="flex-row bg-[#15171e] p-1 rounded-xl mb-6 border border-white/5">
                        <TouchableOpacity className="flex-1 py-2 items-center bg-white/10 rounded-lg">
                            <Text className="text-white font-bold text-xs">7 Gün</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 py-2 items-center">
                            <Text className="text-gray-500 font-bold text-xs">30 Gün</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 py-2 items-center">
                            <Text className="text-gray-500 font-bold text-xs">Tümü</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Main Chart Placeholder */}
                    <GlassCard className="h-64 mb-6 p-6 justify-between">
                        <View className="flex-row justify-between items-start">
                            <View>
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">PROFİL GÖRÜNTÜLENME</Text>
                                <Text className="text-white text-3xl font-black">1.284</Text>
                            </View>
                            <View className="bg-green-500/10 px-2 py-1 rounded border border-green-500/20 flex-row items-center">
                                <TrendingUp size={12} color="#4ade80" className="mr-1" />
                                <Text className="text-green-400 text-xs font-bold">%12</Text>
                            </View>
                        </View>

                        {/* Fake Chart Lines */}
                        <View className="flex-row items-end justify-between h-24 space-x-2">
                            {[40, 60, 45, 80, 55, 90, 70].map((h, i) => (
                                <View key={i} className="flex-1 bg-soft-gold rounded-t-sm opacity-50" style={{ height: `${h}%` }} />
                            ))}
                        </View>
                    </GlassCard>

                    {/* Grid Stats */}
                    <View className="flex-row flex-wrap justify-between">
                        <GlassCard className="w-[48%] p-4 mb-4">
                            <View className="w-10 h-10 rounded-full bg-purple-500/20 items-center justify-center mb-3">
                                <Users color="#d8b4fe" size={20} />
                            </View>
                            <Text className="text-gray-400 text-xs font-bold mb-1">YENİ TAKİPÇİ</Text>
                            <Text className="text-white text-2xl font-bold">+124</Text>
                        </GlassCard>

                        <GlassCard className="w-[48%] p-4 mb-4">
                            <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mb-3">
                                <Eye color="#93c5fd" size={20} />
                            </View>
                            <Text className="text-gray-400 text-xs font-bold mb-1">ERİŞİM</Text>
                            <Text className="text-white text-2xl font-bold">12.5K</Text>
                        </GlassCard>

                        <GlassCard className="w-full p-4 mb-4 flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-full bg-yellow-500/20 items-center justify-center mr-3">
                                    <Zap color="#fde047" size={20} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-base">Etkileşim Oranı</Text>
                                    <Text className="text-gray-400 text-xs">Sektör ortalamasının üzerinde</Text>
                                </View>
                            </View>
                            <Text className="text-soft-gold text-2xl font-bold">%4.8</Text>
                        </GlassCard>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
