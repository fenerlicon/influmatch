import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Shield, Building2, FileText, Phone, CheckCircle2, Clock, AlertCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Design ───────────────────────────────────────────────────────────────────
const GlassCard = ({ children, className }) => (
    <View className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`}>
        <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </View>
);

const InputField = ({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false }) => (
    <View className="mb-5">
        <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">{label}</Text>
        <View className={`bg-black/30 border border-white/10 rounded-2xl px-4 ${multiline ? 'py-3 min-h-[90px]' : 'h-13 justify-center'}`}>
            <TextInput
                className="text-white text-sm"
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#4b5563"
                keyboardType={keyboardType}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
            />
        </View>
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandVerificationScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        corporate_name: '',
        tax_id: '',
        phone: '',
        website: '',
        notes: '',
    });

    const fetchProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('users')
            .select('corporate_name, tax_id, phone, website, verification_status')
            .eq('id', user.id)
            .maybeSingle();
        if (data) {
            setProfile(data);
            setForm(prev => ({
                ...prev,
                corporate_name: data.corporate_name || '',
                tax_id: data.tax_id || '',
                phone: data.phone || '',
                website: data.website || '',
            }));
        }
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    const handleSubmit = async () => {
        if (!form.corporate_name.trim()) {
            Alert.alert('Eksik Bilgi', 'Lütfen şirket / marka adınızı girin.');
            return;
        }
        if (!form.tax_id.trim()) {
            Alert.alert('Eksik Bilgi', 'Lütfen vergi numaranızı girin.');
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase
                .from('users')
                .update({
                    corporate_name: form.corporate_name.trim(),
                    tax_id: form.tax_id.trim(),
                    phone: form.phone.trim() || null,
                    website: form.website.trim() || null,
                    verification_status: 'pending',
                })
                .eq('id', user.id);

            if (error) throw error;

            Alert.alert(
                'Başvuru Alındı ✓',
                'Doğrulama başvurunuz alındı. Ekibimiz 1-3 iş günü içinde inceleyecektir.',
                [{ text: 'Tamam', onPress: () => navigation.goBack() }]
            );
        } catch (e) {
            Alert.alert('Hata', e.message || 'Başvuru gönderilemedi.');
        } finally {
            setSaving(false);
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

    const isPending = profile?.verification_status === 'pending';
    const isVerified = profile?.verification_status === 'verified';

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-72 h-72 bg-amber-500/5 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-5 py-4 flex-row items-center gap-3 border-b border-white/5">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 bg-white/5 rounded-2xl items-center justify-center border border-white/10"
                    >
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-white font-bold text-base">İşletme Doğrulama</Text>
                        <Text className="text-gray-500 text-xs">Resmi İşletme rozeti için başvur</Text>
                    </View>
                    <View className="w-10 h-10 bg-amber-500/15 rounded-2xl border border-amber-500/25 items-center justify-center">
                        <Shield color="#fbbf24" size={18} />
                    </View>
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60, paddingTop: 20 }}>

                    {/* Status Banner */}
                    {isVerified && (
                        <GlassCard className="p-4 mb-6 border-green-500/20">
                            <LinearGradient colors={['rgba(74,222,128,0.08)', 'transparent']} className="absolute inset-0" />
                            <View className="flex-row items-center gap-3">
                                <CheckCircle2 color="#4ade80" size={22} />
                                <View className="flex-1">
                                    <Text className="text-green-400 font-bold text-sm">Hesabınız Doğrulandı</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">İşletmeniz onaylı marka statüsüne sahip.</Text>
                                </View>
                            </View>
                        </GlassCard>
                    )}

                    {isPending && (
                        <GlassCard className="p-4 mb-6 border-amber-500/20">
                            <LinearGradient colors={['rgba(251,191,36,0.08)', 'transparent']} className="absolute inset-0" />
                            <View className="flex-row items-center gap-3">
                                <Clock color="#fbbf24" size={22} />
                                <View className="flex-1">
                                    <Text className="text-amber-300 font-bold text-sm">Başvurunuz İnceleniyor</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">Ekibimiz 1-3 iş günü içinde dönüş yapacaktır.</Text>
                                </View>
                            </View>
                        </GlassCard>
                    )}

                    {/* Info Card */}
                    {!isVerified && !isPending && (
                        <GlassCard className="p-5 mb-6 border-amber-500/15">
                            <LinearGradient colors={['rgba(245,158,11,0.06)', 'transparent']} className="absolute inset-0" />
                            <View className="flex-row items-start gap-3">
                                <AlertCircle color="#fbbf24" size={20} />
                                <View className="flex-1">
                                    <Text className="text-amber-300 font-bold text-sm mb-2">Neden Doğrulayalım?</Text>
                                    <Text className="text-gray-400 text-xs leading-5">
                                        • <Text className="text-white font-medium">Resmi İşletme</Text> rozeti kazanırsınız{'\n'}
                                        • Influencer'lar güvenilir marka olarak görür{'\n'}
                                        • Başvurularınız öncelikli incelenir{'\n'}
                                        • Platform'da öne çıkma fırsatı kazanırsınız
                                    </Text>
                                </View>
                            </View>
                        </GlassCard>
                    )}

                    {/* Form */}
                    {!isVerified && (
                        <>
                            <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest mb-4 ml-1">ŞİRKET BİLGİLERİ</Text>

                            <InputField
                                label="Şirket / Marka Adı *"
                                value={form.corporate_name}
                                onChange={v => setForm(f => ({ ...f, corporate_name: v }))}
                                placeholder="Şirket Adı A.Ş."
                            />
                            <InputField
                                label="Vergi Numarası *"
                                value={form.tax_id}
                                onChange={v => setForm(f => ({ ...f, tax_id: v }))}
                                placeholder="1234567890"
                                keyboardType="number-pad"
                            />
                            <InputField
                                label="Telefon"
                                value={form.phone}
                                onChange={v => setForm(f => ({ ...f, phone: v }))}
                                placeholder="+90 5XX XXX XX XX"
                                keyboardType="phone-pad"
                            />
                            <InputField
                                label="Web Sitesi"
                                value={form.website}
                                onChange={v => setForm(f => ({ ...f, website: v }))}
                                placeholder="https://sirketiniz.com"
                                keyboardType="url"
                            />
                            <InputField
                                label="Ek Notlar (İsteğe Bağlı)"
                                value={form.notes}
                                onChange={v => setForm(f => ({ ...f, notes: v }))}
                                placeholder="Şirketiniz hakkında eklemek istedikleriniz..."
                                multiline
                            />

                            <Text className="text-gray-600 text-[10px] text-center mt-2 mb-6 leading-4">
                                Gönderilen bilgiler gizli tutulur ve yalnızca doğrulama amacıyla kullanılır.
                            </Text>

                            <TouchableOpacity
                                onPress={handleSubmit}
                                disabled={saving || isPending}
                                className={`h-14 rounded-2xl items-center justify-center shadow-lg ${isPending ? 'bg-gray-700' : 'bg-amber-500 shadow-amber-500/20'}`}
                            >
                                {saving
                                    ? <ActivityIndicator color="black" />
                                    : <Text className={`font-bold text-base ${isPending ? 'text-gray-500' : 'text-black'}`}>
                                        {isPending ? 'Başvuru Gönderildi' : 'Doğrulama Başvurusu Yap'}
                                    </Text>
                                }
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
