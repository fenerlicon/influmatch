import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, Users, Activity, Zap, CheckCircle2, ChevronRight, ArrowLeft, BarChart3, PieChart, Info } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// --- REUSABLE GLASS CARD ---
const GlassCard = ({ children, className, style, onPress, activeOpacity = 0.9 }) => (
    <TouchableOpacity
        activeOpacity={onPress ? activeOpacity : 1}
        onPress={onPress}
        style={style}
        className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`}
    >
        <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </TouchableOpacity>
);

const AnalysisScreen = ({ navigation, route }) => {
    // Get params
    const { score = 0, socialStats, profile } = route.params || {};

    const engagementRate = socialStats?.engagement_rate ? parseFloat(socialStats.engagement_rate) : 0;
    const followerCount = socialStats?.follower_count ? (socialStats.follower_count / 1000).toFixed(1) + 'K' : '0';

    // Determining Score Label
    let scoreLabel = 'Geliştirilmeli';
    if (score > 40) scoreLabel = 'İyi';
    if (score > 70) scoreLabel = 'Harika';
    if (score > 85) scoreLabel = 'Mükemmel';

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* MASTER BACKGROUND GRADIENTS */}
            <LinearGradient
                colors={['#1e1b4b', '#020617', '#020617']}
                className="absolute inset-0"
            />
            <View className="absolute top-0 right-0 w-96 h-96 bg-soft-gold/10 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-12 h-12 bg-white/5 rounded-full items-center justify-center border border-white/10"
                    >
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white font-black text-xl tracking-tight">ANALİZ MERKEZİ</Text>
                    <View className="w-12" />
                </View>

                <ScrollView className="flex-1 px-6 pt-2" showsVerticalScrollIndicator={false}>

                    {/* Score Card - Hero Section */}
                    <View className="relative mb-8 mt-2">
                        {/* Glow effect behind the circle */}
                        <View className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-soft-gold/20 rounded-full blur-[60px] opacity-${Math.min(score, 100) / 100}`} />

                        <GlassCard className="p-8 items-center !rounded-[40px] !border-soft-gold/20 bg-soft-gold/[0.03]">
                            <Text className="text-soft-gold/80 font-bold uppercase tracking-[0.2em] text-[10px] mb-6">GENEL PERFORMANS SKORU</Text>

                            <View className="w-40 h-40 items-center justify-center relative mb-6">
                                {/* Outer Ring */}
                                <View className="absolute inset-0 rounded-full border-[12px] border-white/5" />
                                {/* Progress Ring */}
                                <View className="absolute inset-0 rounded-full border-[12px] border-soft-gold border-l-transparent border-b-transparent transform rotate-45 opacity-80" />

                                <View className="items-center">
                                    <Text className="text-white text-6xl font-black tracking-tighter" style={{ textShadowColor: 'rgba(212, 175, 55, 0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 }}>{score}</Text>
                                    <Text className="text-gray-400 text-[10px] font-bold tracking-widest uppercase mt-1">{scoreLabel}</Text>
                                </View>
                            </View>

                            <View className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 flex-row items-center">
                                <TrendingUp size={14} color="#4ade80" className="mr-2" />
                                <Text className="text-gray-300 text-xs font-medium">Bu hafta skorunuz <Text className="text-green-400 font-bold">sabit kaldı</Text></Text>
                            </View>
                        </GlassCard>
                    </View>

                    {/* Stats Grid */}
                    <View className="flex-row justify-between mb-8">
                        <GlassCard className="w-[48%] p-5 !rounded-[28px] !border-purple-500/20 bg-purple-500/[0.03]">
                            <View className="w-10 h-10 bg-purple-500/20 rounded-xl items-center justify-center mb-4 shadow-lg shadow-purple-500/20">
                                <Users color="#d8b4fe" size={20} />
                            </View>
                            <Text className="text-gray-400 text-[10px] font-bold mb-1 tracking-wider uppercase">TAKİPÇİLER</Text>
                            <Text className="text-white text-2xl font-black tracking-tight">{followerCount}</Text>
                            <View className="flex-row items-center mt-2">
                                <View className="bg-white/5 px-1.5 py-0.5 rounded">
                                    <Text className="text-gray-400 text-[9px] font-bold">Toplam</Text>
                                </View>
                            </View>
                        </GlassCard>

                        <GlassCard className="w-[48%] p-5 !rounded-[28px] !border-blue-500/20 bg-blue-500/[0.03]">
                            <View className="w-10 h-10 bg-blue-500/20 rounded-xl items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                                <Activity color="#93c5fd" size={20} />
                            </View>
                            <Text className="text-gray-400 text-[10px] font-bold mb-1 tracking-wider uppercase">ETKİLEŞİM ORANI</Text>
                            <Text className="text-white text-2xl font-black tracking-tight">%{engagementRate}</Text>
                            <View className="flex-row items-center mt-2">
                                <View className={`px-1.5 py-0.5 rounded ${engagementRate > 1 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                    <Text className={`${engagementRate > 1 ? 'text-green-400' : 'text-red-400'} text-[9px] font-bold`}>
                                        {engagementRate > 4 ? 'Yüksek' : engagementRate > 1 ? 'Normal' : 'Düşük'}
                                    </Text>
                                </View>
                            </View>
                        </GlassCard>
                    </View>

                    {/* AI Insights - Premium List */}
                    <View className="flex-row items-center mb-5 space-x-2">
                        <Zap color="#D4AF37" size={20} fill="#D4AF37" />
                        <Text className="text-white font-bold text-xl tracking-tight">Yapay Zeka Önerileri</Text>
                    </View>

                    <View className="mb-10 space-y-4">
                        {[
                            { title: 'Reels Etkileşimi', desc: 'Video içeriklerin fotoğraflara göre %40 daha fazla erişim alıyor. Haftada en az 3 Reels paylaş.', icon: BarChart3, color: '#D4AF37', accent: 'bg-yellow-500/10' },
                            { title: 'Kitle Analizi', desc: 'Takipçilerin en çok akşam saatlerinde aktif. Paylaşımlarını 20:00 sonrasına kaydır.', icon: Users, color: '#A855F7', accent: 'bg-purple-500/10' },
                            { title: 'Profil Optimizasyonu', desc: 'Biyografine "Harekete Geçirici Mesaj" (Call to Action) eklemen dönüşümleri artırabilir.', icon: CheckCircle2, color: '#10B981', accent: 'bg-green-500/10' }
                        ].map((item, index) => (
                            <GlassCard key={index} className="p-5 flex-row items-start !rounded-[24px]">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.accent} border border-white/5`}>
                                    <item.icon color={item.color} size={22} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-base mb-1">{item.title}</Text>
                                    <Text className="text-gray-400 text-xs leading-5 font-medium">{item.desc}</Text>
                                </View>
                            </GlassCard>
                        ))}
                    </View>

                    <TouchableOpacity className="w-full bg-white/5 h-14 rounded-2xl border border-white/10 items-center justify-center mb-10">
                        <Text className="text-gray-400 font-bold text-xs uppercase tracking-widest">Tüm Raporu İndir (PDF)</Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default AnalysisScreen;
