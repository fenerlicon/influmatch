import React, { useState, useCallback } from 'react';
import { View, Alert, Linking } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import {
    UserRound, AtSign, KeyRound, BellRing, Link2, LifeBuoy, Mail, FileText, LogOut, Eye, EyeOff, ExternalLink, CalendarClock,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { signOutAndClearPush } from '../utils/notifications';
import SupportTicketForm from '../components/SupportTicketForm';
import { AVAILABILITY_NOTE_MAX, availabilityText } from '../constants/availability';
import { BRAND_PORTFOLIO_SETTING_HELP, BRAND_PORTFOLIO_SETTING_LABEL } from '../constants/portfolio';
import {
    Screen, StackHeader, Text, Button, ListGroup, ListRow, IconBox, ToggleRow, Sheet, TextField, IconButton, colors, ICON_STROKE,
} from '../components/ui';

// Ayarlar (design/mobile/ortak.html). E-posta tercihleri web ile aynı alan (users.email_notifications,
// /api/mobile/email-preferences); push izni telefon ayarlarından yönetilir.

// Web ayarlar sayfasındaki tercihlerle aynı anahtarlar (lib/email-preferences.ts)
const EMAIL_PREFS = [
    { key: 'offers', title: 'Teklifler', subtitle: 'Yeni teklif, yanıt ve iş birliği güncellemeleri' },
    { key: 'advert_applications', title: 'İlan başvuruları', subtitle: 'Başvuru sonuçları ve ilan alarmları' },
    { key: 'messages', title: 'Mesajlar', subtitle: 'Yeni mesaj, en fazla saatte bir özet' },
    { key: 'updates', title: 'Platform güncellemeleri', subtitle: 'Destek yanıtları ve önemli duyurular' },
    { key: 'marketing', title: 'Pazarlama iletileri', subtitle: 'İpuçları ve öneriler (isteğe bağlı)' },
];

const SUPPORT_EMAIL = 'destek@influmatch.net';

function GroupLabel({ children }) {
    return <Text variant="eyebrow" className="px-1 mt-1.5">{children}</Text>;
}

function PasswordSheet({ visible, onClose }) {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);

    const close = () => { setCurrent(''); setNext(''); setConfirm(''); setShow(false); onClose(); };

    const save = async () => {
        if (!current || !next || !confirm) return Alert.alert('Eksik alan', 'Tüm alanları doldur.');
        if (next !== confirm) return Alert.alert('Şifreler eşleşmiyor', 'Yeni şifreyi iki kez aynı yaz.');
        if (next.length < 8) return Alert.alert('Şifre kısa', 'Şifre en az 8 karakter olmalı.');
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
            if (signInErr) throw new Error('Mevcut şifre yanlış.');
            const { error } = await supabase.auth.updateUser({ password: next });
            if (error) throw error;
            Alert.alert('Şifre güncellendi', 'Yeni şifren bir sonraki girişte geçerli.');
            close();
        } catch (e) {
            Alert.alert('Şifre değiştirilemedi', e.message);
        } finally {
            setSaving(false);
        }
    };

    const eye = <IconButton icon={show ? EyeOff : Eye} size={18} color={colors.fg3} onPress={() => setShow((v) => !v)} accessibilityLabel={show ? 'Şifreyi gizle' : 'Şifreyi göster'} />;

    return (
        <Sheet visible={visible} onClose={close} title="Şifre değiştir" scroll>
            <TextField label="Mevcut şifre" value={current} onChangeText={setCurrent} secureTextEntry={!show} autoCapitalize="none" right={eye} />
            <TextField label="Yeni şifre" hint="En az 8 karakter" value={next} onChangeText={setNext} secureTextEntry={!show} autoCapitalize="none" />
            <TextField
                label="Yeni şifre (tekrar)"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!show}
                autoCapitalize="none"
                error={confirm && next !== confirm ? 'Şifreler eşleşmiyor' : undefined}
            />
            <Button title="Şifreyi güncelle" onPress={save} loading={saving} block />
        </Sheet>
    );
}

// Müsaitlik "Şu an dolu" ayrıntısı (3.19): isteğe bağlı not ve bitiş tarihi (YYYY-AA-GG); tarih geçince "İş alıyorum"a döner.
function AvailabilitySheet({ visible, onClose, initial, onSaved }) {
    const [note, setNote] = useState(initial?.note || '');
    const [until, setUntil] = useState(initial?.until || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        const result = await apiRequest('availability', { method: 'POST', body: { status: 'busy', note, until: until.trim() || null } });
        setSaving(false);
        if (result.error) return Alert.alert('Kaydedilemedi', result.error);
        onSaved(result.availability);
        onClose();
    };

    return (
        <Sheet visible={visible} onClose={onClose} title="Şu an dolu" scroll>
            <Text variant="small" tone="fg2">Doluyken keşifte alt sırada görünürsün; markalar yine teklif gönderebilir ama teklif penceresinde uyarı görür.</Text>
            <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={AVAILABILITY_NOTE_MAX} placeholder="Örn. Ay sonuna kadar takvimim dolu" />
            <TextField
                label="Bitiş tarihi (isteğe bağlı)"
                hint="YYYY-AA-GG, ör. 2026-11-30. Bu tarihten sonra kendiliğinden İş alıyorum olur."
                value={until}
                onChangeText={(v) => setUntil(v.replace(/[^0-9-]/g, '').slice(0, 10))}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
            />
            <Button title="Kaydet" onPress={save} loading={saving} block />
        </Sheet>
    );
}

export default function SettingsScreen({ navigation }) {
    const [role, setRole] = useState(null);
    const [username, setUsername] = useState('');
    const [prefs, setPrefs] = useState(null);
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [supportOpen, setSupportOpen] = useState(false);
    const [availability, setAvailability] = useState(null);
    const [availabilityOpen, setAvailabilityOpen] = useState(false);
    // Marka: portföylerde marka adı (4.3-S7; varsayılan kapalı, /api/mobile/portfolio).
    const [showBrandName, setShowBrandName] = useState(null);

    useFocusEffect(useCallback(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data }, pref] = await Promise.all([
                supabase.from('users').select('role, username').eq('id', user.id).maybeSingle(),
                apiRequest('email-preferences'),
            ]);
            if (data) { setRole(data.role); setUsername(data.username || ''); }
            if (pref?.preferences) setPrefs(pref.preferences);
            if (data?.role === 'influencer') {
                const av = await apiRequest('availability');
                if (av?.availability) setAvailability(av.availability);
            }
            if (data?.role === 'brand') {
                const pf = await apiRequest('portfolio');
                if (typeof pf?.showBrandName === 'boolean') setShowBrandName(pf.showBrandName);
            }
        })();
    }, []));

    // Anahtar hemen değişir; kayıt başarısız olursa eski hale döner
    const togglePref = async (key, value) => {
        const before = prefs;
        const nextPrefs = { ...prefs, [key]: value };
        setPrefs(nextPrefs);
        const result = await apiRequest('email-preferences', { method: 'PATCH', body: { preferences: nextPrefs } });
        if (!result.success) {
            setPrefs(before);
            Alert.alert('Kaydedilemedi', result.error || 'Lütfen tekrar deneyin.');
        }
    };

    // "İş alıyorum" açık = open; kapatınca not / tarih sayfası açılır, kayıt orada.
    const toggleAvailability = async (open) => {
        if (!open) return setAvailabilityOpen(true);
        const before = availability;
        setAvailability({ status: 'open', note: null, until: null });
        const result = await apiRequest('availability', { method: 'POST', body: { status: 'open' } });
        if (result.error) {
            setAvailability(before);
            Alert.alert('Kaydedilemedi', result.error);
        }
    };

    const toggleBrandName = async (value) => {
        const before = showBrandName;
        setShowBrandName(value);
        const result = await apiRequest('portfolio', { method: 'POST', body: { showBrandName: value } });
        if (result.error) {
            setShowBrandName(before);
            Alert.alert('Kaydedilemedi', result.error);
        }
    };

    const handleLogout = () => {
        Alert.alert('Çıkış yap', 'Hesabından çıkış yapmak istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Çıkış yap', style: 'destructive',
                onPress: async () => {
                    await signOutAndClearPush();
                    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
                },
            },
        ]);
    };

    const isBrand = role === 'brand';
    const version = Constants.expoConfig?.version || '1.0';
    const externalIcon = <ExternalLink size={18} color={colors.fg3} strokeWidth={ICON_STROKE} />;

    return (
        <Screen scroll header={<StackHeader title="Ayarlar" onBack={() => navigation.goBack()} />}>
            <GroupLabel>Hesap</GroupLabel>
            <ListGroup>
                <ListRow
                    left={<IconBox icon={UserRound} />}
                    title="Profil bilgileri"
                    subtitle={isBrand ? 'Marka bilgileri ve doğrulama' : 'Ad, biyografi, kategori'}
                    onPress={() => navigation.navigate(isBrand ? 'BrandProfile' : 'MyProfile')}
                    chevron
                />
                <ListRow
                    left={<IconBox icon={AtSign} />}
                    title={username ? `@${username}` : 'Kullanıcı adı'}
                    subtitle="Kullanıcı adı değiştirilemez; gerekirse destek talebi aç."
                    numberOfLines={2}
                />
                {role && !isBrand ? (
                    <ListRow
                        left={<IconBox icon={Link2} />}
                        title="Bağlı hesaplar"
                        subtitle="Instagram ve TikTok bağlantısı"
                        onPress={() => navigation.navigate('MyProfile')}
                        chevron
                    />
                ) : null}
                <ListRow left={<IconBox icon={KeyRound} />} title="Şifre değiştir" onPress={() => setPasswordOpen(true)} chevron />
                <ListRow
                    left={<IconBox icon={BellRing} />}
                    title="Push bildirimleri"
                    subtitle="Telefon ayarlarından yönetilir"
                    onPress={() => Linking.openSettings().catch(() => null)}
                    right={externalIcon}
                />
            </ListGroup>

            {role === 'influencer' ? (
                <>
                    <GroupLabel>Müsaitlik</GroupLabel>
                    <ListGroup>
                        <ToggleRow
                            title="İş alıyorum"
                            subtitle={availability ? availabilityText(availability) : 'Yükleniyor…'}
                            value={availability ? availability.status !== 'busy' : true}
                            disabled={!availability}
                            onValueChange={toggleAvailability}
                        />
                        {availability?.status === 'busy' ? (
                            <ListRow
                                left={<IconBox icon={CalendarClock} />}
                                title="Not ve bitiş tarihi"
                                subtitle={availability.note || 'Not yok'}
                                onPress={() => setAvailabilityOpen(true)}
                                chevron
                            />
                        ) : null}
                    </ListGroup>
                </>
            ) : null}

            {isBrand ? (
                <>
                    <GroupLabel>Portföylerde marka adı</GroupLabel>
                    <ListGroup>
                        <ToggleRow
                            title={BRAND_PORTFOLIO_SETTING_LABEL}
                            subtitle={BRAND_PORTFOLIO_SETTING_HELP}
                            value={!!showBrandName}
                            disabled={showBrandName === null}
                            onValueChange={toggleBrandName}
                        />
                    </ListGroup>
                </>
            ) : null}

            <GroupLabel>E-posta bildirimleri</GroupLabel>
            <ListGroup>
                {EMAIL_PREFS.map((p) => (
                    <ToggleRow
                        key={p.key}
                        title={p.title}
                        subtitle={p.subtitle}
                        value={!!prefs?.[p.key]}
                        disabled={!prefs}
                        onValueChange={(v) => togglePref(p.key, v)}
                    />
                ))}
            </ListGroup>

            <GroupLabel>Destek</GroupLabel>
            <ListGroup>
                <ListRow left={<IconBox icon={LifeBuoy} />} title="Destek talebi" subtitle="Sorununu ekibe ilet" onPress={() => setSupportOpen(true)} chevron />
                <ListRow
                    left={<IconBox icon={Mail} />}
                    title="Bize ulaşın"
                    subtitle={SUPPORT_EMAIL}
                    onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => null)}
                    right={externalIcon}
                />
                <ListRow
                    left={<IconBox icon={FileText} />}
                    title="Koşullar ve gizlilik"
                    onPress={() => Linking.openURL('https://influmatch.net/legal?tab=terms').catch(() => null)}
                    right={externalIcon}
                />
            </ListGroup>

            <Button title="Çıkış yap" icon={LogOut} variant="danger" onPress={handleLogout} block className="mt-1.5" />
            <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>Influmatch · sürüm {version}</Text>

            <PasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
            {availabilityOpen ? (
                <AvailabilitySheet visible onClose={() => setAvailabilityOpen(false)} initial={availability} onSaved={setAvailability} />
            ) : null}
            <Sheet visible={supportOpen} onClose={() => setSupportOpen(false)} title="Destek talebi" scroll>
                <SupportTicketForm onSent={() => setSupportOpen(false)} />
            </Sheet>
        </Screen>
    );
}
