import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react-native';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    async function signInWithEmail() {
        if (!email || !password) {
            Alert.alert('Hata', 'Lütfen e-posta ve şifrenizi girin.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            Alert.alert('Giriş Başarısız', error.message);
            setLoading(false);
        } else {
            Alert.alert('Başarılı', 'Hoş geldiniz!');
            setLoading(false);
            // Link to dashboard later
        }
    }

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />

            {/* Arka Plan Efekti */}
            <View className="absolute top-0 right-0 h-64 w-64 bg-soft-gold rounded-full opacity-[0.03] blur-3xl -translate-y-10 translate-x-10" />
            <View className="absolute bottom-0 left-0 h-64 w-64 bg-blue-600 rounded-full opacity-[0.03] blur-3xl translate-y-10 -translate-x-10" />

            <SafeAreaView className="flex-1 justify-center px-6">

                {/* Header */}
                <View className="items-center mb-16">
                    <View className="flex-row items-center mb-4">
                        <Text className="text-white text-5xl font-black tracking-tighter uppercase">
                            INFLU<Text className="text-soft-gold">MATCH</Text>
                        </Text>
                    </View>
                    <Text className="text-gray-400 text-sm font-medium tracking-wide bg-white/5 px-4 py-1 rounded-full border border-white/5 overflow-hidden">
                        Türkiye'nin Influencer Pazaryeri
                    </Text>
                </View>

                {/* Form */}
                <View className="space-y-6">

                    <View className="space-y-2">
                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">E-Posta</Text>
                        <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl px-4 h-14 space-x-3 focus:border-soft-gold/50 transition-all">
                            <Mail color="#6B7280" size={20} />
                            <TextInput
                                className="flex-1 text-white font-medium h-full"
                                placeholder="ornek@mail.com"
                                placeholderTextColor="#4B5563"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>
                    </View>

                    <View className="space-y-2">
                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Şifre</Text>
                        <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl px-4 h-14 space-x-3 focus:border-soft-gold/50 transition-all">
                            <Lock color="#6B7280" size={20} />
                            <TextInput
                                className="flex-1 text-white font-medium h-full"
                                placeholder="******"
                                placeholderTextColor="#4B5563"
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                value={password}
                                onChangeText={setPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
                                {showPassword ? (
                                    <EyeOff color="#6B7280" size={20} />
                                ) : (
                                    <Eye color="#6B7280" size={20} />
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        className="items-end"
                        onPress={() => Alert.alert('Bilgi', 'Web sitemizden şifrenizi sıfırlayabilirsiniz.')}
                    >
                        <Text className="text-gray-400 text-xs font-medium">Şifremi Unuttum?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={signInWithEmail}
                        disabled={loading}
                        className="overflow-hidden rounded-2xl mt-4 shadow-lg shadow-soft-gold/10"
                    >
                        <LinearGradient
                            colors={['#D4AF37', '#B4932C']}
                            className="h-14 items-center justify-center flex-row space-x-2"
                        >
                            {loading ? (
                                <ActivityIndicator color="black" />
                            ) : (
                                <>
                                    <Text className="text-[#0B0F19] font-bold text-lg">Giriş Yap</Text>
                                    <ArrowRight color="#0B0F19" size={20} strokeWidth={2.5} />
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View className="flex-row justify-center mt-12 items-center space-x-1">
                    <Text className="text-gray-500 font-medium">Hesabın yok mu?</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('RegisterRole')}>
                        <Text className="text-soft-gold font-bold">Kayıt Ol</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
