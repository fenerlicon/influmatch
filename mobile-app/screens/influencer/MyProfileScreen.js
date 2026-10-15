import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Alert, Pressable } from 'react-native';
import { Camera, User, Instagram, Music2, CircleCheck, Copy, AtSign, Tags, BarChart3 } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { OWN_PROFILE_COLUMNS } from '../../lib/userColumns';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE, apiRequest } from '../../lib/api';
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '../../constants/categories';
import { RATE_CARD_ITEMS } from '../../constants/rateCard';
import PortfolioResults from '../../components/PortfolioResults';
import {
    Screen, StackHeader, BottomBar, Section, Text, Button, ListGroup, ListRow, IconBox, Avatar, FilterChip, TextField, ToggleRow, Sheet,
    colors, ICON_STROKE,
} from '../../components/ui';

const EMPTY_PRICES = Object.fromEntries(RATE_CARD_ITEMS.map((item) => [item.key, '']));

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function MyProfileScreen({ navigation, route }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '', username: '', bio: '', category: '', avatar_url: null,
    });
    const [igAccount, setIgAccount] = useState(null);
    const [tiktokAccount, setTiktokAccount] = useState(null);
    const [platformToVerify, setPlatformToVerify] = useState('instagram');

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [step, setStep] = useState(1); // 1: username input, 2: bio code, 3: success
    const [igUsername, setIgUsername] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [verifiedData, setVerifiedData] = useState(null);

    // Fiyat kartı (yalnızca doğrulanmış markalar görür; kayıt /api/mobile/rate-card → lib/rate-card.ts)
    const [ratePrices, setRatePrices] = useState(EMPTY_PRICES);
    const [rateNegotiable, setRateNegotiable] = useState(false);
    const [savingRate, setSavingRate] = useState(false);
    // Portföy sonuçları (4.3-S7; /api/mobile/portfolio → lib/portfolio-results.ts): kendi sonuçları, gizle / göster.
    const [portfolio, setPortfolio] = useState(null);

    // ── Fetch data ─────────────────────────────────────────────────────────────
    const fetchProfile = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: prof }, { data: social }, { data: tiktok }] = await Promise.all([
                supabase.from('users').select(OWN_PROFILE_COLUMNS).eq('id', user.id).maybeSingle(),
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
                    social_links: prof.social_links || {},
                    category: prof.category || '',
                    avatar_url: prof.avatar_url || null,
                });
            }
            setIgAccount(social || null);
            setTiktokAccount(tiktok || null);

            const rate = await apiRequest('rate-card');
            if (!rate.error) {
                const prices = rate.rateCard?.prices || {};
                setRatePrices(Object.fromEntries(RATE_CARD_ITEMS.map((item) => [item.key, prices[item.key] ? String(prices[item.key]) : ''])));
                setRateNegotiable(!!rate.rateCard?.negotiable);
            }

            const own = await apiRequest('portfolio');
            setPortfolio(own?.portfolio || null);
        } catch (e) {
            console.error('[MyProfile]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchProfile(); }, [fetchProfile]));

    // ── Save profile ───────────────────────────────────────────────────────────
    // Kayıt web'in profil koduyla aynı sunucu ucundan (doğrulama, rozetler): /api/mobile/profile
    const handleSave = async () => {
        setSaving(true);
        const result = await apiRequest('profile', {
            method: 'PATCH',
            body: { fullName: profile.full_name, bio: profile.bio, category: profile.category },
        });
        setSaving(false);
        if (!result.success) return Alert.alert('Hata', result.error || 'Kaydedilemedi.');
        Alert.alert('Kaydedildi', 'Profil bilgilerin güncellendi.');
        navigation.goBack();
    };

    const handleSaveRateCard = async () => {
        setSavingRate(true);
        const result = await apiRequest('rate-card', { method: 'PUT', body: { prices: ratePrices, negotiable: rateNegotiable } });
        setSavingRate(false);
        if (!result.success) return Alert.alert('Hata', result.error || 'Fiyat kartı kaydedilemedi.');
        Alert.alert('Kaydedildi', result.rateCard ? 'Fiyat kartınız kaydedildi.' : 'Fiyat kartınız kaldırıldı.');
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
            const path = `${user.id}/avatar_${Date.now()}.${ext}`;
            const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true, contentType: `image/${ext}` });
            if (upErr) throw upErr;
            const { data: urlD } = supabase.storage.from('avatars').getPublicUrl(path);
            const url = `${urlD.publicUrl}?t=${Date.now()}`;
            const result = await apiRequest('profile', { method: 'PATCH', body: { avatarUrl: url } });
            if (!result.success) throw new Error(result.error);
            setProfile(p => ({ ...p, avatar_url: url }));
        } catch (e) {
            Alert.alert('Hata', e.message || 'Fotoğraf yüklenemedi.');
        } finally {
            setSaving(false);
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
        Alert.alert('Kopyalandı', 'Kodu biyografine yapıştır.');
    };

    const closeModal = () => {
        setModalVisible(false);
        setStep(1);
        setIgUsername('');
        setVerificationCode('');
        setVerifiedData(null);
    };

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const rateOnly = route?.params?.section === 'rate-card';
    const platformLabel = platformToVerify === 'tiktok' ? 'TikTok' : 'Instagram';
    const connected = platformToVerify === 'tiktok' ? tiktokAccount : igAccount;

    const openVerify = (platform, account) => {
        setPlatformToVerify(platform);
        setIgUsername(account?.username || '');
        setStep(1);
        setModalVisible(true);
    };

    // ── Portföy sonuçları (ayrı görünüm: Profil → Sonuçlar) ──
    if (route?.params?.section === 'results') {
        return (
            <Screen scroll header={<StackHeader title="Sonuçlar" onBack={() => navigation.goBack()} />}>
                {portfolio ? (
                    <PortfolioResults view={portfolio} onOpenPlans={() => navigation.navigate('Spotlight')} />
                ) : (
                    <Text variant="small" tone="fg3">Sonuçlar yüklenemedi.</Text>
                )}
            </Screen>
        );
    }

    // ── Fiyat kartı (ayrı görünüm: Profil → Fiyat kartı, Hesap durumu adımı) ──
    if (rateOnly) {
        return (
            <Screen
                scroll
                keyboard
                header={<StackHeader title="Fiyat kartı" onBack={() => navigation.goBack()} />}
                footer={<BottomBar><View className="flex-1"><Button title="Kaydet" onPress={handleSaveRateCard} loading={savingRate} block /></View></BottomBar>}
            >
                <Text variant="small" tone="fg2">Her teslimat türü için başlangıç fiyatını gir; vermediğin türleri boş bırak. Yalnızca doğrulanmış markalar görür.</Text>
                <ListGroup>
                    {RATE_CARD_ITEMS.map((item) => (
                        <View key={item.key} className="flex-row items-center px-3.5 py-2.5" style={{ gap: 12 }}>
                            <Text weight="medium" style={{ flex: 1 }}>{item.label}</Text>
                            <View style={{ width: 140 }}>
                                <TextField
                                    prefix="₺"
                                    height={44}
                                    value={ratePrices[item.key]}
                                    onChangeText={(v) => setRatePrices((p) => ({ ...p, [item.key]: v.replace(/[^0-9]/g, '') }))}
                                    keyboardType="number-pad"
                                    maxLength={8}
                                    placeholder="—"
                                />
                            </View>
                        </View>
                    ))}
                </ListGroup>
                <ListGroup>
                    <ToggleRow title="Pazarlığa açığım" subtitle="Profilinde çip olarak görünür" value={rateNegotiable} onValueChange={setRateNegotiable} />
                </ListGroup>
            </Screen>
        );
    }

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="Profili düzenle" onBack={() => navigation.goBack()} />}
            footer={<BottomBar><View className="flex-1"><Button title="Kaydet" onPress={handleSave} loading={saving} block /></View></BottomBar>}
        >
            {/* Fotoğraf */}
            <View className="items-center py-1" style={{ gap: 8 }}>
                <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Fotoğrafı değiştir">
                    <Avatar name={profile.full_name || profile.username} uri={profile.avatar_url} size="xl" />
                    <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gold border-2 border-bg items-center justify-center">
                        <Camera size={15} color={colors.goldInk} strokeWidth={2} />
                    </View>
                </Pressable>
                <Text variant="caption" tone="fg3">Değiştirmek için dokun</Text>
            </View>

            <TextField label="Ad soyad" icon={User} value={profile.full_name} onChangeText={(v) => setProfile((p) => ({ ...p, full_name: v }))} placeholder="Adın ve soyadın" />
            <TextField label="Kullanıcı adı" icon={AtSign} value={profile.username} editable={false} hint="Kullanıcı adı değiştirilemez." />

            <View style={{ gap: 7 }}>
                <Text variant="small" weight="medium" tone="fg2">Kategori</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {INFLUENCER_CATEGORY_KEYS.map((key) => (
                        <FilterChip key={key} label={INFLUENCER_CATEGORIES[key]} selected={profile.category === key} onPress={() => setProfile((p) => ({ ...p, category: key }))} />
                    ))}
                </View>
            </View>

            <TextField label="Biyografi" multiline value={profile.bio} onChangeText={(v) => setProfile((p) => ({ ...p, bio: v }))} placeholder="Kendini tanıt..." />

            <Section title="Sosyal hesaplar">
                <ListGroup>
                    {[
                        ['instagram', 'Instagram', Instagram, igAccount],
                        ['tiktok', 'TikTok', Music2, tiktokAccount],
                    ].map(([key, label, Icon, account]) => (
                        <ListRow
                            key={key}
                            left={<IconBox icon={Icon} tone={account ? 'success' : 'neutral'} />}
                            title={label}
                            subtitle={account ? `@${account.username}${account.is_verified ? ' · doğrulandı' : ''}` : 'Bağlı değil'}
                            right={<Button title={account ? 'Yeniden bağla' : 'Bağla'} size="sm" variant={account ? 'secondary' : 'primary'} onPress={() => openVerify(key, account)} />}
                        />
                    ))}
                </ListGroup>
            </Section>

            <ListGroup>
                <ListRow onPress={() => navigation.push('MyProfile', { section: 'rate-card' })} left={<IconBox icon={Tags} />} title="Fiyat kartı" subtitle="Teslimat başına başlangıç fiyatların" chevron />
                <ListRow onPress={() => navigation.push('MyProfile', { section: 'results' })} left={<IconBox icon={BarChart3} />} title="Sonuçlar" subtitle="Tamamlanan iş birliklerinin ölçümleri (portföy)" chevron />
            </ListGroup>

            {/* Instagram / TikTok bağlama: biyografi koduyla (/api/mobile/verify-instagram, verify-tiktok) */}
            <Sheet visible={modalVisible} onClose={closeModal} title={`${platformLabel} hesabını bağla`}>
                {step === 1 ? (
                    <>
                        <Text variant="small" tone="fg2">{platformLabel} kullanıcı adını gir. Sahipliğini doğrulamak için biyografine bir kod eklemeni isteyeceğiz.</Text>
                        <TextField icon={AtSign} placeholder="kullaniciadi" value={igUsername} onChangeText={setIgUsername} autoCapitalize="none" autoCorrect={false} />
                        <Button title="Kod al" onPress={handleGenerate} loading={busy} block />
                    </>
                ) : null}
                {step === 2 ? (
                    <>
                        <Text variant="small" tone="fg2">
                            Bu kodu <Text variant="small" weight="medium">@{igUsername.replace(/^@/, '')}</Text> hesabının biyografisine ekle. Doğrulamadan sonra kaldırabilirsin.
                        </Text>
                        <Pressable onPress={copyCode} accessibilityRole="button" accessibilityLabel="Kodu kopyala"
                            className="flex-row items-center justify-between p-4 rounded-[14px] border border-dashed border-gold-line bg-gold-soft">
                            <Text weight="semibold" tone="champagne" style={{ fontSize: 22, lineHeight: 28, letterSpacing: 2.5 }}>{verificationCode}</Text>
                            <View className="flex-row items-center h-[34px] px-3 rounded-[9px] bg-s3 border border-line-strong" style={{ gap: 6 }}>
                                <Copy size={15} color={colors.fg} strokeWidth={ICON_STROKE} />
                                <Text variant="small" weight="medium">Kopyala</Text>
                            </View>
                        </Pressable>
                        <Button title="Biyografime ekledim, doğrula" onPress={handleVerify} loading={busy} block />
                        <Button title="Geri" variant="ghost" size="md" onPress={() => setStep(1)} block />
                    </>
                ) : null}
                {step === 3 ? (
                    <View className="items-center py-2" style={{ gap: 10 }}>
                        <View className="w-14 h-14 rounded-full bg-success-soft items-center justify-center">
                            <CircleCheck size={28} color={colors.success} strokeWidth={ICON_STROKE} />
                        </View>
                        <Text weight="semibold" style={{ fontSize: 18 }}>Hesap doğrulandı</Text>
                        <Text variant="small" tone="fg2" style={{ textAlign: 'center' }}>@{connected?.username} hesabın bağlandı. Biyografindeki kodu silebilirsin.</Text>
                        <View className="w-full mt-1"><Button title="Tamam" onPress={closeModal} block /></View>
                    </View>
                ) : null}
            </Sheet>
        </Screen>
    );
}
