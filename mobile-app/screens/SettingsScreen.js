import React, { useState, useCallback } from 'react';
import { Alert, Linking, Share } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import {
    UserRound, AtSign, KeyRound, BellRing, Link2, LifeBuoy, Mail, FileText, LogOut, Eye, EyeOff, ExternalLink, CalendarClock, Download, Trash2,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { signOutAndClearPush } from '../utils/notifications';
import SupportTicketForm from '../components/SupportTicketForm';
import { AVAILABILITY_NOTE_MAX, availabilityText } from '../constants/availability';
import { BRAND_PORTFOLIO_SETTING_HELP, BRAND_PORTFOLIO_SETTING_LABEL } from '../constants/portfolio';
import {
    Screen, StackHeader, Text, Button, ListGroup, ListRow, IconBox, ToggleRow, Sheet, TextField, IconButton, DateField, colors, ICON_STROKE,
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

// Hesabı silme (web ayarlarıyla aynı kural: şifre tekrar sorulur; /api/mobile/account/delete → lib/account-deletion.ts).
// Mağaza kuralı: hesap uygulama içinden silinebilmeli.
function DeleteAccountSheet({ visible, onClose, onDeleted }) {
    const [password, setPassword] = useState('');
    const [show, setShow] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const close = () => { setPassword(''); setShow(false); onClose(); };

    const remove = () => {
        if (!password) return Alert.alert('Şifre gerekli', 'Hesabını silmek için şifreni gir.');
        Alert.alert('Hesabı sil', 'Hesabın ve verilerin kalıcı olarak silinecek. Bu işlem geri alınamaz.', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Kalıcı olarak sil', style: 'destructive',
                onPress: async () => {
                    setDeleting(true);
                    const result = await apiRequest('account/delete', { method: 'POST', body: { password } });
                    setDeleting(false);
                    if (!result.success) return Alert.alert('Hesap silinemedi', result.error || 'Lütfen tekrar deneyin.');
                    setPassword('');
                    onDeleted();
                },
            },
        ]);
    };

    const eye = <IconButton icon={show ? EyeOff : Eye} size={18} color={colors.fg3} onPress={() => setShow((v) => !v)} accessibilityLabel={show ? 'Şifreyi gizle' : 'Şifreyi göster'} />;

    return (
        <Sheet visible={visible} onClose={close} title="Hesabı sil" scroll>
            <Text variant="small" tone="fg2">Hesabın ve tüm verilerin kalıcı olarak silinir. Devam etmek için şifreni gir.</Text>
            <TextField label="Şifre" value={password} onChangeText={setPassword} secureTextEntry={!show} autoCapitalize="none" right={eye} />
            <Button title="Hesabımı sil" icon={Trash2} variant="danger" onPress={remove} loading={deleting} block />
        </Sheet>
    );
}

// Müsaitlik "Şu an dolu" ayrıntısı (3.19): isteğe bağlı not ve bitiş tarihi (takvimden, en fazla bir yıl); tarih geçince "İş alıyorum"a döner.
const localIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function AvailabilitySheet({ visible, onClose, initial, onSaved }) {
    const [note, setNote] = useState(initial?.note || '');
    const [until, setUntil] = useState(initial?.until || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        const result = await apiRequest('availability', { method: 'POST', body: { status: 'busy', note, until: until || null } });
        setSaving(false);
        if (result.error) return Alert.alert('Kaydedilemedi', result.error);
        onSaved(result.availability);
        onClose();
    };

    return (
        <Sheet visible={visible} onClose={onClose} title="Şu an dolu" scroll>
            <Text variant="small" tone="fg2">Doluyken keşifte alt sırada görünürsün; markalar yine teklif gönderebilir ama teklif penceresinde uyarı görür.</Text>
            <TextField label="Not (isteğe bağlı)" value={note} onChangeText={setNote} maxLength={AVAILABILITY_NOTE_MAX} placeholder="Örn. Ay sonuna kadar takvimim dolu" />
            <DateField
                label="Bitiş tarihi (isteğe bağlı)"
                hint="Bu tarihten sonra kendiliğinden İş alıyorum olur."
                value={until}
                onChange={setUntil}
                min={localIso(new Date())}
                max={localIso(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))}
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
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [exporting, setExporting] = useState(false);

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

    // "Verilerimi indir": hesabın verilerinin JSON kopyası (web ile aynı kod, /api/mobile/account/export; 10 dakikada bir).
    const exportData = async () => {
        if (exporting) return;
        setExporting(true);
        const result = await apiRequest('account/export', { method: 'POST' });
        setExporting(false);
        if (result.error || !result.data) return Alert.alert('İndirilemedi', result.error || 'Lütfen tekrar deneyin.');
        try {
            await Share.share({ title: result.fileName, message: JSON.stringify(result.data, null, 2) });
        } catch (e) {
            Alert.alert('Paylaşılamadı', 'Verilerini web sitesindeki Ayarlar sayfasından da indirebilirsin.');
        }
    };

    const handleDeleted = async () => {
        setDeleteOpen(false);
        await supabase.auth.signOut().catch(() => null);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        Alert.alert('Hesabın silindi', 'Hesabın ve verilerin silindi.');
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

            <GroupLabel>Verilerin</GroupLabel>
            <ListGroup>
                <ListRow
                    left={<IconBox icon={Download} />}
                    title={exporting ? 'Hazırlanıyor…' : 'Verilerimi indir'}
                    subtitle="Hesabındaki verilerin kopyası (JSON)"
                    onPress={exportData}
                    chevron
                />
                <ListRow
                    left={<IconBox icon={Trash2} />}
                    title="Hesabı sil"
                    subtitle="Hesabın ve tüm verilerin kalıcı olarak silinir"
                    onPress={() => setDeleteOpen(true)}
                    chevron
                />
            </ListGroup>

            <Button title="Çıkış yap" icon={LogOut} variant="danger" onPress={handleLogout} block className="mt-1.5" />
            <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>Influmatch · sürüm {version}</Text>

            <PasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
            <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={handleDeleted} />
            {availabilityOpen ? (
                <AvailabilitySheet visible onClose={() => setAvailabilityOpen(false)} initial={availability} onSaved={setAvailability} />
            ) : null}
            <Sheet visible={supportOpen} onClose={() => setSupportOpen(false)} title="Destek talebi" scroll>
                <SupportTicketForm onSent={() => setSupportOpen(false)} />
            </Sheet>
        </Screen>
    );
}
