import React, { useState, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    Image, ActivityIndicator, Alert, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ChevronLeft, Camera, Save, User, Briefcase,
    Link as LinkIcon, Edit2, Instagram, CheckCircle2, X, AtSign
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

// ─── Production URL ───────────────────────────────────────────────────────────
const API_BASE = 'https://influmatch.vercel.app';

// ─── Reusable input field ──────────────────────────────────────────────────────
const Field = ({ label, icon: Icon, value, onChange, placeholder, multiline = false }) => (
    <View className="mb-5">
        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">{label}</Text>
        <View className={`flex-row items-${multiline ? 'start' : 'center'} bg-black/30 border border-white/10 rounded-xl px-4 ${multiline ? 'pt-3 min-h-[80px]' : 'h-12'}`}>
            {Icon && <Icon size={17} color="#4b5563" style={{ marginRight: 10, marginTop: multiline ? 2 : 0 }} />}
            <TextInput
                className="flex-1 text-white text-sm font-medium"
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#374151"
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
                autoCapitalize="none"
            />
        </View>
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function MyProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '', username: '', bio: '', website: '', category: '', avatar_url: null,
    });
    const [igAccount, setIgAccount] = useState(null); // existing connected account

    // Instagram connect modal
    const [modalVisible, setModalVisible] = useState(false);
    const [igUsername, setIgUsername] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [connectSuccess, setConnectSuccess] = useState(false);

    const fetchProfile = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: prof }, { data: social }] = await Promise.all([
                supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
                supabase.from('social_accounts')
                    .select('username, follower_count, engagement_rate, is_verified')
                    .eq('user_id', user.id).eq('platform', 'instagram').maybeSingle(),
            ]);

            if (prof) {
                setProfile({
                    full_name: prof.full_name || '',
                    username: prof.username || '',
                    bio: prof.bio || '',
                    website: prof.website || '',
                    category: prof.category || '',
                    avatar_url: prof.avatar_url || null,
                });
            }
            setIgAccount(social || null);
        } catch (e) {
            console.error('[MyProfile fetch]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    // ── Save profile info ──────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Kullanıcı bulunamadı.');

            const { error } = await supabase.from('users').update({
                full_name: profile.full_name.trim(),
                username: profile.username.trim().toLowerCase(),
                bio: profile.bio.trim(),
                website: profile.website.trim(),
                category: profile.category.trim(),
                updated_at: new Date().toISOString(),
            }).eq('id', user.id);

            if (error) throw error;
            Alert.alert('Başarılı ✓', 'Profil bilgilerin güncellendi.');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Hata', e.message || 'Kaydedilemedi.');
        } finally {
            setSaving(false);
        }
    };

    // ── Avatar upload ────────────────────────────────────────────────────────
    const pickAvatar = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('İzin Gerekli', 'Fotoğraf galerisine erişim izni gerekiyor.');

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (result.canceled) return;

        const asset = result.assets[0];
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            const res = await fetch(asset.uri);
            const blob = await res.blob();
            const ext = asset.uri.split('.').pop() || 'jpg';
            const filePath = `${user.id}/avatar.${ext}`;

            const { error: upErr } = await supabase.storage.from('avatars').upload(filePath, blob, { upsert: true, contentType: `image/${ext}` });
            if (upErr) throw upErr;

            const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
            const url = `${urlData.publicUrl}?t=${Date.now()}`;
            await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
            setProfile(p => ({ ...p, avatar_url: url }));
        } catch (e) {
            Alert.alert('Hata', e.message || 'Fotoğraf yüklenemedi.');
        } finally {
            setSaving(false);
        }
    };

    // ── Instagram connect (username only, no code) ────────────────────────────
    const handleConnect = async () => {
        const clean = igUsername.trim().replace(/^@/, '').toLowerCase();
        if (!clean) return Alert.alert('Uyarı', 'Kullanıcı adı boş olamaz.');

        setConnecting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');

            const response = await fetch(`${API_BASE}/api/mobile/verify-instagram`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    action: 'connect',
                    userId: session.user.id,
                    username: clean,
                }),
            });

            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Bağlanamadı.');

            setIgAccount({
                username: data.data.username,
                follower_count: data.data.follower_count,
                engagement_rate: data.data.engagement_rate,
                is_verified: true,
            });
            setConnectSuccess(true);
        } catch (e) {
            Alert.alert('Hata', e.message || 'Bağlantı hatası.');
        } finally {
            setConnecting(false);
        }
    };

    const closeModal = () => {
        setModalVisible(false);
        setIgUsername('');
        setConnectSuccess(false);
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    const initials = (profile.full_name || profile.username || '?').substring(0, 2).toUpperCase();
    const followerText = igAccount?.follower_count
        ? igAccount.follower_count >= 1000
            ? (igAccount.follower_count / 1000).toFixed(1) + 'K'
            : String(igAccount.follower_count)
        : null;

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center justify-between border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()}
                        className="w-10 h-10 bg-white/5 rounded-2xl items-center justify-center border border-white/10">
                        <ChevronLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white text-base font-bold">Profili Düzenle</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

                    {/* ── Avatar ── */}
                    <View className="items-center mb-8">
                        <TouchableOpacity onPress={pickAvatar} className="relative">
                            <View className="w-24 h-24 rounded-full bg-[#1A1D24] border-2 border-soft-gold/40 items-center justify-center overflow-hidden">
                                {profile.avatar_url
                                    ? <Image source={{ uri: profile.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                    : <Text className="text-white text-2xl font-black">{initials}</Text>}
                            </View>
                            <View className="absolute bottom-0 right-0 w-8 h-8 bg-soft-gold rounded-full items-center justify-center border-2 border-[#020617]">
                                <Camera size={14} color="black" />
                            </View>
                        </TouchableOpacity>
                        <Text className="text-gray-600 text-xs mt-2">Fotoğrafı değiştirmek için dokun</Text>
                    </View>

                    {/* ── Instagram Section ── */}
                    <Text className="text-soft-gold/70 text-[10px] font-bold tracking-[0.3em] uppercase mb-3 ml-1">INSTAGRAM</Text>
                    <View className="bg-white/[0.04] border border-white/10 rounded-[20px] overflow-hidden mb-6">
                        <LinearGradient colors={['rgba(255,255,255,0.05)', 'transparent']} className="absolute inset-0" />
                        <View className="px-5 py-4 flex-row items-center justify-between">
                            <View className="flex-row items-center gap-3">
                                <View className="w-10 h-10 rounded-[14px] items-center justify-center" style={{ backgroundColor: 'rgba(168,85,247,0.15)' }}>
                                    <Instagram color="#a855f7" size={18} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-sm">
                                        {igAccount ? `@${igAccount.username}` : 'Instagram'}
                                    </Text>
                                    {igAccount && followerText ? (
                                        <Text className="text-gray-500 text-xs">
                                            {followerText} takipçi · %{igAccount.engagement_rate} etkileşim
                                        </Text>
                                    ) : (
                                        <Text className="text-gray-600 text-xs">Bağlı değil</Text>
                                    )}
                                </View>
                            </View>

                            {igAccount?.is_verified ? (
                                <TouchableOpacity onPress={() => setModalVisible(true)}
                                    className="flex-row items-center gap-1.5 bg-green-500/10 border border-green-500/25 px-3 py-1.5 rounded-xl">
                                    <CheckCircle2 size={12} color="#4ade80" />
                                    <Text className="text-green-400 text-xs font-bold">Bağlı</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity onPress={() => setModalVisible(true)}
                                    className="bg-purple-500/15 border border-purple-500/30 px-4 py-2 rounded-xl">
                                    <Text className="text-purple-300 text-xs font-bold">Bağla</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* ── Profile Fields ── */}
                    <Text className="text-soft-gold/70 text-[10px] font-bold tracking-[0.3em] uppercase mb-3 ml-1">PROFİL BİLGİLERİ</Text>

                    <Field label="Ad Soyad" icon={User} value={profile.full_name}
                        onChange={v => setProfile(p => ({ ...p, full_name: v }))} placeholder="Adın ve soyadın" />

                    <View className="mb-5">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">KULLANICI ADI</Text>
                        <View className="flex-row items-center bg-black/30 border border-white/10 rounded-xl px-4 h-12">
                            <AtSign size={17} color="#4b5563" style={{ marginRight: 8 }} />
                            <TextInput
                                className="flex-1 text-white text-sm font-medium"
                                value={profile.username}
                                onChangeText={v => setProfile(p => ({ ...p, username: v }))}
                                placeholder="kullaniciadi"
                                placeholderTextColor="#374151"
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <Field label="Kategori" icon={Briefcase} value={profile.category}
                        onChange={v => setProfile(p => ({ ...p, category: v }))} placeholder="Ör: Teknoloji, Moda, Spor..." />

                    <Field label="Website" icon={LinkIcon} value={profile.website}
                        onChange={v => setProfile(p => ({ ...p, website: v }))} placeholder="https://..." />

                    <Field label="Biyografi" icon={Edit2} value={profile.bio}
                        onChange={v => setProfile(p => ({ ...p, bio: v }))} placeholder="Kendini tanıt..." multiline />

                    {/* ── Save button ── */}
                    <TouchableOpacity onPress={handleSave} disabled={saving}
                        className="bg-soft-gold h-14 rounded-2xl items-center justify-center flex-row gap-2 shadow-lg shadow-soft-gold/20 mt-2">
                        {saving
                            ? <ActivityIndicator color="black" />
                            : <>
                                <Save color="black" size={18} />
                                <Text className="text-black font-bold text-base">Kaydet</Text>
                            </>}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

            {/* ── Instagram Connect Modal ─────────────────────────────────────── */}
            <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={closeModal}>
                <View className="flex-1 bg-black/80 justify-end">
                    <TouchableOpacity className="flex-1" onPress={closeModal} />
                    <View className="bg-[#0B0F19] border-t border-white/10 rounded-t-[32px] px-6 pt-6 pb-12">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-white font-bold text-xl">Instagram Hesabını Bağla</Text>
                            <TouchableOpacity onPress={closeModal}
                                className="w-9 h-9 bg-white/5 rounded-2xl items-center justify-center border border-white/10">
                                <X color="white" size={17} />
                            </TouchableOpacity>
                        </View>

                        {connectSuccess ? (
                            /* ── Success state ── */
                            <View className="items-center py-8">
                                <View className="w-16 h-16 bg-green-500/15 border border-green-500/30 rounded-full items-center justify-center mb-4">
                                    <CheckCircle2 color="#4ade80" size={32} />
                                </View>
                                <Text className="text-white font-bold text-xl mb-2">Bağlandı! 🎉</Text>
                                <Text className="text-gray-400 text-sm text-center mb-2">
                                    @{igAccount?.username} hesabın başarıyla bağlandı.
                                </Text>
                                {followerText && (
                                    <View className="bg-white/5 border border-white/10 px-5 py-3 rounded-2xl mt-2 flex-row gap-6">
                                        <View className="items-center">
                                            <Text className="text-soft-gold font-black text-lg">{followerText}</Text>
                                            <Text className="text-gray-500 text-[10px] uppercase">Takipçi</Text>
                                        </View>
                                        <View className="items-center">
                                            <Text className="text-purple-300 font-black text-lg">%{igAccount?.engagement_rate}</Text>
                                            <Text className="text-gray-500 text-[10px] uppercase">Etkileşim</Text>
                                        </View>
                                    </View>
                                )}
                                <TouchableOpacity onPress={closeModal}
                                    className="mt-6 bg-soft-gold h-12 w-full rounded-2xl items-center justify-center">
                                    <Text className="text-black font-bold">Tamam</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            /* ── Input state ── */
                            <>
                                <Text className="text-gray-400 text-sm leading-5 mb-5">
                                    Instagram kullanıcı adını gir. Profilin herkese açık olmalıdır.
                                </Text>

                                <View className="flex-row items-center bg-black/40 border border-white/15 rounded-2xl px-4 h-14 mb-4">
                                    <Text className="text-gray-500 text-base mr-1">@</Text>
                                    <TextInput
                                        className="flex-1 text-white text-base font-medium"
                                        placeholder="kullaniciadi"
                                        placeholderTextColor="#374151"
                                        value={igUsername}
                                        onChangeText={setIgUsername}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        autoFocus
                                    />
                                </View>

                                <Text className="text-gray-600 text-xs mb-6 ml-1">
                                    ℹ️ Hesabın herkese açık (public) değilse veriler çekilemez.
                                </Text>

                                <TouchableOpacity onPress={handleConnect} disabled={connecting}
                                    className="bg-soft-gold h-14 rounded-2xl items-center justify-center shadow-lg shadow-soft-gold/20">
                                    {connecting
                                        ? <ActivityIndicator color="black" />
                                        : <Text className="text-black font-bold text-base">Hesabı Bağla</Text>}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
