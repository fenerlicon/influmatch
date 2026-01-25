import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
    User, Bell, Lock, HelpCircle, FileText, LogOut,
    ChevronRight, Moon, Shield, Mail, Smartphone, ArrowLeft
} from 'lucide-react-native';

const SettingItem = ({ icon: Icon, title, subtitle, onPress, hasSwitch, value, onValueChange, color = "#9CA3AF" }) => (
    <TouchableOpacity
        onPress={hasSwitch ? null : onPress}
        activeOpacity={hasSwitch ? 1 : 0.7}
        className="flex-row items-center justify-between py-4 border-b border-white/5"
    >
        <View className="flex-row items-center flex-1">
            <View className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center mr-4">
                <Icon color={color} size={20} />
            </View>
            <View className="flex-1">
                <Text className="text-white font-semibold text-base mb-0.5">{title}</Text>
                {subtitle && <Text className="text-gray-500 text-xs">{subtitle}</Text>}
            </View>
        </View>

        {hasSwitch ? (
            <Switch
                trackColor={{ false: "#374151", true: "#D4AF37" }}
                thumbColor={value ? "#FFFFFF" : "#9CA3AF"}
                onValueChange={onValueChange}
                value={value}
            />
        ) : (
            <ChevronRight color="#4B5563" size={20} />
        )}
    </TouchableOpacity>
);

const SectionHeader = ({ title }) => (
    <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mt-8 mb-2 ml-1">{title}</Text>
);

const SettingsScreen = ({ navigation }) => {
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [darkMode, setDarkMode] = useState(true);

    const handleLogout = async () => {
        Alert.alert(
            "Çıkış Yap",
            "Hesabınızdan çıkış yapmak istediğinize emin misiniz?",
            [
                { text: "Vazgeç", style: "cancel" },
                {
                    text: "Çıkış Yap",
                    style: "destructive",
                    onPress: async () => {
                        const { error } = await supabase.auth.signOut();
                        if (error) console.error('Sign out error', error);
                        // Navigation will be handled by App.js auth state listener or manual reset
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center border-b border-white/5">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 bg-[#1A1D24] rounded-full items-center justify-center border border-white/5 mr-4"
                    >
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white font-bold text-xl">Ayarlar</Text>
                </View>

                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>

                    <SectionHeader title="HESAP" />
                    <View className="bg-[#1A1D24] rounded-[24px] px-4 border border-white/5">
                        <SettingItem
                            icon={User}
                            title="Profil Bilgileri"
                            subtitle="Kişisel bilgilerinizi düzenleyin"
                            onPress={() => navigation.navigate('Profil')}
                        />
                        <SettingItem
                            icon={Lock}
                            title="Şifre ve Güvenlik"
                            subtitle="Şifrenizi güncelleyin"
                            onPress={() => { }}
                        />
                        <SettingItem
                            icon={Smartphone}
                            title="Bağlı Hesaplar"
                            subtitle="Instagram, TikTok bağlantıları"
                            onPress={() => { }}
                            color="#E1306C"
                        />
                    </View>

                    <SectionHeader title="TERCİHLER" />
                    <View className="bg-[#1A1D24] rounded-[24px] px-4 border border-white/5">
                        <SettingItem
                            icon={Bell}
                            title="Bildirimler"
                            subtitle="Uygulama bildirimlerini yönetin"
                            hasSwitch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                        />
                        <SettingItem
                            icon={Moon}
                            title="Karanlık Mod"
                            subtitle="Uygulama görünümü"
                            hasSwitch
                            value={darkMode}
                            onValueChange={setDarkMode}
                        />
                    </View>

                    <SectionHeader title="DESTEK" />
                    <View className="bg-[#1A1D24] rounded-[24px] px-4 border border-white/5">
                        <SettingItem
                            icon={HelpCircle}
                            title="Yardım Merkezi"
                            onPress={() => { }}
                        />
                        <SettingItem
                            icon={Mail}
                            title="Bize Ulaşın"
                            subtitle="support@influmatch.com"
                            onPress={() => { }}
                        />
                        <SettingItem
                            icon={FileText}
                            title="Kullanım Koşulları"
                            onPress={() => { }}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="mt-8 mb-12 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex-row items-center justify-center active:scale-95 duration-100"
                    >
                        <LogOut color="#EF4444" size={20} className="mr-2" />
                        <Text className="text-red-500 font-bold text-base">Çıkış Yap</Text>
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default SettingsScreen;
