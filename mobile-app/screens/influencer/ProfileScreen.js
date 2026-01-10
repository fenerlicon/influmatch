import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Settings, ChevronRight, Star, Award, ShieldCheck, User, LogOut } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen({ navigation }) {

    // Geçici Çıkış Logic'i (Tab Navigator'dan erişim için)
    const handleSignOut = async () => {
        await supabase.auth.signOut();
        // Navigation resetlenmeli ama şimdilik simple replace
        // App.js içinde auth durumu dinlendiği için otomatik atabilir
    };

    const MenuLink = ({ icon, title, subtitle, onPress }) => (
        <TouchableOpacity
            onPress={onPress}
            className="flex-row items-center bg-surface p-4 rounded-2xl border border-white/5 mb-3"
        >
            <View className="w-10 h-10 rounded-full bg-white/5 items-center justify-center mr-4">
                {icon}
            </View>
            <View className="flex-1">
                <Text className="text-white font-bold text-base">{title}</Text>
                {subtitle && <Text className="text-gray-500 text-xs">{subtitle}</Text>}
            </View>
            <ChevronRight color="#4B5563" size={20} />
        </TouchableOpacity>
    );

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

                    {/* Header Profile Card */}
                    <View className="items-center mb-8">
                        <View className="w-24 h-24 rounded-full bg-soft-gold items-center justify-center border-4 border-surface shadow-2xl shadow-soft-gold/20 mb-4">
                            <Text className="text-midnight font-bold text-2xl">AF</Text>
                        </View>
                        <Text className="text-white text-2xl font-bold">Arda Furkan</Text>
                        <Text className="text-soft-gold text-sm font-medium">@ardafurkan</Text>

                        {/* Stats Row */}
                        <View className="flex-row mt-6 space-x-4">
                            <View className="bg-surface px-6 py-3 rounded-2xl border border-white/10 items-center min-w-[100px]">
                                <Text className="text-white font-bold text-lg">12.5K</Text>
                                <Text className="text-gray-500 text-[10px] uppercase">Takipçi</Text>
                            </View>
                            <View className="bg-surface px-6 py-3 rounded-2xl border border-white/10 items-center min-w-[100px]">
                                <Text className="text-white font-bold text-lg">4.8</Text>
                                <Text className="text-gray-500 text-[10px] uppercase">Rating</Text>
                            </View>
                        </View>
                    </View>

                    {/* Menu Items */}
                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4 ml-1">Hesap & Özellikler</Text>

                    <MenuLink
                        icon={<User color="#D4AF37" size={20} />}
                        title="Profilim"
                        subtitle="Profilini düzenle ve görüntüle"
                        onPress={() => { }}
                    />

                    <MenuLink
                        icon={<Star color="#D4AF37" size={20} />}
                        title="Spotlight"
                        subtitle="Markalar arasında öne çık"
                        onPress={() => navigation.navigate('Spotlight')}
                    />

                    <MenuLink
                        icon={<Award color="#D4AF37" size={20} />}
                        title="Rozetler"
                        subtitle="Kazandığın başarımları gör"
                        onPress={() => navigation.navigate('Badges')}
                    />

                    <MenuLink
                        icon={<ShieldCheck color="#D4AF37" size={20} />}
                        title="Doğrulama"
                        subtitle="Hesabını onayla, güven oluştur"
                        onPress={() => { }}
                    />

                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-widest mt-6 mb-4 ml-1">Uygulama</Text>

                    <MenuLink
                        icon={<Settings color="white" size={20} />}
                        title="Ayarlar"
                        onPress={() => { }}
                    />

                    <TouchableOpacity
                        onPress={handleSignOut}
                        className="flex-row items-center bg-red-500/10 p-4 rounded-2xl border border-red-500/20 mb-10"
                    >
                        <View className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center mr-4">
                            <LogOut color="#EF4444" size={20} />
                        </View>
                        <Text className="text-red-500 font-bold text-base">Çıkış Yap</Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
