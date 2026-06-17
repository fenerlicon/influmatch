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
    Link as LinkIcon, Edit2, Instagram, CheckCircle2, X, Copy, AtSign, Info, Music
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';

// ─── Production API URL ───────────────────────────────────────────────────────
const API_BASE = 'https://influmatch.vercel.app';

// ─── Input Field Component ────────────────────────────────────────────────────
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

// ─── Step indicator ────────────────────────────────────────────────────────────
const Step = ({ n, active, done }) => (
    <View className="items-center">
        <View className={`w-8 h-8 rounded-full items-center justify-center border-2 ${done ? 'bg-green-500/20 border-green-500' : active ? 'bg-soft-gold/20 border-soft-gold' : 'bg-white/5 border-white/20'}`}>
            {done
                ? <CheckCircle2 size={14} color="#4ade80" />
                : <Text className={`text-xs font-bold ${active ? 'text-soft-gold' : 'text-gray-600'}`}>{n}</Text>}
        </View>
    </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MyProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '', username: '', bio: '', website: '', category: '', avatar_url: null,
    });
    const [igAccount, setIgAccount] = useState(null);
    const [tiktokAccount, setTiktokAccount] = useState(null);
    const [platformToVerify, setPlatformToVerify] = useState('instagram');
    const [portfolio, setPortfolio] = useState([]);

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [step, setStep] = useState(1); // 1: username input, 2: bio code, 3: success
    const [igUsername, setIgUsername] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [verifiedData, setVerifiedData] = useState(null);

    // ── Fetch data ─────────────────────────────────────────────────────────────
    const fetchProfile = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: prof }, { data: social }, { data: tiktok }] = await Promise.all([
                supabase.from('users').select('*').eq('id', user.id).maybeSingle(),
                supabase.from('social_accounts')
                    .select('username, follower_count, engagement_rate, is_verified')
                    .eq('user_id', user.id).eq('platform', 'instagram').maybeSingle(),
                supabase.from('social_accounts')
                    .select('username, follower_count, engagement_rate, is_verified')
                    .eq('user_id', user.id).eq('platform', 'tiktok').maybeSingle(),
            ]);

            if (prof) {
                setProfile({
                    full_name: prof.full_name || '',
                    username: prof.username || '',
                    bio: prof.bio || '',
                    website: prof.social_links?.website || '',
                    social_links: prof.social_links || {},
                    category: prof.category || '',
                    avatar_url: prof.avatar_url || null,
                });
                setPortfolio(prof.portfolio_urls || []);
            }
            setIgAccount(social || null);
            setTiktokAccount(tiktok || null);
        } catch (e) {
            console.error('[MyProfile]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    // ── Save profile ───────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Kullanıcı bulunamadı.');
            const { error } = await supabase.from('users').update({
                full_name: profile.full_name.trim(),
                username: profile.username.trim().toLowerCase(),
                bio: profile.bio.trim(),
                social_links: { ...(profile.social_links || {}), website: profile.website.trim() },
                category: profile.category.trim(),
                portfolio_urls: portfolio,
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

    // ── Avatar upload ──────────────────────────────────────────────────────────
    const pickAvatar = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('İzin Gerekli', 'Galeri erişim izni gerekiyor.');
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.8,
        });
        if (result.canceled) return;
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            const blob = await (await fetch(result.assets[0].uri)).blob();
            const ext = result.assets[0].uri.split('.').pop() || 'jpg';
            const path = `${user.id}/avatar.${ext}`;
            const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
            if (upErr) throw upErr;
            const { data: urlD } = supabase.storage.from('avatars').getPublicUrl(path);
            const url = `${urlD.publicUrl}?t=${Date.now()}`;
            await supabase.from('users').update({ avatar_url: url }).eq('id', user.id);
            setProfile(p => ({ ...p, avatar_url: url }));
        } catch (e) {
            Alert.alert('Hata', e.message || 'Fotoğraf yüklenemedi.');
        } finally {
            setSaving(false);
        }
    };

    // ── Portfolio Upload ──────────────────────────────────────────────────────
    const addPortfolioImage = async () => {
        if (portfolio.length >= 6) return Alert.alert('Limit', 'En fazla 6 adet portfolyo fotoğrafı ekleyebilirsin.');
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return Alert.alert('İzin Gerekli', 'Galeri erişim izni gerekiyor.');
        
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
        });
        
        if (result.canceled) return;
        
        try {
            setSaving(true);
            const { data: { user } } = await supabase.auth.getUser();
            const uri = result.assets[0].uri;
            const blob = await (await fetch(uri)).blob();
            const ext = uri.split('.').pop() || 'jpg';
            const fileName = `portfolio_${Date.now()}.${ext}`;
            const path = `${user.id}/portfolio/${fileName}`;
            
            const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: `image/${ext}` });
            if (upErr) throw upErr;
            
            const { data: urlD } = supabase.storage.from('avatars').getPublicUrl(path);
            const newPortfolio = [...portfolio, urlD.publicUrl];
            
            setPortfolio(newPortfolio);
        } catch (e) {
            Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
        } finally {
            setSaving(false);
        }
    };

    const removePortfolioImage = async (index) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const newPortfolio = portfolio.filter((_, i) => i !== index);
            await supabase.from('users').update({ portfolio_urls: newPortfolio }).eq('id', user.id);
            setPortfolio(newPortfolio);
        } catch (e) {
            Alert.alert('Hata', 'Fotoğraf silinemedi.');
        }
    };

    // ── STEP 1: Generate code ──────────────────────────────────────────────────
    const handleGenerate = async () => {
        const clean = igUsername.trim().replace(/^@/, '').toLowerCase();
        if (!clean) return Alert.alert('Uyarı', 'Kullanıcı adı boş olamaz.');

        setBusy(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');

            const endpoint = platformToVerify === 'tiktok' ? 'verify-tiktok' : 'verify-instagram';
            const res = await fetch(`${API_BASE}/api/mobile/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ action: 'generate', userId: session.user.id, username: clean }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Kod üretilemedi.');
            setVerificationCode(data.code);
            setStep(2);
        } catch (e) {
            Alert.alert('Hata', e.message);
        } finally {
            setBusy(false);
        }
    };

    // ── STEP 2: Verify code in bio ─────────────────────────────────────────────
    const handleVerify = async () => {
        setBusy(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');

            const endpoint = platformToVerify === 'tiktok' ? 'verify-tiktok' : 'verify-instagram';
            const res = await fetch(`${API_BASE}/api/mobile/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
                body: JSON.stringify({ action: 'verify', userId: session.user.id }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Doğrulama başarısız.');

            setVerifiedData(data.data);
            if (platformToVerify === 'tiktok') {
                setTiktokAccount({
                    username: data.data?.username || igUsername.replace(/^@/, ''),
                    follower_count: data.data?.follower_count,
                    engagement_rate: data.data?.engagement_rate,
                    is_verified: true,
                });
            } else {
                setIgAccount({
                    username: data.data?.username || igUsername.replace(/^@/, ''),
                    follower_count: data.data?.follower_count,
                    engagement_rate: data.data?.engagement_rate,
                    is_verified: true,
                });
            }
            setStep(3);
        } catch (e) {
            Alert.alert('Hata', e.message);
        } finally {
            setBusy(false);
        }
    };

    const copyCode = async () => {
        await Clipboard.setStringAsync(verificationCode);
        Alert.alert('Kopyalandı ✓', 'Kodu biyografine yapıştır.');
    };

    const closeModal = () => {
        setModalVisible(false);
        setStep(1);
        setIgUsername('');
        setVerificationCode('');
        setVerifiedData(null);
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
                        <Text className="text-gray-600 text-xs mt-2">Değiştirmek için dokun</Text>
                    </View>

                    {/* ── Profile Fields ── */}
                    <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest uppercase mb-3 ml-1">PROFİL BİLGİLERİ</Text>
                    <Field label="Ad Soyad" icon={User} value={profile.full_name} onChange={v => setProfile(p => ({ ...p, full_name: v }))} placeholder="Adın ve soyadın" />

                    <View className="mb-5">
                        <Text className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">KULLANICI ADI</Text>
                        <View className="flex-row items-center bg-white/[0.03] border border-white/5 rounded-xl px-4 h-12 opacity-60">
                            <AtSign size={17} color="#4b5563" style={{ marginRight: 8 }} />
                            <TextInput
                                className="flex-1 text-white text-sm font-medium"
                                value={profile.username}
                                editable={false}
                            />
                        </View>
                        <Text className="text-gray-600 text-[10px] mt-1 ml-1 font-medium italic">Kullanıcı adı değiştirilemez.</Text>
                    </View>

                    <Field label="Kategori" icon={Briefcase} value={profile.category} onChange={v => setProfile(p => ({ ...p, category: v }))} placeholder="Ör: Teknoloji, Moda, Spor..." />
                    <Field label="Website" icon={LinkIcon} value={profile.website} onChange={v => setProfile(p => ({ ...p, website: v }))} placeholder="https://..." />
                    <Field label="Biyografi" icon={Edit2} value={profile.bio} onChange={v => setProfile(p => ({ ...p, bio: v }))} placeholder="Kendini tanıt..." multiline />

                    {/* ── Portfolio ── */}
                    <View className="mb-8">
                        <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest uppercase mb-3 ml-1">PORTFOLYO (MAX 6)</Text>
                        <View className="flex-row flex-wrap gap-2">
                            {portfolio.map((url, i) => (
                                <View key={i} className="w-[31%] aspect-square rounded-xl bg-white/5 overflow-hidden border border-white/10 relative">
                                    <Image source={{ uri: url }} className="w-full h-full" />
                                    <TouchableOpacity 
                                        onPress={() => removePortfolioImage(i)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full items-center justify-center">
                                        <X color="white" size={12} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {portfolio.length < 6 && (
                                <TouchableOpacity 
                                    onPress={addPortfolioImage}
                                    className="w-[31%] aspect-square rounded-xl bg-white/5 border border-dashed border-white/20 items-center justify-center">
                                    <Camera color="#4b5563" size={24} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* ── Social Connections ── */}
                    <View className="mb-8 mt-4">
                        <Text className="text-soft-gold/70 text-[10px] font-bold tracking-widest uppercase mb-3 ml-1">SOSYAL MEDYA HESAPLARI</Text>
                        
                        {/* Instagram Card */}
                        <View className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 items-center justify-center mr-3">
                                    <Instagram color="#a855f7" size={20} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-sm">Instagram</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {igAccount ? `@${igAccount.username}` : 'Bağlı değil'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    setPlatformToVerify('instagram');
                                    setIgUsername(igAccount?.username || '');
                                    setModalVisible(true);
                                    setStep(igAccount ? 3 : 1);
                                }}
                                className={`px-4 py-2 rounded-xl ${igAccount ? 'bg-white/5 border border-white/10' : 'bg-purple-600'}`}
                            >
                                <Text className={`text-xs font-bold ${igAccount ? 'text-gray-400' : 'text-white'}`}>
                                    {igAccount ? 'Yeniden Bağla' : 'Bağla'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* TikTok Card */}
                        <View className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-3 flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 items-center justify-center mr-3">
                                    <Music color="#22d3ee" size={20} />
                                </View>
                                <View>
                                    <Text className="text-white font-bold text-sm">TikTok</Text>
                                    <Text className="text-gray-500 text-xs mt-0.5">
                                        {tiktokAccount ? `@${tiktokAccount.username}` : 'Bağlı değil'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    setPlatformToVerify('tiktok');
                                    setIgUsername(tiktokAccount?.username || '');
                                    setModalVisible(true);
                                    setStep(tiktokAccount ? 3 : 1);
                                }}
                                className={`px-4 py-2 rounded-xl ${tiktokAccount ? 'bg-white/5 border border-white/10' : 'bg-cyan-600'}`}
                            >
                                <Text className={`text-xs font-bold ${tiktokAccount ? 'text-gray-400' : 'text-white'}`}>
                                    {tiktokAccount ? 'Yeniden Bağla' : 'Bağla'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Save */}
                    <TouchableOpacity onPress={handleSave} disabled={saving}
                        className="bg-soft-gold h-14 rounded-2xl items-center justify-center shadow-lg shadow-soft-gold/20 mt-2 mb-10">
                        {saving ? <ActivityIndicator color="black" /> : <View className="flex-row items-center gap-2"><Save color="black" size={18} /><Text className="text-black font-bold text-base">Kaydet</Text></View>}
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>

            {/* ── INSTAGRAM & TIKTOK VERIFICATION MODAL ── */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={closeModal}
            >
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-[#15171e] rounded-3xl border border-white/10 p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-xl font-bold">
                                {platformToVerify === 'tiktok' ? 'TikTok Hesabını Bağla' : 'Instagram Hesabını Bağla'}
                            </Text>
                            <TouchableOpacity onPress={closeModal}>
                                <X color="gray" size={24} />
                            </TouchableOpacity>
                        </View>

                        {/* ── STEP 1: Enter username ── */}
                        {step === 1 && (
                            <>
                                <Text className="text-gray-400 text-sm leading-5 mb-5">
                                    {platformToVerify === 'tiktok' 
                                        ? 'TikTok kullanıcı adını gir. Sahipliğini doğrulamak için biyografine bir kod eklemeni isteyeceğiz.'
                                        : 'Instagram kullanıcı adını gir. Sahipliğini doğrulamak için biyografine bir kod eklemeni isteyeceğiz.'}
                                </Text>
                                <View className="flex-row items-center bg-black/30 h-14 rounded-xl border border-white/10 px-4 mb-5">
                                    {platformToVerify === 'tiktok' ? (
                                        <Music size={20} color="#22d3ee" className="mr-3" />
                                    ) : (
                                        <Instagram size={20} color="#a855f7" className="mr-3" />
                                    )}
                                    <Text className="text-gray-500 text-base mr-1">@</Text>
                                    <TextInput
                                        className="flex-1 text-white text-base font-medium"
                                        placeholder="kullaniciadi"
                                        placeholderTextColor="#6b7280"
                                        value={igUsername}
                                        onChangeText={setIgUsername}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity 
                                    onPress={handleGenerate} 
                                    disabled={busy}
                                    className="bg-soft-gold h-14 rounded-2xl items-center justify-center shadow-lg shadow-soft-gold/20"
                                >
                                    {busy ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold text-base">Kod Al</Text>}
                                </TouchableOpacity>
                            </>
                        )}

                        {/* ── STEP 2: Bio code ── */}
                        {step === 2 && (
                            <>
                                <View className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 mb-5 flex-row items-start gap-3">
                                    <Info color="#60a5fa" size={16} style={{ marginTop: 1 }} />
                                    <Text className="text-blue-300 text-xs leading-5 flex-1">
                                        Bu kod, hesabın gerçekten sana ait olduğunu kanıtlar. Doğrulama sonrası kaldırabilirsin.
                                    </Text>
                                </View>

                                <Text className="text-gray-400 text-sm mb-3">
                                    Aşağıdaki kodu <Text className="text-white font-bold">@{igUsername.replace(/^@/, '')}</Text> hesabının{' '}
                                    <Text className="text-soft-gold font-bold">biyografisine</Text> ekle:
                                </Text>

                                <TouchableOpacity onPress={copyCode}
                                    className="bg-white/5 border border-white/10 rounded-2xl p-4 flex-row items-center justify-between mb-2 active:opacity-75">
                                    <Text className="text-white font-mono text-xl font-black tracking-widest">{verificationCode}</Text>
                                    <View className="flex-row items-center gap-2 bg-soft-gold/15 px-3 py-2 rounded-xl">
                                        <Copy size={14} color="#D4AF37" />
                                        <Text className="text-soft-gold text-xs font-bold">Kopyala</Text>
                                    </View>
                                </TouchableOpacity>
                                <Text className="text-gray-600 text-xs mb-5 ml-1">Koda dokunarak kopyalayabilirsin</Text>

                                <TouchableOpacity onPress={handleVerify} disabled={busy}
                                    className="bg-soft-gold h-14 rounded-2xl items-center justify-center shadow-lg shadow-soft-gold/20 mb-3">
                                    {busy ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold text-base">Biyografime Ekledim, Doğrula ✓</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setStep(1)} className="items-center py-2">
                                    <Text className="text-gray-500 text-xs">Geri Dön</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {/* ── STEP 3: Success ── */}
                        {step === 3 && (
                            <View className="items-center py-4">
                                <View className="w-16 h-16 bg-green-500/15 border border-green-500/30 rounded-full items-center justify-center mb-4">
                                    <CheckCircle2 color="#4ade80" size={32} />
                                </View>
                                <Text className="text-white font-bold text-xl mb-1">Hesap Doğrulandı!</Text>
                                <Text className="text-gray-400 text-sm text-center mb-5">
                                    @{platformToVerify === 'tiktok' ? tiktokAccount?.username : igAccount?.username} hesabın başarıyla bağlandı.
                                </Text>
                                <TouchableOpacity onPress={closeModal}
                                    className="bg-soft-gold h-13 w-full rounded-2xl items-center justify-center px-6 py-4">
                                    <Text className="text-black font-bold text-base">Harika, Tamam!</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
