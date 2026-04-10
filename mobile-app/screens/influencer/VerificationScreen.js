import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ShieldCheck, CheckCircle2, Clock, AlertCircle, Instagram, Sparkles, TrendingUp, ArrowRight } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// --- Design System ---
const GlassCard = ({ children, className, style }) => (
    <View className={`rounded-[32px] overflow-hidden border border-white/10 relative ${className}`} style={style}>
        <LinearGradient 
            colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)']} 
            start={{ x: 0, y: 0 }} 
            end={{ x: 1, y: 1 }} 
            className="absolute inset-0" 
        />
        {children}
    </View>
);

const StatusBadge = ({ verified }) => (
    <View className={`px-4 py-1.5 rounded-full flex-row items-center gap-2 ${verified ? 'bg-green-500/20 border border-green-500/30' : 'bg-amber-500/20 border border-amber-500/30'}`}>
        <View className={`w-2 h-2 rounded-full ${verified ? 'bg-green-500' : 'bg-amber-500'}`} />
        <Text className={`text-[10px] font-bold uppercase tracking-widest ${verified ? 'text-green-400' : 'text-amber-400'}`}>
            {verified ? 'HESAP DOĞRULANDI' : 'HESAP ONAYI BEKLENİYOR'}
        </Text>
    </View>
);

export default function VerificationScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [socialStats, setSocialStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchVerificationStatus();
        }, [])
    );

    const fetchVerificationStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: userData }, { data: socialData }] = await Promise.all([
                supabase.from('users').select('full_name, verification_status').eq('id', user.id).single(),
                supabase.from('social_accounts').select('*').eq('user_id', user.id).eq('platform', 'instagram').maybeSingle()
            ]);

            setProfile(userData);
            setSocialStats(socialData);
        } catch (e) {
            console.error('[VerificationScreen] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <ActivityIndicator color="#fbbf24" size="large" />
            </View>
        );
    }

    const isVerified = profile?.verification_status === 'verified';

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-[10%] -right-20 w-80 h-80 bg-amber-500/5 rounded-full blur-[100px]" />
            <View className="absolute top-[40%] -left-20 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px]" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center border-b border-white/5">
                    <TouchableOpacity 
                        onPress={() => navigation.goBack()} 
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 mr-4"
                    >
                        <ChevronLeft color="white" size={22} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Hesap Doğrulama</Text>
                </View>

                <ScrollView 
                    className="flex-1 px-6" 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 60, paddingTop: 24 }}
                >
                    {/* Status Section */}
                    <GlassCard className="p-8 items-center border-white/5 mb-8">
                        <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 shadow-2xl ${isVerified ? 'bg-green-500/20' : 'bg-amber-500/20'}`}>
                            {isVerified ? (
                                <ShieldCheck color="#4ade80" size={42} />
                            ) : (
                                <Clock color="#fbbf24" size={42} />
                            )}
                        </View>
                        
                        <StatusBadge verified={isVerified} />
                        
                        <Text className="text-white text-2xl font-bold mt-6 mb-2 text-center">
                            {isVerified ? 'Mavi Tik Rozetiniz Aktif!' : 'Doğrulama Gerekli'}
                        </Text>
                        <Text className="text-gray-400 text-sm text-center leading-5 px-4">
                            {isVerified 
                                ? 'Hesabınız başarılı bir şekilde doğrulandı. Artık markalar için güvenilir bir partnersiniz.' 
                                : 'Vitrinde öne çıkmak ve markalarla işbirliği yapmak için hesabınızı doğrulamanız gerekiyor.'}
                        </Text>
                    </GlassCard>

                    {/* How to get verified guide */}
                    {!isVerified && (
                        <View>
                            <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-6 ml-1">DOĞRULAMA REHBERİ</Text>
                            
                            <GlassCard className="p-6 mb-4 border-white/5">
                                <View className="flex-row items-start gap-4">
                                    <View className="w-10 h-10 bg-purple-500/20 rounded-2xl items-center justify-center border border-purple-500/30">
                                        <Instagram color="#a855f7" size={20} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-bold text-base mb-1">Sosyal Medya Bağlantısı</Text>
                                        <Text className="text-gray-400 text-xs leading-5">
                                            Instagram hesabınızı profilinizden bağladığınızda sistemimiz hesabınızı otomatik olarak inceler.
                                        </Text>
                                    </View>
                                </View>
                            </GlassCard>

                            <GlassCard className="p-6 mb-4 border-white/5">
                                <View className="flex-row items-start gap-4">
                                    <View className="w-10 h-10 bg-blue-500/20 rounded-2xl items-center justify-center border border-blue-500/30">
                                        <TrendingUp color="#3b82f6" size={20} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-bold text-base mb-1">Kaliteli Etkileşim</Text>
                                        <Text className="text-gray-400 text-xs leading-5">
                                            Hesabınızın gerçek takipçilere ve sağlıklı bir etkileşim oranına sahip olduğundan emin olun.
                                        </Text>
                                    </View>
                                </View>
                            </GlassCard>

                            <GlassCard className="p-6 mb-10 border-white/5">
                                <View className="flex-row items-start gap-4">
                                    <View className="w-10 h-10 bg-amber-500/20 rounded-2xl items-center justify-center border border-amber-500/30">
                                        <Sparkles color="#fbbf24" size={20} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-bold text-base mb-1">Profil Doluluğu</Text>
                                        <Text className="text-gray-400 text-xs leading-5">
                                            Profil fotoğrafınızın, biyografinizin ve ilgi alanlarınızın güncel olduğundan emin olun.
                                        </Text>
                                    </View>
                                </View>
                            </GlassCard>

                            {/* Action Button */}
                            <TouchableOpacity 
                                activeOpacity={0.9}
                                onPress={() => navigation.navigate('MyProfile')}
                                className="bg-amber-400 h-16 rounded-[22px] flex-row items-center justify-center shadow-lg shadow-amber-400/20"
                            >
                                <Instagram color="black" size={24} strokeWidth={2.5} className="mr-3" />
                                <Text className="text-black font-bold text-lg">Hesabını Şimdi Bağla</Text>
                                <ArrowRight color="black" size={20} strokeWidth={3} className="ml-3" />
                            </TouchableOpacity>
                            
                            <Text className="text-gray-600 text-[10px] text-center mt-5 mb-8 italic">
                                * Hiçbir şekilde kimlik belgesi veya pasaport fotoğrafı talep edilmez.
                            </Text>
                        </View>
                    )}

                    {isVerified && (
                        <View className="mt-4">
                            <View className="bg-green-500/5 border border-green-500/20 rounded-3xl p-6 flex-row items-center gap-4">
                                <ShieldCheck color="#4ade80" size={32} />
                                <View className="flex-1">
                                    <Text className="text-white font-bold text-base">Yüksek Güven Puanı</Text>
                                    <Text className="text-gray-500 text-xs mt-1">Doğrulanmış hesabınız ile markaların %85 daha fazla dikkatini çekiyorsunuz.</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
