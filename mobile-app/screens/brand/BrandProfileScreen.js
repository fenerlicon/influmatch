import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Mail, Phone, Globe, Camera, LogOut, ChevronRight, Shield, FileText, HelpCircle, Edit3, Check, X, Send, Settings } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { decode } from 'base64-arraybuffer';

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

const InfoRow = ({ label, value, last, editing, edit, onEditChange, onStartEdit, onSave, onCancel }) => (
    <View className={`px-5 py-4 flex-row items-center justify-between ${!last ? 'border-b border-white/[0.06]' : ''}`}>
        <View className="flex-1 mr-4">
            <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</Text>
            {editing ? (
                <View className="flex-row items-center gap-2">
                    <TextInput
                        className="flex-1 text-white text-sm bg-black/20 border border-white/10 rounded-xl px-3 py-2"
                        value={edit}
                        onChangeText={onEditChange}
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
                <Text className="text-white text-sm font-medium" numberOfLines={2}>
                    {value || <Text className="text-gray-600 italic">Belirtilmemiş</Text>}
                </Text>
            )}
        </View>
        {!editing && (
            <TouchableOpacity onPress={onStartEdit} className="w-8 h-8 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                <Edit3 color="#9ca3af" size={14} />
            </TouchableOpacity>
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

    const [supportOpen, setSupportOpen] = useState(false);
    const [supportSubject, setSupportSubject] = useState('');
    const [supportMessage, setSupportMessage] = useState('');
    const [sendingSupport, setSendingSupport] = useState(false);

    const sendSupport = async () => {
        if (!supportSubject.trim() || !supportMessage.trim()) return Alert.alert('Eksik', 'Konu ve mesaj alanlarını doldur.');
        setSendingSupport(true);
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase.from('support_tickets').insert({
            user_id: user?.id, subject: supportSubject.trim(), message: supportMessage.trim(), status: 'open', priority: 'Orta'
        });
        setSendingSupport(false);
        if (error) {
            console.error(error);
            return Alert.alert('Hata', error.message);
        }
        Alert.alert('Gönderildi', 'Destek talebiniz başarıyla oluşturuldu. Yöneticilerimiz en kısa sürede size dönüş yapacaktır.');
        setSupportSubject(''); setSupportMessage(''); setSupportOpen(false);
    };

    const fetchProfile = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('[BrandProfile] No user found');
                return;
            }
            console.log('[BrandProfile] Fetching profile for:', user.id);

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                console.log('[BrandProfile] Profile data fetched:', data);
                setProfile({
                    ...data,
                    website: data.social_links?.website || '',
                });
            } else {
                console.log('[BrandProfile] No profile data found for this ID');
            }
        } catch (e) {
            console.error('[BrandProfile] fetchProfile error:', e);
            Alert.alert('Hata', 'Profil bilgileri yüklenemedi.');
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    const startEdit = (field, currentValue) => {
        setEditField(field);
        setEditValue(currentValue || '');
    };

    const pickAvatar = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return Alert.alert('İzin Gerekli', 'Galeri erişim izni gerekiyor.');

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5, // Reduced quality for faster upload
                base64: true,
            });

            if (result.canceled) return;

            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            const ext = 'jpg';
            const path = `public/${user.id}/avatar_${Date.now()}.${ext}`;

            const { error: upErr } = await supabase.storage
                .from('avatars')
                .upload(path, decode(result.assets[0].base64), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (upErr) throw upErr;

            const { data: urlD } = supabase.storage.from('avatars').getPublicUrl(path);
            const url = `${urlD.publicUrl}?t=${Date.now()}`;

            const { error: dbErr } = await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
            if (dbErr) throw dbErr;

            setProfile(p => ({ ...p, avatar_url: url }));
            Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi.');
        } catch (e) {
            console.error('[BrandProfile] pickAvatar error:', e);
            Alert.alert('Hata', e.message || 'Fotoğraf yüklenemedi.');
        } finally {
            setSaving(false);
        }
    };

    const saveField = async () => {
        if (!editField) return;
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            let updates = { [editField]: editValue.trim() };
            console.log(`[BrandProfile] Updating field ${editField} with value:`, editValue.trim());

            if (editField === 'website') {
                const newSocial = { ...(profile.social_links || {}), website: editValue.trim() };
                updates = { social_links: newSocial };

                const { error } = await supabase.from('users').update(updates).eq('id', user.id);
                if (error) throw error;

                setProfile(prev => ({
                    ...prev,
                    website: editValue.trim(),
                    social_links: newSocial
                }));
            } else {
                const { error } = await supabase.from('users').update(updates).eq('id', user.id);
                if (error) throw error;

                setProfile(prev => ({ ...prev, [editField]: editValue.trim() }));
            }
            console.log('[BrandProfile] Update successful');

            setEditField(null);
        } catch (e) {
            console.error('[BrandProfile] saveField error:', e);
            Alert.alert('Hata', e.message || 'Bilgi güncellenemedi.');
        } finally {
            setSaving(false);
        }
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

    const initials = (profile?.company_legal_name || profile?.full_name || '?').substring(0, 2).toUpperCase();

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-72 h-72 bg-soft-gold/4 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1">
                <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

                    {/* ── Hero ── */}
                    <View className="items-center pt-8 pb-6" style={{ zIndex: 10 }}>
                        <View className="relative mb-4" style={{ zIndex: 10 }}>
                            <TouchableOpacity
                                onPress={pickAvatar}
                                activeOpacity={0.7}
                                className="w-24 h-24 rounded-full bg-[#1A1D24] border-2 border-soft-gold/40 items-center justify-center overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                                style={{ zIndex: 1 }}
                            >
                                {profile?.avatar_url
                                    ? <Image source={{ uri: `${profile.avatar_url}${profile.avatar_url.includes('?') ? '&' : '?'}t=${Date.now()}` }} className="w-full h-full" resizeMode="cover" />
                                    : <Text className="text-white text-3xl font-black">{initials}</Text>}

                                {saving && (
                                    <View className="absolute inset-0 bg-black/60 items-center justify-center">
                                        <ActivityIndicator color="#D4AF37" size="small" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={pickAvatar}
                                activeOpacity={0.8}
                                className="absolute bottom-0 right-0 w-8 h-8 bg-soft-gold rounded-full items-center justify-center border-2 border-[#020617] shadow-lg"
                                style={{ zIndex: 100 }}
                            >
                                <Camera size={14} color="black" />
                            </TouchableOpacity>

                            {isVerified && (
                                <View
                                    className="absolute -top-1 -right-1 w-7 h-7 bg-blue-500 rounded-full items-center justify-center border-2 border-[#020617]"
                                    style={{ zIndex: 100 }}
                                >
                                    <Shield color="white" size={13} />
                                </View>
                            )}
                        </View>

                        <Text className="text-white text-2xl font-black tracking-tight">
                            {profile?.company_legal_name || profile?.full_name || 'Marka'}
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
                            { label: 'Şirket / Marka Adı', field: 'company_legal_name', icon: Building2 },
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
                                onEditChange={setEditValue}
                                onStartEdit={() => startEdit(row.field, profile?.[row.field])}
                                onSave={saveField}
                                onCancel={() => setEditField(null)}
                            />
                        ))}
                    </GlassCard>

                    <Text className="text-gray-600 text-[11px] mt-2 ml-2 leading-4">Bilgilerinizi düzenlemek için sağdaki kalem ikonuna dokunun.</Text>

                    {/* ── Bio ── */}
                    <SectionLabel title="HAKKINDA" />
                    <GlassCard>
                        <InfoRow
                            label="Marka Açıklaması"
                            value={profile?.bio}
                            last
                            editing={editField === 'bio'}
                            edit={editValue}
                            onEditChange={setEditValue}
                            onStartEdit={() => startEdit('bio', profile?.bio)}
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

                    {/* ── Settings / Support / Docs ── */}
                    <SectionLabel title="AYARLAR VE DESTEK" />
                    <GlassCard>
                        <TouchableOpacity className="px-5 py-4 flex-row items-center gap-4 border-b border-white/[0.06]"
                            onPress={() => navigation.navigate('Settings')}>
                            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/[0.07]">
                                <Settings color="#9ca3af" size={17} />
                            </View>
                            <Text className="text-white font-semibold text-sm flex-1">Ayarlar</Text>
                            <ChevronRight color="#4b5563" size={16} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setSupportOpen(v => !v)} activeOpacity={0.7}
                            className={`flex-row items-center px-5 py-4 ${!supportOpen ? 'border-b border-white/[0.06]' : ''}`}>
                            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/[0.07]">
                                <HelpCircle color="#9CA3AF" size={17} />
                            </View>
                            <View className="flex-1 ml-4">
                                <Text className="text-white font-semibold text-sm">Yardım & Destek Talebi</Text>
                            </View>
                            <ChevronRight color="#4B5563" size={18}
                                style={{ transform: [{ rotate: supportOpen ? '90deg' : '0deg' }] }} />
                        </TouchableOpacity>

                        {supportOpen && (
                            <View className="mx-4 mb-4 mt-1 p-4 rounded-xl border border-white/[0.07] bg-black/20">
                                <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">KONU *</Text>
                                <View className="bg-black/30 rounded-xl border border-white/10 px-4 h-12 justify-center mb-3">
                                    <TextInput className="text-white text-sm" value={supportSubject} onChangeText={setSupportSubject}
                                        placeholder="Örn: Ödeme Sorunu, Şikayet, vs." placeholderTextColor="#4b5563" />
                                </View>

                                <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">MESAJ *</Text>
                                <View className="bg-black/30 rounded-xl border border-white/10 p-4 min-h-[90px] mb-4">
                                    <TextInput className="text-white text-sm leading-5" value={supportMessage} onChangeText={setSupportMessage}
                                        placeholder="Detaylı bir şekilde açıklayın..." placeholderTextColor="#4b5563" multiline textAlignVertical="top" />
                                </View>

                                <TouchableOpacity onPress={sendSupport} disabled={sendingSupport}
                                    className="bg-soft-gold h-11 rounded-xl items-center justify-center">
                                    {sendingSupport ? <ActivityIndicator color="black" size="small" /> : (
                                        <View className="flex-row items-center gap-2">
                                            <Send color="black" size={15} />
                                            <Text className="text-midnight font-bold text-sm">Talebi Gönder</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity className={`px-5 py-4 flex-row items-center gap-4 ${supportOpen ? 'border-t border-white/[0.06]' : ''}`}
                            onPress={() => Alert.alert('Koşullar', 'influmatch.net/terms adresinden erişebilirsiniz.')}>
                            <View className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center border border-white/[0.07]">
                                <FileText color="#9ca3af" size={17} />
                            </View>
                            <Text className="text-white font-semibold text-sm flex-1">Kullanım Koşulları</Text>
                            <ChevronRight color="#4b5563" size={16} />
                        </TouchableOpacity>
                    </GlassCard>

                    <View className="h-12" />

                    {/* ── Logout ── */}
                    <TouchableOpacity onPress={handleLogout} activeOpacity={0.7}
                        className="bg-red-500/8 border border-red-500/20 py-3 rounded-2xl flex-row items-center justify-center">
                        <LogOut color="#EF4444" size={24} style={{ marginRight: 10 }} />
                        <Text className="text-red-500 font-bold text-sm" style={{ includeFontPadding: false, textAlignVertical: 'center' }}>Çıkış Yap</Text>
                    </TouchableOpacity>

                    <Text className="text-gray-700 text-[11px] text-center mt-8 mb-4">InfluMatch v1.0 · influmatch.net</Text>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
