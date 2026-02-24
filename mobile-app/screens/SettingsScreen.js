import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import {
    User, Bell, Lock, HelpCircle, FileText, LogOut,
    ChevronRight, Shield, Mail, Smartphone, ArrowLeft,
    Eye, EyeOff, Send,
} from 'lucide-react-native';

// ─── Design System ────────────────────────────────────────────────────────────
const GlassCard = ({ children, className }) => (
    <View className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`}>
        <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </View>
);

// ─── Reusable MenuItem ────────────────────────────────────────────────────────
const MenuItem = ({ icon: Icon, title, subtitle, onPress, hasSwitch, value, onValueChange, iconColor = '#9CA3AF', last = false }) => (
    <TouchableOpacity
        onPress={hasSwitch ? null : onPress}
        activeOpacity={hasSwitch ? 1 : 0.7}
        className={`flex-row items-center justify-between px-5 py-4 ${!last ? 'border-b border-white/[0.06]' : ''}`}
    >
        <View className="flex-row items-center flex-1">
            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]">
                <Icon color={iconColor} size={17} />
            </View>
            <View className="flex-1">
                <Text className="text-white font-semibold text-[15px]">{title}</Text>
                {subtitle && <Text className="text-gray-500 text-[12px] mt-0.5">{subtitle}</Text>}
            </View>
        </View>
        {hasSwitch
            ? <Switch trackColor={{ false: '#374151', true: '#D4AF37' }} thumbColor={value ? '#FFFFFF' : '#9CA3AF'} onValueChange={onValueChange} value={value} />
            : <ChevronRight color="#4B5563" size={18} />}
    </TouchableOpacity>
);

const SectionLabel = ({ title }) => (
    <Text className="text-soft-gold/70 text-[10px] font-bold tracking-[0.3em] mt-7 mb-3 ml-1">{title}</Text>
);

// ─── Password Change (inline expandable) ─────────────────────────────────────
const PasswordSection = ({ last }) => {
    const [open, setOpen] = useState(false);
    const [newPass, setNewPass] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [saving, setSaving] = useState(false);

    const save = async () => {
        if (newPass.length < 6) return Alert.alert('Hata', 'Şifre en az 6 karakter olmalı.');
        if (newPass !== confirm) return Alert.alert('Hata', 'Şifreler eşleşmiyor.');
        setSaving(true);
        const { error } = await supabase.auth.updateUser({ password: newPass });
        setSaving(false);
        if (error) return Alert.alert('Hata', error.message);
        Alert.alert('Başarılı', 'Şifreniz güncellendi.');
        setOpen(false); setNewPass(''); setConfirm('');
    };

    return (
        <>
            <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.7}
                className={`flex-row items-center justify-between px-5 py-4 ${!last || open ? 'border-b border-white/[0.06]' : ''}`}>
                <View className="flex-row items-center flex-1">
                    <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]">
                        <Lock color="#9CA3AF" size={17} />
                    </View>
                    <View>
                        <Text className="text-white font-semibold text-[15px]">Şifre Değiştir</Text>
                        <Text className="text-gray-500 text-[12px] mt-0.5">Hesap güvenliğini güncelle</Text>
                    </View>
                </View>
                <ChevronRight color="#4B5563" size={18} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>

            {open && (
                <View className="mx-4 mb-4 mt-1 p-4 rounded-2xl border border-white/[0.07] bg-black/20">
                    {/* New password */}
                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">YENİ ŞİFRE</Text>
                    <View className="flex-row items-center bg-black/30 rounded-xl border border-white/10 px-4 h-12 mb-3">
                        <TextInput
                            className="flex-1 text-white text-sm"
                            value={newPass} onChangeText={setNewPass}
                            secureTextEntry={!showPass}
                            placeholder="En az 6 karakter" placeholderTextColor="#4b5563"
                            autoCapitalize="none"
                        />
                        <TouchableOpacity onPress={() => setShowPass(v => !v)}>
                            {showPass ? <EyeOff color="#6b7280" size={17} /> : <Eye color="#6b7280" size={17} />}
                        </TouchableOpacity>
                    </View>

                    {/* Confirm */}
                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">ŞİFRE TEKRAR</Text>
                    <View className="flex-row items-center bg-black/30 rounded-xl border border-white/10 px-4 h-12 mb-4">
                        <TextInput
                            className="flex-1 text-white text-sm"
                            value={confirm} onChangeText={setConfirm}
                            secureTextEntry={!showPass}
                            placeholder="Şifreyi tekrarla" placeholderTextColor="#4b5563"
                            autoCapitalize="none"
                        />
                    </View>

                    <TouchableOpacity onPress={save} disabled={saving}
                        className="bg-soft-gold h-11 rounded-xl items-center justify-center">
                        {saving ? <ActivityIndicator color="black" size="small" /> : <Text className="text-midnight font-bold text-sm">Şifreyi Kaydet</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </>
    );
};

// ─── Support Ticket (inline expandable) ──────────────────────────────────────
const SupportSection = ({ last }) => {
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (!subject.trim() || !message.trim()) return Alert.alert('Eksik', 'Konu ve mesaj alanlarını doldur.');
        setSending(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('support_tickets').insert({
            user_id: user?.id, subject: subject.trim(), message: message.trim(), status: 'open',
        });
        setSending(false);
        if (error) return Alert.alert('Hata', error.message);
        Alert.alert('Gönderildi', 'Talebiniz alındı. En kısa sürede dönüş yapacağız.');
        setSubject(''); setMessage(''); setOpen(false);
    };

    return (
        <>
            <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.7}
                className={`flex-row items-center justify-between px-5 py-4 ${!last || open ? 'border-b border-white/[0.06]' : ''}`}>
                <View className="flex-row items-center flex-1">
                    <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]">
                        <HelpCircle color="#9CA3AF" size={17} />
                    </View>
                    <View>
                        <Text className="text-white font-semibold text-[15px]">Destek Talebi</Text>
                        <Text className="text-gray-500 text-[12px] mt-0.5">Sorununu bize ilet</Text>
                    </View>
                </View>
                <ChevronRight color="#4B5563" size={18} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>

            {open && (
                <View className="mx-4 mb-4 mt-1 p-4 rounded-2xl border border-white/[0.07] bg-black/20">
                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">KONU</Text>
                    <View className="bg-black/30 rounded-xl border border-white/10 px-4 h-12 justify-center mb-3">
                        <TextInput className="text-white text-sm" value={subject} onChangeText={setSubject} placeholder="Konu başlığı" placeholderTextColor="#4b5563" />
                    </View>

                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">MESAJ</Text>
                    <View className="bg-black/30 rounded-xl border border-white/10 p-4 min-h-[90px] mb-4">
                        <TextInput
                            className="text-white text-sm leading-5"
                            value={message} onChangeText={setMessage}
                            placeholder="Sorunu açıkla..." placeholderTextColor="#4b5563"
                            multiline textAlignVertical="top"
                        />
                    </View>

                    <TouchableOpacity onPress={send} disabled={sending}
                        className="bg-soft-gold h-11 rounded-xl items-center justify-center flex-row gap-2">
                        {sending ? <ActivityIndicator color="black" size="small" /> : (
                            <><Send color="black" size={15} /><Text className="text-midnight font-bold text-sm">Talebi Gönder</Text></>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </>
    );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
    const [notifEnabled, setNotifEnabled] = useState(true);

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

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* Master backgrounds */}
            <LinearGradient colors={['#12153d', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-64 h-64 bg-soft-gold/4 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center border-b border-white/5">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 mr-4"
                    >
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white font-bold text-xl">Ayarlar</Text>
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

                    {/* ── HESAP ── */}
                    <SectionLabel title="HESAP" />
                    <GlassCard className="overflow-hidden">
                        <MenuItem icon={User} title="Profil Bilgileri" subtitle="Ad, biyografi, kategori..." onPress={() => navigation.navigate('MyProfile')} />
                        <PasswordSection />
                        <MenuItem icon={Smartphone} title="Bağlı Hesaplar" subtitle="Instagram hesap bağlantısı" iconColor="#E1306C" onPress={() => navigation.navigate('MyProfile')} last />
                    </GlassCard>

                    {/* ── TERCİHLER ── */}
                    <SectionLabel title="TERCİHLER" />
                    <GlassCard>
                        <MenuItem icon={Bell} title="Bildirimler" subtitle="Push bildirimlerini yönet" hasSwitch value={notifEnabled} onValueChange={setNotifEnabled} last />
                    </GlassCard>

                    {/* ── DESTEK ── */}
                    <SectionLabel title="DESTEK" />
                    <GlassCard>
                        <SupportSection />
                        <MenuItem icon={Mail} title="Bize Ulaşın" subtitle="support@influmatch.net"
                            onPress={() => Alert.alert('İletişim', 'support@influmatch.net\nadresine e-posta gönderebilirsiniz.')} />
                        <MenuItem icon={FileText} title="Kullanım Koşulları"
                            onPress={() => Alert.alert('Kullanım Koşulları', 'influmatch.net/terms adresinden erişebilirsiniz.')} last />
                    </GlassCard>

                    {/* ── ÇIKIŞ ── */}
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="mt-7 bg-red-500/8 border border-red-500/20 p-4 rounded-[22px] flex-row items-center justify-center gap-3"
                    >
                        <View className="w-9 h-9 bg-red-500/10 rounded-xl items-center justify-center border border-red-500/15">
                            <LogOut color="#EF4444" size={17} />
                        </View>
                        <Text className="text-red-500 font-bold text-base">Çıkış Yap</Text>
                    </TouchableOpacity>

                    <Text className="text-gray-700 text-[11px] text-center mt-5">InfluMatch v1.0 · influmatch.net</Text>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
