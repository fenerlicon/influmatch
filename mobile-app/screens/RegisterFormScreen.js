import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, Lock, User, Briefcase, ChevronRight, Check, Eye, EyeOff } from 'lucide-react-native';

export default function RegisterFormScreen({ route, navigation }) {
    const { role } = route.params;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        isAgreed: false,
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const openLink = (url) => {
        Linking.openURL(url).catch(err => console.error("Could not load page", err));
    };

    async function handleRegister() {
        if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
            Alert.alert('Eksik Bilgi', 'Lütfen tüm zorunlu alanları doldurun.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            Alert.alert('Hata', 'Şifreler eşleşmiyor.');
            return;
        }

        if (!formData.isAgreed) {
            Alert.alert('Uyarı', 'Lütfen Kullanım Koşulları ve Gizlilik Politikasını kabul edin.');
            return;
        }

        setLoading(true);

        const { data: { user }, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.fullName,
                    role: role,
                }
            }
        });

        if (authError) {
            Alert.alert('Kayıt Başarısız', authError.message);
            setLoading(false);
            return;
        }

        if (user) {
            // Otomatik olarak doğrulama ekranına yönlendir
            navigation.navigate('VerifyEmail', { email: formData.email });
        }
        setLoading(false);
    }

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />

            {/* Üst Gradient */}
            <LinearGradient
                colors={['rgba(212, 175, 55, 0.05)', 'transparent']}
                className="absolute top-0 w-full h-32 pointer-events-none"
            />

            <SafeAreaView className="flex-1">

                {/* Header - Modern Minimalist */}
                <View className="px-6 pt-2 pb-6 border-b border-white/5 flex-row items-center justify-between">
                    <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/5"
                    >
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>

                    <View className="items-center">
                        <Text className="text-gray-400 text-xs font-medium uppercase tracking-widest mb-1">Hesap Oluştur</Text>
                        <Text className="text-white font-bold text-lg capitalize">{role === 'brand' ? 'Marka' : 'Influencer'} Kaydı</Text>
                    </View>

                    <View className="w-10" />
                </View>

                <ScrollView className="px-6 pt-8" contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

                    <View className="space-y-5">

                        {/* Ad Soyad / Marka Adı */}
                        <View className="space-y-2">
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">
                                {role === 'brand' ? 'Marka Adı' : 'Ad Soyad'}
                            </Text>
                            <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                {role === 'brand' ? <Briefcase color="#6B7280" size={18} /> : <User color="#6B7280" size={18} />}
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    placeholder={role === 'brand' ? 'Markanızın Adı' : 'Adınız Soyadınız'}
                                    placeholderTextColor="#4B5563"
                                    value={formData.fullName}
                                    onChangeText={(t) => updateField('fullName', t)}
                                />
                            </View>
                        </View>

                        {/* E-Posta */}
                        <View className="space-y-2">
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">E-Posta Adresi</Text>
                            <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                <Mail color="#6B7280" size={18} />
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    placeholder="ornek@mail.com"
                                    placeholderTextColor="#4B5563"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={formData.email}
                                    onChangeText={(t) => updateField('email', t)}
                                />
                            </View>
                        </View>

                        {/* Şifre */}
                        <View className="space-y-2">
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Şifre</Text>
                            <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                <Lock color="#6B7280" size={18} />
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    placeholder="••••••••"
                                    placeholderTextColor="#4B5563"
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    value={formData.password}
                                    onChangeText={(t) => updateField('password', t)}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                                    {showPassword ? (
                                        <EyeOff color="#6B7280" size={18} />
                                    ) : (
                                        <Eye color="#6B7280" size={18} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Şifre Tekrar */}
                        <View className="space-y-2">
                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-wider ml-1">Şifre Tekrarı</Text>
                            <View className={`flex-row items-center bg-surface border rounded-2xl h-14 px-4 space-x-3 ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-500/50' : 'border-white/10'}`}>
                                <Lock color="#6B7280" size={18} />
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    placeholder="••••••••"
                                    placeholderTextColor="#4B5563"
                                    secureTextEntry={!showConfirmPassword}
                                    autoCapitalize="none"
                                    value={formData.confirmPassword}
                                    onChangeText={(t) => updateField('confirmPassword', t)}
                                />
                                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} hitSlop={10}>
                                    {showConfirmPassword ? (
                                        <EyeOff color="#6B7280" size={18} />
                                    ) : (
                                        <Eye color="#6B7280" size={18} />
                                    )}
                                </TouchableOpacity>
                            </View>
                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                <Text className="text-red-400 text-[10px] ml-1">Şifreler eşleşmiyor.</Text>
                            )}
                        </View>

                        {/* Yasal Onay - Updated with clickable links */}
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => updateField('isAgreed', !formData.isAgreed)}
                            className="flex-row items-start space-x-3 bg-white/5 p-4 rounded-2xl border border-white/10 mt-2"
                        >
                            <View className={`w-5 h-5 rounded border items-center justify-center mt-0.5 ${formData.isAgreed ? 'bg-soft-gold border-soft-gold' : 'border-white/20 bg-white/5'}`}>
                                {formData.isAgreed && <Check size={12} color="#0B0F19" strokeWidth={4} />}
                            </View>
                            <View className="flex-1 flex-row flex-wrap">
                                <Text className="text-gray-300 text-xs leading-5">
                                    <Text
                                        className="text-soft-gold font-bold"
                                        onPress={() => openLink('https://influmatch.com/legal?tab=terms')}
                                    >
                                        Kullanım Koşulları
                                    </Text> ve <Text
                                        className="text-soft-gold font-bold"
                                        onPress={() => openLink('https://influmatch.com/legal?tab=privacy')}
                                    >
                                        Gizlilik Politikası
                                    </Text>'nı okudum ve kabul ediyorum.
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Buton */}
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleRegister}
                            disabled={loading || !formData.isAgreed}
                            className={`overflow-hidden rounded-2xl mt-6 shadow-lg shadow-soft-gold/20 ${!formData.isAgreed ? 'opacity-50' : ''}`}
                        >
                            <LinearGradient
                                colors={['#D4AF37', '#b89428']}
                                className="h-14 items-center justify-center flex-row space-x-2"
                            >
                                {loading ? (
                                    <ActivityIndicator color="black" />
                                ) : (
                                    <>
                                        <Text className="text-[#0B0F19] font-bold text-lg">Kayıt Ol</Text>
                                        <ChevronRight color="#0B0F19" size={20} strokeWidth={2.5} />
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <View className="mt-4 flex-row justify-center space-x-1">
                            <Text className="text-gray-500 text-sm">Zaten hesabın var mı?</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text className="text-soft-gold font-bold text-sm">Giriş Yap</Text>
                            </TouchableOpacity>
                        </View>

                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
