import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Switch,
    TextInput, ActivityIndicator, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ArrowLeft, User, Lock, Smartphone, Bell, Mail,
    FileText, LogOut, ChevronRight, Eye, EyeOff,
    HelpCircle, Send, Info
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

const SectionLabel = ({ title }) => (
    <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest mt-7 mb-3 ml-1 uppercase">
        {title}
    </Text>
);

const GlassCard = ({ children, className }) => (
    <View className={`bg-white/[0.04] border border-white/10 rounded-[22px] overflow-hidden ${className || ''}`}>
        <LinearGradient
            colors={['rgba(255,255,255,0.05)', 'transparent']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </View>
);

const MenuItem = ({ icon: Icon, iconColor = '#9CA3AF', title, subtitle, onPress, last }) => (
    <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`flex-row items-center px-5 py-4 ${!last ? 'border-b border-white/[0.06]' : ''}`}
    >
        <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]"
            style={{ backgroundColor: `${iconColor}15` }}>
            <Icon color={iconColor} size={17} />
        </View>
        <View className="flex-1">
            <Text className="text-white font-semibold text-[15px]">{title}</Text>
            {subtitle && <Text className="text-gray-500 text-[12px] mt-0.5">{subtitle}</Text>}
        </View>
        <ChevronRight color="#4B5563" size={18} />
    </TouchableOpacity>
);

const PasswordSection = () => {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNext, setShowNext] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleChange = async () => {
        if (!current || !next || !confirm) return Alert.alert('Eksik Alan', 'Tüm alanları doldur.');
        if (next !== confirm) return Alert.alert('Hata', 'Yeni şifreler eşleşmiyor.');
        if (next.length < 8) return Alert.alert('Hata', 'Şifre en az 8 karakter olmalı.');
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
            if (signInErr) throw new Error('Mevcut şifre yanlış.');
            const { error } = await supabase.auth.updateUser({ password: next });
            if (error) throw error;
            Alert.alert('Başarılı ✓', 'Şifren güncellendi.');
            setCurrent(''); setNext(''); setConfirm(''); setOpen(false);
        } catch (e) {
            Alert.alert('Hata', e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View>
            <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.7}
                className="flex-row items-center px-5 py-4 border-b border-white/[0.06]">
                <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]"
                    style={{ backgroundColor: '#a855f715' }}>
                    <Lock color="#a855f7" size={17} />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-semibold text-[15px]">Şifre Değiştir</Text>
                    <Text className="text-gray-500 text-[12px] mt-0.5">Hesap güvenliğini güncelle</Text>
                </View>
                <ChevronRight color="#4B5563" size={18} style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>

            {open && (
                <View className="mx-4 mb-4 mt-1 p-4 rounded-2xl border border-white/[0.07] bg-black/20">
                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">MEVCUT ŞİFRE</Text>
                    <View className="flex-row items-center bg-black/30 rounded-xl border border-white/10 px-4 h-12 mb-3">
                        <TextInput className="flex-1 text-white text-sm" value={current} onChangeText={setCurrent}
                            placeholder="••••••••" placeholderTextColor="#4b5563"
                            secureTextEntry={!showCurrent} autoCapitalize="none" />
                        <TouchableOpacity onPress={() => setShowCurrent(v => !v)} hitSlop={10}>
                            {showCurrent ? <EyeOff color="#6b7280" size={16} /> : <Eye color="#6b7280" size={16} />}
                        </TouchableOpacity>
                    </View>

                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">YENİ ŞİFRE</Text>
                    <View className="flex-row items-center bg-black/30 rounded-xl border border-white/10 px-4 h-12 mb-3">
                        <TextInput className="flex-1 text-white text-sm" value={next} onChangeText={setNext}
                            placeholder="Min. 8 karakter" placeholderTextColor="#4b5563"
                            secureTextEntry={!showNext} autoCapitalize="none" />
                        <TouchableOpacity onPress={() => setShowNext(v => !v)} hitSlop={10}>
                            {showNext ? <EyeOff color="#6b7280" size={16} /> : <Eye color="#6b7280" size={16} />}
                        </TouchableOpacity>
                    </View>

                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">YENİ ŞİFRE (TEKRAR)</Text>
                    <View className={`flex-row items-center bg-black/30 rounded-xl border px-4 h-12 mb-4 ${confirm && next !== confirm ? 'border-red-500/50' : 'border-white/10'}`}>
                        <TextInput className="flex-1 text-white text-sm" value={confirm} onChangeText={setConfirm}
                            placeholder="••••••••" placeholderTextColor="#4b5563" secureTextEntry autoCapitalize="none" />
                    </View>

                    <TouchableOpacity onPress={handleChange} disabled={saving}
                        className="bg-soft-gold h-11 rounded-xl items-center justify-center">
                        {saving ? <ActivityIndicator color="black" size="small" /> :
                            <Text className="text-midnight font-bold text-sm">Şifreyi Güncelle</Text>}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const NotificationsSection = () => {
    const [enabled, setEnabled] = useState(true);
    const [saving, setSaving] = useState(false);

    useFocusEffect(useCallback(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('push_notifications_enabled').eq('id', user.id).maybeSingle();
            if (data && data.push_notifications_enabled !== null) setEnabled(data.push_notifications_enabled);
        })();
    }, []));

    const toggle = async (val) => {
        setEnabled(val);
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('users').update({ push_notifications_enabled: val }).eq('id', user.id);
        } catch (e) {
            setEnabled(!val);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View className="flex-row items-center px-5 py-4">
            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]"
                style={{ backgroundColor: '#f59e0b15' }}>
                <Bell color="#f59e0b" size={17} />
            </View>
            <View className="flex-1">
                <Text className="text-white font-semibold text-[15px]">Bildirimler</Text>
                <Text className="text-gray-500 text-[12px] mt-0.5">
                    {saving ? 'Kaydediliyor...' : enabled ? 'Aktif' : 'Kapalı'}
                </Text>
            </View>
            <Switch value={enabled} onValueChange={toggle}
                trackColor={{ false: '#1f2937', true: '#D4AF37' }}
                thumbColor={enabled ? '#fff' : '#6b7280'} />
        </View>
    );
};

const UsernameInfoSection = () => {
    const [username, setUsername] = useState('');

    useFocusEffect(useCallback(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('username').eq('id', user.id).maybeSingle();
            if (data?.username) setUsername(data.username);
        })();
    }, []));

    return (
        <View className="px-5 py-4 border-b border-white/[0.06]">
            <View className="flex-row items-center mb-2">
                <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]"
                    style={{ backgroundColor: '#60a5fa15' }}>
                    <Info color="#60a5fa" size={17} />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-semibold text-[15px]">
                        Kullanıcı Adı: <Text className="text-soft-gold">@{username || '...'}</Text>
                    </Text>
                </View>
            </View>
            <Text className="text-gray-600 text-[11px] ml-[52px] leading-5">
                Kullanıcı adı yalnızca üyelik sırasında belirlenir ve sonradan değiştirilemez.{' '}
                Değiştirmek için{' '}
                <Text className="text-blue-400"
                    onPress={() => Linking.openURL('mailto:destek@influmatch.net?subject=Kullanıcı Adı Değişikliği')}>
                    destek@influmatch.net
                </Text>{' '}
                adresine destek talebi oluşturun.
            </Text>
        </View>
    );
};

const SupportSection = () => {
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
        <View>
            <TouchableOpacity onPress={() => setOpen(v => !v)} activeOpacity={0.7}
                className={`flex-row items-center px-5 py-4 border-b border-white/[0.06]`}>
                <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center mr-4 border border-white/[0.07]">
                    <HelpCircle color="#9CA3AF" size={17} />
                </View>
                <View className="flex-1">
                    <Text className="text-white font-semibold text-[15px]">Destek Talebi</Text>
                    <Text className="text-gray-500 text-[12px] mt-0.5">Sorununu bize ilet</Text>
                </View>
                <ChevronRight color="#4B5563" size={18}
                    style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }} />
            </TouchableOpacity>

            {open && (
                <View className="mx-4 mb-4 mt-1 p-4 rounded-2xl border border-white/[0.07] bg-black/20">
                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">KONU</Text>
                    <View className="bg-black/30 rounded-xl border border-white/10 px-4 h-12 justify-center mb-3">
                        <TextInput className="text-white text-sm" value={subject} onChangeText={setSubject}
                            placeholder="Konu başlığı" placeholderTextColor="#4b5563" />
                    </View>
                    <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">MESAJ</Text>
                    <View className="bg-black/30 rounded-xl border border-white/10 p-4 min-h-[90px] mb-4">
                        <TextInput className="text-white text-sm leading-5" value={message} onChangeText={setMessage}
                            placeholder="Sorunu açıkla..." placeholderTextColor="#4b5563" multiline textAlignVertical="top" />
                    </View>
                    <TouchableOpacity onPress={send} disabled={sending}
                        className="bg-soft-gold h-11 rounded-xl items-center justify-center">
                        {sending ? <ActivityIndicator color="black" size="small" /> : (
                            <View className="flex-row items-center gap-2">
                                <Send color="black" size={15} />
                                <Text className="text-midnight font-bold text-sm">Talebi Gönder</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

export default function SettingsScreen({ navigation }) {
    const [role, setRole] = useState(null);

    useFocusEffect(useCallback(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
            if (data) setRole(data.role);
        })();
    }, []));

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
            <LinearGradient colors={['#12153d', '#020617', '#020617']} className="absolute inset-0" />
            <SafeAreaView className="flex-1">
                <View className="px-6 py-4 flex-row items-center border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()}
                        className="w-11 h-11 bg-white/5 rounded-2xl items-center justify-center border border-white/10 mr-4">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white font-bold text-xl">Ayarlar</Text>
                </View>

                <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

                    <SectionLabel title="HESAP" />
                    <GlassCard>
                        <MenuItem
                            icon={User}
                            iconColor="#D4AF37"
                            title="Profil Bilgileri"
                            subtitle="Ad, biyografi, kategori..."
                            onPress={() => {
                                if (role === 'brand') {
                                    navigation.navigate('BrandDashboard', { screen: 'Profil' });
                                } else {
                                    navigation.navigate('MyProfile');
                                }
                            }}
                        />
                        <UsernameInfoSection />
                        <PasswordSection />
                        {role !== 'brand' && (
                            <MenuItem
                                icon={Smartphone}
                                iconColor="#E1306C"
                                title="Bağlı Hesaplar"
                                subtitle="Instagram hesap bağlantısı"
                                onPress={() => navigation.navigate('MyProfile')}
                                last
                            />
                        )}
                    </GlassCard>

                    <SectionLabel title="TERCİHLER" />
                    <GlassCard>
                        <NotificationsSection />
                    </GlassCard>

                    <SectionLabel title="DESTEK" />
                    <GlassCard className="mb-4">
                        <SupportSection />
                        <MenuItem icon={Mail} iconColor="#4ade80" title="Bize Ulaşın"
                            subtitle="destek@influmatch.net"
                            onPress={() => Linking.openURL('mailto:destek@influmatch.net')} />
                        <MenuItem icon={FileText} iconColor="#60a5fa" title="Kullanım Koşulları"
                            onPress={() => Linking.openURL('https://influmatch.net/legal?tab=terms')} last />
                    </GlassCard>

                    <Text className="text-gray-700 text-[10px] text-center mt-12 mb-4">InfluMatch v1.0 • influmatch.net</Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
