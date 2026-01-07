import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
            // Başarılı giriş
            Alert.alert('Başarılı', 'Hoş geldiniz!');
            setLoading(false);
            // İleride Dashboard'a yönlendireceğiz
        }
    }

    return (
        <View className="flex-1 bg-[#0F1014]">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1 justify-center px-6">

                {/* Header */}
                <View className="items-center mb-12">
                    <Text className="text-white text-5xl font-black tracking-tighter uppercase">
                        INFLU<Text className="text-soft-gold">MATCH</Text>
                    </Text>
                    <Text className="text-gray-400 mt-2 text-sm font-medium tracking-wide">
                        Türkiye'nin Influencer Pazaryeri
                    </Text>
                </View>

                {/* Form */}
                <View className="space-y-6">
                    <View>
                        <Text className="text-gray-300 text-xs uppercase tracking-wider mb-2 ml-1 font-bold">E-Posta</Text>
                        <TextInput
                            className="bg-white/10 border border-white/20 text-white p-4 rounded-xl font-medium"
                            placeholder="ornek@mail.com"
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="none"
                            value={email}
                            onChangeText={setEmail}
                        />
                    </View>

                    <View>
                        <Text className="text-gray-300 text-xs uppercase tracking-wider mb-2 ml-1 font-bold">Şifre</Text>
                        <TextInput
                            className="bg-white/10 border border-white/20 text-white p-4 rounded-xl font-medium"
                            placeholder="******"
                            placeholderTextColor="#9CA3AF"
                            secureTextEntry
                            value={password}
                            onChangeText={setPassword}
                        />
                    </View>

                    <TouchableOpacity
                        className="items-end"
                        onPress={() => Alert.alert('Bilgi', 'Web sitemizden şifrenizi sıfırlayabilirsiniz.')}
                    >
                        <Text className="text-gray-400 text-sm">Şifremi Unuttum?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="bg-white h-14 rounded-xl items-center justify-center mt-4 active:opacity-90 shadow-lg shadow-white/10"
                        onPress={signInWithEmail}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="black" />
                        ) : (
                            <Text className="text-black font-bold text-lg">Giriş Yap</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View className="flex-row justify-center mt-10">
                    <Text className="text-gray-400">Hesabın yok mu? </Text>
                    <TouchableOpacity onPress={() => Alert.alert('Kayıt', 'Mobil kayıt yakında! Lütfen web sitemizi kullanın.')}>
                        <Text className="text-soft-gold font-bold ml-1">Kayıt Ol</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
}
