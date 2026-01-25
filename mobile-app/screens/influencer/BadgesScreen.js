import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Award, ChevronLeft } from 'lucide-react-native';
import { influencerBadges, brandBadges, phaseConfig } from '../../constants/badges';
import BadgeCard from '../../components/badges/BadgeCard';
import BadgeToggle from '../../components/badges/BadgeToggle';
import BadgeProgressInfo from '../../components/badges/BadgeProgressInfo';

export default function BadgesScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('influencer');

    const badges = useMemo(() => {
        return activeTab === 'influencer' ? influencerBadges : brandBadges;
    }, [activeTab]);

    const badgesByPhase = useMemo(() => {
        const mvp = badges.filter((b) => b.phase === 'mvp');
        const v12 = badges.filter((b) => b.phase === 'v1.2');
        const v13 = badges.filter((b) => b.phase === 'v1.3');
        return { mvp, 'v1.2': v12, 'v1.3': v13 };
    }, [badges]);

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* MASTER BACKGROUND GRADIENTS */}
            <LinearGradient
                colors={['#1e1b4b', '#020617', '#020617']}
                className="absolute inset-0"
            />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px]" />

            <SafeAreaView className="flex-1">
                {/* Custom Header */}
                <View className="px-6 py-4 flex-row items-center z-10">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 items-center justify-center mr-4"
                    >
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Rozetler</Text>
                </View>

                <ScrollView
                    className="flex-1 px-6"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 40 }}
                >

                    {/* Page Header Card */}
                    <View className="relative overflow-hidden rounded-3xl border border-white/10 p-6 mb-8 mt-2 shadow-sm shadow-soft-gold/20">
                        <LinearGradient
                            colors={['#151621', '#0C0D10']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="absolute inset-0"
                        />

                        <View className="mb-4 flex-row items-center gap-2 self-start rounded-full border border-soft-gold/30 bg-soft-gold/10 px-4 py-2">
                            <Award size={14} color="#D4AF37" />
                            <Text className="text-xs uppercase tracking-widest text-soft-gold font-bold">ROZETLER</Text>
                        </View>

                        <Text className="mt-2 text-3xl font-bold text-white leading-9">
                            Başarılarınızı{' '}
                            <Text className="text-soft-gold">Sergileyin</Text>
                        </Text>

                        <Text className="mt-4 text-sm leading-6 text-gray-300">
                            Platform üzerindeki başarılarınızı ve güvenilirliğinizi rozetlerle kanıtlayın.
                            Her rozet size özel ayrıcalıklar ve görünürlük kazandırır.
                        </Text>
                    </View>

                    {/* Toggle Switch */}
                    <View className="mb-8">
                        <BadgeToggle activeTab={activeTab} onTabChange={setActiveTab} />
                    </View>

                    {/* Badges Listing by Phase */}
                    <View className="space-y-8">
                        {['mvp', 'v1.2', 'v1.3'].map((phase) => {
                            const phaseBadges = badgesByPhase[phase];
                            if (phaseBadges.length === 0) return null;

                            const config = phaseConfig[phase];

                            return (
                                <View
                                    key={`${activeTab}-${phase}`}
                                    className={`rounded-3xl border ${config.borderColor} ${config.bgColor} p-6`}
                                >
                                    <View className="mb-6 flex-row items-center gap-3">
                                        <LinearGradient
                                            colors={
                                                phase === 'mvp' ? ['#f59e0b', 'transparent'] :
                                                    phase === 'v1.2' ? ['#64748b', 'transparent'] :
                                                        ['#a855f7', 'transparent']
                                            }
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 0 }}
                                            style={{ height: 4, width: 48, borderRadius: 2 }}
                                        />
                                        <Text className={`text-xl font-bold ${config.textColor}`}>
                                            {config.label}
                                        </Text>
                                    </View>

                                    <View>
                                        {phaseBadges.map((badge) => (
                                            <BadgeCard key={badge.id} badge={badge} phase={phase} />
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </View>

                    {/* Progress Info */}
                    <BadgeProgressInfo userRole="influencer" />

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
