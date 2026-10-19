import React, { useState, useCallback } from 'react';
import { View, Alert, ActivityIndicator, Pressable, Linking } from 'react-native';
import { Camera, LogOut, ShieldCheck, FileText, LifeBuoy, Settings, Pencil, Award, Sparkles, ExternalLink, Trophy } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { signOutAndClearPush } from '../../utils/notifications';
import { OWN_PROFILE_COLUMNS } from '../../lib/userColumns';
import { useFocusEffect } from '@react-navigation/native';
import {
    Screen, StackHeader, Section, Text, Button, IconButton, ListGroup, ListRow, IconBox, Avatar, Chip, TextField, Sheet, colors, ICON_STROKE,
} from '../../components/ui';
import { decode } from 'base64-arraybuffer';
import { apiRequest } from '../../lib/api';
import SupportTicketForm from '../../components/SupportTicketForm';

// Düzenlenebilir marka bilgileri (web marka profil formuyla aynı alanlar; kayıt /api/mobile/profile)
const FIELDS = [
    { label: 'Marka adı', field: 'full_name' },
    { label: 'Şirket unvanı', field: 'company_legal_name' },
    { label: 'Şehir', field: 'city' },
    { label: 'İnternet sitesi', field: 'website' },
    { label: 'Marka açıklaması', field: 'bio' },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandProfileScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editField, setEditField] = useState(null); // field name being edited
    const [editValue, setEditValue] = useState('');

    const [supportOpen, setSupportOpen] = useState(false);

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
                .select(OWN_PROFILE_COLUMNS)
                .eq('id', user.id)
                .maybeSingle();

            if (error) throw error;
            if (data) {
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
            const path = `${user.id}/avatar_${Date.now()}.${ext}`;

            const { error: upErr } = await supabase.storage
                .from('avatars')
                .upload(path, decode(result.assets[0].base64), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (upErr) throw upErr;

            const { data: urlD } = supabase.storage.from('avatars').getPublicUrl(path);
            const url = `${urlD.publicUrl}?t=${Date.now()}`;

            // Logo web'in profil koduyla aynı sunucu ucundan kaydedilir (adres doğrulaması dahil).
            const saved = await apiRequest('profile', { method: 'PATCH', body: { avatarUrl: url } });
            if (!saved.success) throw new Error(saved.error);

            setProfile(p => ({ ...p, avatar_url: url }));
            Alert.alert('Başarılı', 'Profil fotoğrafı güncellendi.');
        } catch (e) {
            console.error('[BrandProfile] pickAvatar error:', e);
            Alert.alert('Hata', e.message || 'Fotoğraf yüklenemedi.');
        } finally {
            setSaving(false);
        }
    };

    // Alan adı -> /api/mobile/profile gövde anahtarı (web marka profil formuyla aynı alanlar).
    const FIELD_KEYS = { full_name: 'brandName', company_legal_name: 'companyLegalName', website: 'website', city: 'city', bio: 'bio' };

    const saveField = async () => {
        if (!editField || !FIELD_KEYS[editField]) return;
        setSaving(true);
        const value = editValue.trim();
        const result = await apiRequest('profile', { method: 'PATCH', body: { [FIELD_KEYS[editField]]: value } });
        setSaving(false);
        if (!result.success) return Alert.alert('Hata', result.error || 'Bilgi güncellenemedi.');
        setProfile(prev => (editField === 'website'
            ? { ...prev, website: value, social_links: { ...(prev.social_links || {}), website: value } }
            : { ...prev, [editField]: value }));
        setEditField(null);
    };

    const handleLogout = () => {
        Alert.alert('Çıkış Yap', 'Hesabından çıkış yapmak istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Çıkış Yap', style: 'destructive',
                onPress: async () => {
                    await signOutAndClearPush();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                }
            }
        ]);
    };

    const isVerified = profile?.verification_status === 'verified';

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const name = profile?.full_name || profile?.company_legal_name || 'Marka';
    const fieldLabel = FIELDS.find((f) => f.field === editField)?.label;

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="Marka profili" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} right={<IconButton icon={Settings} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Ayarlar" />} />}
        >
            <View className="items-center" style={{ gap: 10 }}>
                <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Logoyu değiştir">
                    <Avatar name={name} uri={profile?.avatar_url} size="xl" square />
                    <View className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gold border-2 border-bg items-center justify-center">
                        {saving ? <ActivityIndicator size="small" color={colors.goldInk} /> : <Camera size={15} color={colors.goldInk} strokeWidth={2} />}
                    </View>
                </Pressable>
                <Text variant="heading">{name}</Text>
                <Chip label={isVerified ? 'Doğrulanmış marka' : 'Doğrulama bekliyor'} tone={isVerified ? 'success' : 'warning'} dot />
            </View>

            <Section title="Bilgiler">
                <ListGroup>
                    {FIELDS.map((row) => (
                        <ListRow
                            key={row.field}
                            onPress={() => startEdit(row.field, profile?.[row.field])}
                            title={<Text variant="caption" tone="fg3">{row.label}</Text>}
                            subtitle={<Text tone={profile?.[row.field] ? 'fg' : 'fg3'} numberOfLines={2}>{profile?.[row.field] || 'Belirtilmemiş'}</Text>}
                            right={<Pencil size={16} color={colors.fg3} strokeWidth={ICON_STROKE} />}
                        />
                    ))}
                </ListGroup>
            </Section>

            <Section title="Hesap">
                <ListGroup>
                    <ListRow
                        onPress={() => navigation.navigate('BrandVerification')}
                        left={<IconBox icon={ShieldCheck} tone={isVerified ? 'success' : 'warning'} />}
                        title="İşletme doğrulama"
                        subtitle="Kurumsal kimlik, kurumsal e-posta, vergi levhası"
                        right={isVerified ? <Chip label="Onaylı" tone="success" /> : null}
                        chevron
                    />
                    <ListRow onPress={() => navigation.navigate('Badges')} left={<IconBox icon={Award} />} title="Rozetler" chevron />
                    <ListRow onPress={() => navigation.navigate('Spotlight')} left={<IconBox icon={Sparkles} tone="gold" />} title="Spotlight" subtitle="Akıllı eşleştirme ve öne çıkma" chevron />
                    <ListRow onPress={() => navigation.navigate('Tasks')} left={<IconBox icon={Trophy} tone="gold" />} title="Görevler" subtitle="İlk ilan, teklif ve iş birliği görevleri" chevron />
                </ListGroup>
            </Section>

            <Section title="Destek">
                <ListGroup>
                    <ListRow onPress={() => setSupportOpen(true)} left={<IconBox icon={LifeBuoy} />} title="Destek talebi" chevron />
                    <ListRow onPress={() => Linking.openURL('https://influmatch.net/legal?tab=terms').catch(() => null)} left={<IconBox icon={FileText} />} title="Koşullar ve gizlilik" right={<ExternalLink size={16} color={colors.fg3} strokeWidth={ICON_STROKE} />} />
                </ListGroup>
            </Section>

            <Button title="Çıkış yap" icon={LogOut} variant="danger" onPress={handleLogout} block />
            <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>Influmatch · sürüm 1.0</Text>

            <Sheet visible={!!editField} onClose={() => setEditField(null)} title={fieldLabel}>
                <TextField
                    value={editValue}
                    onChangeText={setEditValue}
                    multiline={editField === 'bio'}
                    autoCapitalize={editField === 'website' ? 'none' : 'sentences'}
                    keyboardType={editField === 'website' ? 'url' : 'default'}
                    autoFocus
                />
                {editField === 'company_legal_name' ? <Text variant="caption" tone="fg3">Onaylı markada yasal bilgileri değiştirmek onayı yeniden incelemeye alır.</Text> : null}
                <Button title="Kaydet" onPress={saveField} loading={saving} block />
            </Sheet>

            <Sheet visible={supportOpen} onClose={() => setSupportOpen(false)} title="Destek talebi" scroll>
                <SupportTicketForm onSent={() => setSupportOpen(false)} />
            </Sheet>
        </Screen>
    );
}
