import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Mail, Phone, Globe, Camera, LogOut, ChevronRight, Shield, FileText, HelpCircle, Edit3, Check, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Design ───────────────────────────────────────────────────────────────────
const GlassCard = ({ children, className }) => (
    <View className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`}>
        <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </View>
);

const SectionLabel = ({ title }) => (
    <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest mt-6 mb-3 ml-1">{title}</Text>
);

const InfoRow = ({ label, value, last, editing, edit, onEdit, onSave, onCancel }) => (
    <View className={`px-5 py-4 ${!last ? 'border-b border-white/[0.06]' : ''}`}>
        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</Text>
        {editing ? (
            <View className="flex-row items-center gap-2">
                <TextInput
                    className="flex-1 text-white text-sm bg-black/20 border border-white/10 rounded-xl px-3 py-2"
                    value={edit}
                    onChangeText={onEdit}
                    autoFocus
                    placeholderTextColor="#4b5563"
                />
                <TouchableOpacity onPress={onSave} className="w-8 h-8 bg-green-500/15 rounded-xl items-center justify-center border border-green-500/25">
                    <Check color="#4ade80" size={15} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onCancel} className="w-8 h-8 bg-red-500/10 rounded-xl items-center justify-center border border-red-500/20">
                    <X color="#f87171" size={15} />
                </TouchableOpacity>
            </View>
        ) : (
            <Text className="text-white text-sm font-medium" onLongPress={onEdit} numberOfLines={2}>
                {value || <Text className="text-gray-600 italic">Belirtilmemiş</Text>}
            </Text>
        )}
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandProfileScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editField, setEditField] = useState(null); // field name being edited
    const [editValue, setEditValue] = useState('');

    const fetchProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
            .from('users')
            .select('full_name, username, email, corporate_name, phone, website, bio, avatar_url, verification_status')
            .eq('id', user.id)
            .maybeSingle();
        setProfile(data);
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    const startEdit = (field, currentValue) => {
        setEditField(field);
        setEditValue(currentValue || '');
    };

    const saveField = async () => {
        if (!editField) return;
        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('users').update({ [editField]: editValue.trim() }).eq('id', user.id);
        if (error) Alert.alert('Hata', error.message);
        else setProfile(prev => ({ ...prev, [editField]: editValue.trim() }));
        setEditField(null);
        setSaving(false);
    };

    const handleLogout = () => {
        Alert.alert('Çıkış Yap', 'Hesabından çıkış yapmak istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Çıkış Yap', style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }
            }
        ]);
    };

    const isVerified = profile?.verification_status === 'verified';

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    const initials = (profile?.corporate_name || profile?.full_name || '?').substring(0, 2).toUpperCase();

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-72 h-72 bg-soft-gold/4 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1">
                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

                    {/* ── Hero ── */}
                    <View className="items-center pt-8 pb-6">
                        <View className="relative mb-4">
                            <View className="w-24 h-24 rounded-full bg-[#1A1D24] border-2 border-soft-gold/40 items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.2)]">
                                {profile?.avatar_url
                                    ? <Image source={{ uri: profile.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                    : <Text className="text-white text-3xl font-black">{initials}</Text>}
                            </View>
                            {isVerified && (
                                <View className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-500 rounded-full items-center justify-center border-2 border-[#020617]">
                                    <Shield color="white" size={13} />
                                </View>
                            )}
                        </View>

                        <Text className="text-white text-2xl font-black tracking-tight">
                            {profile?.corporate_name || profile?.full_name || 'Marka'}
                        </Text>
                        <Text className="text-gray-500 text-sm mt-1">@{profile?.username}</Text>

                        {isVerified && (
                            <View className="mt-3 flex-row items-center gap-2 bg-blue-500/10 border border-blue-500/25 px-4 py-2 rounded-full">
                                <Shield color="#60a5fa" size={13} />
                                <Text className="text-blue-300 text-xs font-bold">Doğrulanmış Marka</Text>
                            </View>
                        )}
                    </View>

                    {/* ── Contact & Company Info ── */}
                    <SectionLabel title="ŞİRKET BİLGİLERİ" />
                    <GlassCard>
                        {[
                            { label: 'Şirket / Marka Adı', field: 'corporate_name', icon: Building2 },
                            { label: 'Yetkili Ad Soyad', field: 'full_name', icon: null },
                            { label: 'E-posta', field: 'email', icon: Mail },
                            { label: 'Telefon', field: 'phone', icon: Phone },
                            { label: 'İnternet Sitesi', field: 'website', icon: Globe },
                        ].map((row, i, arr) => (
                            <InfoRow
                                key={row.field}
                                label={row.label}
                                value={profile?.[row.field]}
                                last={i === arr.length - 1}
                                editing={editField === row.field}
                                edit={editValue}
                                onEdit={(v) => { if (editField === row.field) setEditValue(v); else startEdit(row.field, profile?.[row.field]); }}
                                onSave={saveField}
                                onCancel={() => setEditField(null)}
                            />
                        ))}
                    </GlassCard>

                    <Text className="text-gray-600 text-xs mt-2 ml-2">Düzenlemek için bir alana uzun basın.</Text>

                    {/* ── Bio ── */}
                    <SectionLabel title="HAKKINDA" />
                    <GlassCard>
                        <InfoRow
                            label="Marka Açıklaması"
                            value={profile?.bio}
                            last
                            editing={editField === 'bio'}
                            edit={editValue}
                            onEdit={(v) => { if (editField === 'bio') setEditValue(v); else startEdit('bio', profile?.bio); }}
                            onSave={saveField}
                            onCancel={() => setEditField(null)}
                        />
                    </GlassCard>

                    {/* ── Verification ── */}
                    {!isVerified && (
                        <>
                            <SectionLabel title="DOĞRULAMA" />
                            <GlassCard className="border border-amber-500/20">
                                <LinearGradient colors={['rgba(245,158,11,0.07)', 'transparent']} className="absolute inset-0" />
                                <TouchableOpacity className="px-5 py-4 flex-row items-center gap-4" onPress={() => navigation.navigate('BrandVerification')}>
                                    <View className="w-10 h-10 bg-amber-500/15 rounded-xl border border-amber-500/25 items-center justify-center">
                                        <Shield color="#fbbf24" size={18} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-amber-300 font-bold text-sm">İşletmeni Doğrula</Text>
                                        <Text className="text-gray-500 text-xs mt-0.5">Güven rozeti ve özellikler için</Text>
                                    </View>
                                    <ChevronRight color="#4b5563" size={16} />
                                </TouchableOpacity>
                            </GlassCard>
                        </>
                    )}

                    {/* ── Support / Docs ── */}
                    <SectionLabel title="DESTEK" />
                    <GlassCard>
                        <TouchableOpacity className="px-5 py-4 flex-row items-center gap-4 border-b border-white/[0.06]"
                            onPress={() => Alert.alert('Destek', 'destek@influmatch.net adresine yazabilirsiniz.')}>
                            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/[0.07]">
                                <HelpCircle color="#9ca3af" size={17} />
                            </View>
                            <Text className="text-white font-semibold text-sm flex-1">Yardım & Destek</Text>
                            <ChevronRight color="#4b5563" size={16} />
                        </TouchableOpacity>
                        <TouchableOpacity className="px-5 py-4 flex-row items-center gap-4"
                            onPress={() => Alert.alert('Koşullar', 'influmatch.net/terms adresinden erişebilirsiniz.')}>
                            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/[0.07]">
                                <FileText color="#9ca3af" size={17} />
                            </View>
                            <Text className="text-white font-semibold text-sm flex-1">Kullanım Koşulları</Text>
                            <ChevronRight color="#4b5563" size={16} />
                        </TouchableOpacity>
                    </GlassCard>

                    {/* ── Logout ── */}
                    <TouchableOpacity onPress={handleLogout}
                        className="mt-6 bg-red-500/8 border border-red-500/20 p-4 rounded-[22px] flex-row items-center justify-center gap-3">
                        <LogOut color="#EF4444" size={17} />
                        <Text className="text-red-500 font-bold text-base">Çıkış Yap</Text>
                    </TouchableOpacity>

                    <Text className="text-gray-700 text-[11px] text-center mt-5">InfluMatch v1.0 · influmatch.net</Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
