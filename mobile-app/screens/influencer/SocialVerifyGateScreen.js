import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { ShieldCheck, Instagram, Copy, CheckCircle2, LogOut } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';

// Zorunlu sosyal hesap doğrulaması (web: /onboarding/verify). Influencer / UGC, Instagram veya TikTok
// hesaplarından en az birini biyografi koduyla doğrulamadan panele giremez. Kod üretme ve kontrol
// web'in sunucu uçlarından (/api/mobile/verify-instagram, verify-tiktok) yapılır.

const PLATFORMS = [
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' },
];

export default function SocialVerifyGateScreen({ navigation }) {
    const [platform, setPlatform] = useState('instagram');
    const [username, setUsername] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);

    const endpoint = platform === 'tiktok' ? 'verify-tiktok' : 'verify-instagram';

    const generate = async () => {
        const clean = username.trim().replace(/^@/, '').toLowerCase();
        if (!clean) return setError('Kullanıcı adı boş olamaz.');
        setBusy('generate');
        setError(null);
        const result = await apiRequest(endpoint, { method: 'POST', body: { action: 'generate', username: clean } });
        setBusy(null);
        if (result.error || !result.success) return setError(result.error || 'Kod üretilemedi.');
        setCode(result.code);
    };

    const verify = async () => {
        setBusy('verify');
        setError(null);
        const result = await apiRequest(endpoint, { method: 'POST', body: { action: 'verify' } });
        setBusy(null);
        if (result.error || !result.success) return setError(result.error || 'Doğrulama başarısız.');
        setDone(true);
    };

    const copyCode = async () => {
        await Clipboard.setStringAsync(code);
        Alert.alert('Kopyalandı', 'Kodu biyografine yapıştır, kaydet ve "Doğrula"ya bas.');
    };

    const switchPlatform = (id) => {
        if (id === platform) return;
        setPlatform(id);
        setCode('');
        setError(null);
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <SafeAreaView className="flex-1">
                <ScrollView className="flex-1 px-6" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 24, paddingBottom: 48 }}>
                    <View className="w-14 h-14 rounded-2xl bg-soft-gold/15 border border-soft-gold/30 items-center justify-center mb-5">
                        <ShieldCheck color="#D4AF37" size={26} />
                    </View>
                    <Text className="text-white text-2xl font-bold mb-2">Hesabını doğrula</Text>
                    <Text className="text-gray-400 text-sm leading-6 mb-6">
                        Devam etmek için Instagram veya TikTok hesaplarından en az birinin sana ait olduğunu doğrulaman gerekiyor.
                        Biyografine geçici bir kod ekleyeceksin; doğrulamadan sonra kodu silebilirsin.
                    </Text>

                    {done ? (
                        <View className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-5">
                            <View className="flex-row items-center gap-2 mb-2">
                                <CheckCircle2 color="#34d399" size={20} />
                                <Text className="text-emerald-300 font-bold">Hesabın doğrulandı</Text>
                            </View>
                            <Text className="text-gray-300 text-sm mb-4">Artık biyografindeki kodu silebilirsin.</Text>
                            <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })}
                                className="h-12 rounded-2xl bg-soft-gold items-center justify-center">
                                <Text className="text-black font-bold">Devam et</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            <View className="flex-row gap-3 mb-5">
                                {PLATFORMS.map((p) => (
                                    <TouchableOpacity key={p.id} onPress={() => switchPlatform(p.id)}
                                        className={`flex-1 h-11 rounded-2xl border items-center justify-center ${platform === p.id ? 'border-soft-gold bg-soft-gold/15' : 'border-white/10 bg-white/5'}`}>
                                        <Text className={platform === p.id ? 'text-soft-gold font-bold' : 'text-gray-400 font-semibold'}>{p.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">{platform === 'tiktok' ? 'TikTok' : 'Instagram'} kullanıcı adı</Text>
                            <View className="flex-row items-center bg-black/30 border border-white/10 rounded-2xl px-4 h-14 mb-4">
                                {platform === 'instagram' ? <Instagram color="#6b7280" size={16} /> : <Text className="text-gray-500">@</Text>}
                                <TextInput className="flex-1 text-white text-sm ml-2" value={username} onChangeText={(v) => { setUsername(v); setCode(''); }}
                                    placeholder="kullaniciadi" placeholderTextColor="#4b5563" autoCapitalize="none" autoCorrect={false} />
                            </View>

                            {!code ? (
                                <TouchableOpacity disabled={!!busy} onPress={generate} className="h-12 rounded-2xl bg-soft-gold items-center justify-center">
                                    {busy === 'generate' ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold">Doğrulama kodu al</Text>}
                                </TouchableOpacity>
                            ) : (
                                <>
                                    <Text className="text-gray-400 text-sm mb-2">1. Bu kodu {platform === 'tiktok' ? 'TikTok' : 'Instagram'} biyografine ekle ve kaydet:</Text>
                                    <TouchableOpacity onPress={copyCode} className="flex-row items-center justify-between rounded-2xl border border-soft-gold/40 bg-soft-gold/10 px-4 h-14 mb-4">
                                        <Text className="text-soft-gold font-bold text-lg tracking-widest">{code}</Text>
                                        <Copy color="#D4AF37" size={18} />
                                    </TouchableOpacity>
                                    <Text className="text-gray-400 text-sm mb-3">2. Ardından doğrula:</Text>
                                    <TouchableOpacity disabled={!!busy} onPress={verify} className="h-12 rounded-2xl bg-soft-gold items-center justify-center mb-3">
                                        {busy === 'verify' ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold">Doğrula</Text>}
                                    </TouchableOpacity>
                                    <TouchableOpacity disabled={!!busy} onPress={generate} className="h-11 rounded-2xl border border-white/10 items-center justify-center">
                                        <Text className="text-gray-300 font-semibold text-sm">Yeni kod al</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            {error && <Text className="text-red-300 text-sm mt-4">{error}</Text>}
                        </>
                    )}

                    <TouchableOpacity onPress={() => supabase.auth.signOut().then(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }))}
                        className="flex-row items-center justify-center gap-2 mt-10">
                        <LogOut color="#6b7280" size={16} />
                        <Text className="text-gray-500 text-sm">Çıkış yap</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
