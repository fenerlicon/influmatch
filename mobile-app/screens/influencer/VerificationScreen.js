import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ShieldCheck, Upload, CheckCircle2, Clock, AlertCircle, XCircle, ShieldAlert } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

// ─── Design System ────────────────────────────────────────────────────────────
const GlassCard = ({ children, className, style }) => (
    <View className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`} style={style}>
        <LinearGradient colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </View>
);

// ─── Status cards ─────────────────────────────────────────────────────────────
const VerifiedCard = () => (
    <View className="relative overflow-hidden rounded-[28px] p-6 border border-green-500/25 items-center mb-6">
        <LinearGradient colors={['rgba(16,185,129,0.12)', 'rgba(16,185,129,0.03)']} className="absolute inset-0" />
        <View className="w-16 h-16 bg-green-500/15 rounded-full border border-green-500/30 items-center justify-center mb-4 shadow-[0_0_20px_rgba(74,222,128,0.25)]">
            <CheckCircle2 color="#4ade80" size={30} />
        </View>
        <Text className="text-green-400 font-bold text-xl mb-2">Hesabınız Doğrulandı</Text>
        <Text className="text-gray-400 text-sm text-center leading-5">Mavi tik rozetiniz aktif. Tüm özelliklere erişebilirsiniz.</Text>
    </View>
);

const PendingCard = () => (
    <View className="relative overflow-hidden rounded-[28px] p-6 border border-blue-500/25 items-center mb-6">
        <LinearGradient colors={['rgba(59,130,246,0.12)', 'rgba(59,130,246,0.03)']} className="absolute inset-0" />
        <View className="w-16 h-16 bg-blue-500/15 rounded-full border border-blue-500/30 items-center justify-center mb-4 shadow-[0_0_20px_rgba(96,165,250,0.25)]">
            <Clock color="#60a5fa" size={30} />
        </View>
        <Text className="text-blue-400 font-bold text-xl mb-2">İnceleme Bekliyor</Text>
        <Text className="text-gray-400 text-sm text-center leading-5">Belgeleriniz inceleniyor. 24-48 saat içinde sonuçlanacaktır.</Text>
    </View>
);

const RejectedCard = () => (
    <View className="relative overflow-hidden rounded-[24px] p-5 border border-red-500/25 mb-6">
        <LinearGradient colors={['rgba(239,68,68,0.1)', 'transparent']} className="absolute inset-0" />
        <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 bg-red-500/15 rounded-2xl border border-red-500/25 items-center justify-center">
                <XCircle color="#ef4444" size={22} />
            </View>
            <View className="flex-1">
                <Text className="text-red-400 font-bold text-base">Doğrulama Reddedildi</Text>
                <Text className="text-gray-500 text-xs mt-0.5 leading-4">Belgelerinizi yeniden yükleyerek tekrar başvurabilirsiniz.</Text>
            </View>
        </View>
    </View>
);

const UnverifiedCard = () => (
    <View className="relative overflow-hidden rounded-[24px] p-5 border border-blue-500/20 mb-6">
        <LinearGradient colors={['rgba(59,130,246,0.07)', 'transparent']} className="absolute inset-0" />
        <View className="flex-row items-start gap-3">
            <View className="w-10 h-10 bg-blue-500/15 rounded-2xl border border-blue-500/25 items-center justify-center">
                <ShieldCheck color="#60a5fa" size={20} />
            </View>
            <View className="flex-1">
                <Text className="text-blue-400 font-bold text-base">Hesabınız Onaylanmamış</Text>
                <Text className="text-gray-500 text-xs mt-0.5 leading-4">Mavi tik rozeti ve ek özellikler için kimliğinizi doğrulayın.</Text>
            </View>
        </View>
    </View>
);

// ─── Upload box ───────────────────────────────────────────────────────────────
const UploadBox = ({ label, value, onPress }) => (
    <View className="mb-5">
        <Text className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">{label}</Text>
        <TouchableOpacity
            onPress={onPress}
            className={`h-36 rounded-[22px] border-2 border-dashed items-center justify-center overflow-hidden ${value ? 'border-green-500/50' : 'border-white/15'}`}
            style={{ backgroundColor: value ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)' }}
        >
            {value ? (
                <>
                    <Image source={{ uri: value.uri }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
                    <View className="bg-black/60 rounded-2xl px-4 py-2 flex-row items-center gap-2 border border-green-500/30">
                        <CheckCircle2 color="#4ade80" size={14} />
                        <Text className="text-green-400 font-bold text-xs">Yüklendi • Değiştir</Text>
                    </View>
                </>
            ) : (
                <>
                    <View className="w-12 h-12 bg-white/5 rounded-2xl items-center justify-center mb-2 border border-white/10">
                        <Upload color="#6b7280" size={22} />
                    </View>
                    <Text className="text-gray-400 text-sm">Yüklemek için dokun</Text>
                    <Text className="text-gray-600 text-xs mt-1">Galeriden seç</Text>
                </>
            )}
        </TouchableOpacity>
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function VerificationScreen({ navigation }) {
    const [currentStatus, setCurrentStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [idFront, setIdFront] = useState(null);
    const [idBack, setIdBack] = useState(null);

    useEffect(() => { fetchStatus(); }, []);

    const fetchStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('verification_status').eq('id', user.id).maybeSingle();
            setCurrentStatus(data?.verification_status || null);
        } catch (e) {
            console.error('[VerificationScreen]', e);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async (side) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') return Alert.alert('İzin Gerekli', 'Galeriye erişim izni gerekiyor.');

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaType.Images,
            allowsEditing: true,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets?.[0]) {
            const asset = result.assets[0];
            const obj = { uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType || 'image/jpeg' };
            if (side === 'front') setIdFront(obj);
            else setIdBack(obj);
        }
    };

    const decode = (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    };

    const handleSubmit = async () => {
        if (!idFront || !idBack) {
            return Alert.alert('Eksik Belge', 'Kimliğinizin ön ve arka yüzünü yükleyin.');
        }
        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Oturum bulunamadı');

            const ts = Date.now();
            await Promise.all([
                supabase.storage.from('verification-documents').upload(`${user.id}/front_${ts}.jpg`, decode(idFront.base64), { contentType: idFront.mimeType, upsert: true }),
                supabase.storage.from('verification-documents').upload(`${user.id}/back_${ts}.jpg`, decode(idBack.base64), { contentType: idBack.mimeType, upsert: true }),
            ]);

            const { error } = await supabase.from('users').update({ verification_status: 'pending' }).eq('id', user.id);
            if (error) throw error;

            await supabase.from('notifications').insert({
                user_id: user.id,
                title: 'Doğrulama Başvurusu Alındı',
                message: 'Belgeleriniz incelemeye alındı. 24-48 saat içinde sonuçlanacaktır.',
                type: 'info',
            });

            setCurrentStatus('pending');
        } catch (e) {
            console.error('[VerificationScreen] submit error:', e);
            Alert.alert('Hata', e.message || 'Belgeler yüklenemedi.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    const canUpload = currentStatus !== 'verified' && currentStatus !== 'pending';

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* Master backgrounds */}
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-[100px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/8 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 mr-4">
                        <ChevronLeft color="white" size={22} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Hesap Doğrulama</Text>
                </View>

                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

                    {/* Status card */}
                    {currentStatus === 'verified' && <VerifiedCard />}
                    {currentStatus === 'pending' && <PendingCard />}
                    {currentStatus === 'rejected' && <RejectedCard />}
                    {!currentStatus && <UnverifiedCard />}

                    {/* Upload form */}
                    {canUpload && (
                        <>
                            <Text className="text-white text-lg font-bold mb-5">Kimlik Yükle</Text>

                            <UploadBox label="Kimlik / Pasaport Ön Yüzü" value={idFront} onPress={() => pickImage('front')} />
                            <UploadBox label="Kimlik / Pasaport Arka Yüzü" value={idBack} onPress={() => pickImage('back')} />

                            {/* Info note */}
                            <View className="flex-row gap-3 bg-soft-gold/5 border border-soft-gold/15 rounded-2xl p-4 mb-6">
                                <AlertCircle color="#D4AF37" size={15} className="mt-0.5" />
                                <Text className="text-gray-400 text-xs leading-5 flex-1">
                                    Belgeleriniz güvenli biçimde şifrelenir ve yalnızca doğrulama amacıyla kullanılır.
                                </Text>
                            </View>

                            {/* Submit */}
                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={!idFront || !idBack || uploading}
                                className={`h-14 rounded-2xl items-center justify-center shadow-lg ${idFront && idBack ? 'bg-soft-gold shadow-soft-gold/25' : 'bg-white/5 opacity-50'}`}
                            >
                                {uploading
                                    ? <ActivityIndicator color="black" />
                                    : <Text className={`font-bold text-base ${idFront && idBack ? 'text-midnight' : 'text-gray-600'}`}>Gönder</Text>}
                            </TouchableOpacity>

                            <View className="flex-row items-center justify-center gap-2 mt-5">
                                <Clock size={13} color="#6b7280" />
                                <Text className="text-gray-600 text-xs">Ortalama onay süresi 24 saattir.</Text>
                            </View>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
