import React, { useState, useCallback } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { Building2, FileText, Mail, MapPin, CircleCheck, Clock, XCircle, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';
import { TURKISH_CITIES } from '../../constants/cities';
import AppealCard from '../../components/AppealCard';
import {
    Screen, StackHeader, Text, Button, Card, IconBox, Chip, Notice, TextField, SelectField, OptionSheet, colors, ICON_STROKE,
} from '../../components/ui';

// Marka doğrulaması web ile aynı akış: kurumsal kimlik (unvan, vergi no, daire, il) → kurumsal e-posta kodu →
// vergi levhası. Tüm kurallar sunucuda (lib/brand-verification.ts, lib/corporate-email-verification.ts).
// Vergi levhası yalnızca kendi sunucumuzda kontrol edilir; dış servislere gönderilmez.

const MAX_BYTES = 5 * 1024 * 1024;

const TAX_STATUS = {
    processing: { title: 'İnceleniyor', tone: 'warning', Icon: Clock },
    needs_review: { title: 'Ekibimiz inceliyor', tone: 'warning', Icon: Clock },
    auto_approved: { title: 'Vergi levhanız doğrulandı', tone: 'gold', Icon: CircleCheck },
    approved: { title: 'Vergi levhanız doğrulandı', tone: 'gold', Icon: CircleCheck },
    rejected: { title: 'Belge kabul edilmedi', tone: 'danger', Icon: XCircle },
};

// Bölüm başlığı: simge + başlık + tamamlandı işareti
function SectionHead({ icon, title, done }) {
    return (
        <View className="flex-row items-center" style={{ gap: 10 }}>
            <IconBox icon={done ? CircleCheck : icon} tone={done ? 'success' : 'gold'} size={32} />
            <Text weight="semibold" style={{ flex: 1 }}>{title}</Text>
            {done ? <Text variant="caption" tone="success">Tamam</Text> : null}
        </View>
    );
}

export default function BrandVerificationScreen({ navigation }) {
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);

    const [identity, setIdentity] = useState({ companyLegalName: '', taxId: '', taxOffice: '', taxOfficeCity: '' });
    const [editingIdentity, setEditingIdentity] = useState(false);
    const [cityPickerVisible, setCityPickerVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [taxDecision, setTaxDecision] = useState(null);

    const load = useCallback(async () => {
        // Vergi levhası reddinin nedeni + itiraz durumu (2026-10-26; web TaxCertificateUpload ile aynı).
        apiRequest('appeals?type=tax_document').then((r) => setTaxDecision(r?.decisions?.[0] || null)).catch(() => null);
        const result = await apiRequest('brand-verification');
        if (result.error) {
            setError(result.error);
        } else {
            const s = result.state;
            setState(s);
            setIdentity({
                companyLegalName: s.companyLegalName || '',
                taxId: s.taxId || '',
                taxOffice: s.taxOffice || '',
                taxOfficeCity: s.taxOfficeCity || '',
            });
            setEditingIdentity(!s.taxId);
            setEmail(s.corporateEmail || '');
            setCodeSent(!!s.corporateEmail && !s.corporateEmailVerified);
        }
        setLoading(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const run = async (key, body, { onSuccess, successMessage } = {}) => {
        setBusy(key);
        setError(null);
        setMessage(null);
        const result = await apiRequest('brand-verification', { method: 'POST', body });
        setBusy(null);
        if (result.error) {
            setError(result.error);
            return null;
        }
        setMessage(result.message || successMessage || null);
        onSuccess?.(result);
        await load();
        return result;
    };

    const saveIdentity = () => {
        const doSave = () => run('identity', { action: 'identity', ...identity }, { successMessage: 'Kurumsal bilgiler kaydedildi.' });
        // Onaylı marka yasal bilgilerini değiştirirse onay düşer (web ile aynı kural, veritabanında uygulanıyor).
        const changed = state && (
            identity.companyLegalName.trim() !== (state.companyLegalName || '') ||
            identity.taxId.replace(/[\s.-]/g, '') !== (state.taxId || '') ||
            identity.taxOffice.trim() !== (state.taxOffice || '') ||
            identity.taxOfficeCity !== (state.taxOfficeCity || '')
        );
        if (changed && (state.verificationStatus === 'verified' || state.taxIdVerified)) {
            Alert.alert(
                'Onay yeniden incelenecek',
                'Yasal bilgilerinizi değiştirirseniz mevcut onayınız ve Resmi İşletme rozeti kaldırılır; yeniden doğrulamanız gerekir.',
                [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Kaydet', style: 'destructive', onPress: doSave }]
            );
            return;
        }
        doSave();
    };

    // Kovaya doğrudan yükleme kapalı: sunucu günlük sınırı kontrol edip imzalı yükleme adresi verir (web ile aynı).
    const uploadTaxDocument = async (bytes, extension, contentType) => {
        const upload = await apiRequest('brand-verification', { method: 'POST', body: { action: 'upload-url', extension } });
        if (upload.error || !upload.path || !upload.token) throw new Error(upload.error || 'Belge yüklenemedi. Lütfen tekrar deneyin.');
        const { error: uploadError } = await supabase.storage
            .from('tax-documents')
            .uploadToSignedUrl(upload.path, upload.token, bytes, { contentType });
        if (uploadError) throw new Error('Belge yüklenemedi. Lütfen tekrar deneyin.');
        await run('tax', { action: 'tax', filePath: upload.path });
    };

    const pickPdf = async () => {
        try {
            const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
            if (picked.canceled || !picked.assets?.[0]) return;
            const asset = picked.assets[0];
            if (asset.size && asset.size > MAX_BYTES) return setError('Belge en fazla 5 MB olabilir.');
            setBusy('tax');
            setError(null);
            const bytes = await (await fetch(asset.uri)).arrayBuffer();
            if (bytes.byteLength > MAX_BYTES) {
                setBusy(null);
                return setError('Belge en fazla 5 MB olabilir.');
            }
            await uploadTaxDocument(bytes, 'pdf', 'application/pdf');
        } catch (e) {
            setBusy(null);
            setError(e.message || 'Belge yüklenemedi.');
        }
    };

    const pickPhoto = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.Images,
                quality: 0.8,
                base64: true,
            });
            if (result.canceled || !result.assets?.[0]?.base64) return;
            const bytes = decode(result.assets[0].base64);
            if (bytes.byteLength > MAX_BYTES) return setError('Belge en fazla 5 MB olabilir.');
            setBusy('tax');
            setError(null);
            await uploadTaxDocument(bytes, 'jpg', 'image/jpeg');
        } catch (e) {
            setBusy(null);
            setError(e.message || 'Belge yüklenemedi.');
        }
    };

    if (loading) {
        return (
            <View className="flex-1 bg-bg items-center justify-center">
                <ActivityIndicator color={colors.gold} size="large" />
            </View>
        );
    }

    const identityComplete = !!(state?.companyLegalName && state?.taxId && state?.taxOffice && state?.taxOfficeCity);
    const latest = state?.latestTaxVerification;
    const latestApproved = latest && (latest.status === 'approved' || latest.status === 'auto_approved');
    // Onaylı levha sonrası yasal bilgiler değiştiyse onay düşmüştür; eski "doğrulandı" sonucu gösterilmez (web ile aynı).
    const shownTax = latestApproved && !state?.taxIdVerified ? null : latest;
    const taxView = shownTax ? TAX_STATUS[shownTax.status] : null;
    const showTaxUpload = !state?.taxIdVerified && shownTax?.status !== 'processing';
    const emailChanged = email.trim().toLowerCase() !== (state?.corporateEmail || '').toLowerCase();
    const accountVerified = state?.verificationStatus === 'verified';
    const emailVerified = state?.corporateEmailVerified && !emailChanged;

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="İşletme doğrulama" onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />}
            contentClassName="pt-2"
        >
            <Notice
                tone={accountVerified ? 'gold' : 'warning'}
                icon={accountVerified ? CircleCheck : Clock}
                title={accountVerified ? 'Hesabınız onaylı' : 'Hesabınız henüz onaylanmadı'}
                text={accountVerified
                    ? 'Teklif gönderebilir ve ilan oluşturabilirsiniz.'
                    : 'Teklif göndermek ve ilan oluşturmak için hesabınızın onaylanması gerekir.'}
            />
            <Text variant="small" tone="fg3">
                Vergi levhanız ekibimizce onaylandığında ve kurumsal e-postanız doğrulandığında "Resmi İşletme" rozeti verilir.
            </Text>

            {error ? <Notice tone="danger" icon={AlertCircle} title={error} /> : null}
            {message && !error ? <Notice tone="gold" icon={CircleCheck} title={message} /> : null}

            {/* 1. Kurumsal kimlik */}
            <Card style={{ gap: 14 }}>
                <SectionHead icon={Building2} title="Kurumsal kimlik" done={identityComplete && !editingIdentity} />
                <TextField label="Resmi şirket unvanı" value={identity.companyLegalName} editable={editingIdentity}
                    onChangeText={(v) => setIdentity((f) => ({ ...f, companyLegalName: v }))} placeholder="Şirket Adı A.Ş." />
                <TextField label="Vergi numarası" value={identity.taxId} editable={editingIdentity} keyboardType="number-pad"
                    onChangeText={(v) => setIdentity((f) => ({ ...f, taxId: v }))} placeholder="10 haneli VKN veya 11 haneli TCKN" />
                <TextField label="Vergi dairesi" value={identity.taxOffice} editable={editingIdentity}
                    onChangeText={(v) => setIdentity((f) => ({ ...f, taxOffice: v }))} placeholder="Vergi dairesini girin" />
                <SelectField label="Vergi levhası ili" icon={MapPin} placeholder="İl seçin" value={identity.taxOfficeCity}
                    onPress={editingIdentity ? () => setCityPickerVisible(true) : undefined} />

                {state?.taxIdVerified && !editingIdentity ? (
                    <Chip label="Vergi numaranız doğrulandı" tone="success" icon={CircleCheck} />
                ) : null}

                {editingIdentity ? (
                    <View className="flex-row" style={{ gap: 10 }}>
                        {identityComplete ? (
                            <View className="flex-1"><Button title="Vazgeç" variant="secondary" onPress={() => { setEditingIdentity(false); load(); }} block /></View>
                        ) : null}
                        <View className="flex-1"><Button title="Kaydet" onPress={saveIdentity} loading={busy === 'identity'} disabled={!!busy} block /></View>
                    </View>
                ) : (
                    <Button title="Düzenle" variant="secondary" size="md" onPress={() => setEditingIdentity(true)} block />
                )}
            </Card>

            {/* 2. Kurumsal e-posta */}
            <Card style={{ gap: 14 }}>
                <SectionHead icon={Mail} title="Kurumsal e-posta" done={emailVerified} />
                <Text variant="small" tone="fg2">
                    Web sitenizin alan adına ait bir e-postayı (ör. ad@markaniz.com) kodla doğrulayın. Giriş e-postanızdan farklı olabilir.
                </Text>
                {!state?.website ? (
                    <Notice tone="warning" icon={AlertCircle} title="Önce profilinize web sitenizi ekleyin." text="Kurumsal e-postanın alan adı web sitenizle eşleşmelidir." />
                ) : (
                    <>
                        <TextField label="Kurumsal e-posta" value={email} onChangeText={setEmail} placeholder="ad@markaniz.com"
                            keyboardType="email-address" autoCapitalize="none" />
                        {emailVerified ? (
                            <Chip label={`${state.corporateEmail} doğrulandı`} tone="success" icon={CircleCheck} />
                        ) : (
                            <Button title="Doğrulama kodu gönder" loading={busy === 'email'} disabled={!!busy || !email.trim()} block
                                onPress={() => run('email', { action: 'email', email: email.trim() }, { onSuccess: () => { setCodeSent(true); setCode(''); } })} />
                        )}
                        {codeSent && !emailChanged && !state?.corporateEmailVerified ? (
                            <>
                                <TextField label="6 haneli kod" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                                    placeholder="123456" keyboardType="number-pad" textContentType="oneTimeCode" />
                                <View className="flex-row" style={{ gap: 10 }}>
                                    <View className="flex-1"><Button title="Tekrar gönder" variant="secondary" loading={busy === 'resend'} disabled={!!busy} onPress={() => run('resend', { action: 'resend' })} block /></View>
                                    <View className="flex-1"><Button title="Doğrula" loading={busy === 'confirm'} disabled={!!busy || code.length !== 6} onPress={() => run('confirm', { action: 'confirm', code })} block /></View>
                                </View>
                            </>
                        ) : null}
                    </>
                )}
            </Card>

            {/* 3. Vergi levhası */}
            <Card style={{ gap: 14 }}>
                <SectionHead icon={FileText} title="Vergi levhası" done={!!state?.taxIdVerified} />
                <Text variant="small" tone="fg2">
                    e-Devlet veya GİB İnternet Vergi Dairesi'nden indirdiğiniz vergi levhası PDF'ini yükleyin. Fotoğraflar da kabul edilir ancak incelemesi daha uzun sürebilir.
                </Text>

                {taxView && shownTax && !(state?.taxIdVerified && shownTax.status === 'rejected') ? (
                    <Notice
                        tone={taxView.tone}
                        icon={taxView.Icon}
                        title={taxView.title}
                        text={shownTax.status !== 'approved' && shownTax.status !== 'auto_approved' && (shownTax.reasons?.length ?? 0) > 0
                            ? shownTax.reasons.map((r) => `• ${r}`).join('\n')
                            : undefined}
                    />
                ) : null}

                {taxDecision && shownTax?.id && taxDecision.subjectId === shownTax.id && !state?.taxIdVerified && (taxDecision.canAppeal || taxDecision.appeal) ? (
                    <AppealCard key={taxDecision.id} decision={taxDecision} showReason={false} onDone={load} />
                ) : null}

                {showTaxUpload ? (
                    <>
                        {!identityComplete ? (
                            <Text variant="small" tone="fg2">Önce resmi unvan, vergi numarası, vergi dairesi ve ili kaydedin.</Text>
                        ) : null}
                        {busy === 'tax' ? (
                            <View className="h-12 rounded-xl bg-s2 flex-row items-center justify-center" style={{ gap: 8 }}>
                                <ActivityIndicator color={colors.gold} />
                                <Text variant="small" tone="fg2">Belge kontrol ediliyor...</Text>
                            </View>
                        ) : (
                            <View className="flex-row" style={{ gap: 10 }}>
                                <View className="flex-1"><Button title="PDF yükle" icon={Upload} disabled={!identityComplete || !!busy} onPress={pickPdf} block /></View>
                                <View className="flex-1"><Button title="Fotoğraf" icon={ImageIcon} variant="secondary" disabled={!identityComplete || !!busy} onPress={pickPhoto} block /></View>
                            </View>
                        )}
                        <Text variant="caption" tone="fg3">
                            Belgeniz sadece Influmatch sunucularında kontrol edilir; yapay zeka servislerine veya üçüncü taraflara gönderilmez. İnceleme için güvenli bir alanda saklanır.
                        </Text>
                    </>
                ) : null}
            </Card>

            <OptionSheet
                visible={cityPickerVisible}
                onClose={() => setCityPickerVisible(false)}
                title="Vergi levhası ili"
                searchPlaceholder="İl ara"
                options={TURKISH_CITIES}
                value={identity.taxOfficeCity}
                onSelect={(city) => setIdentity((f) => ({ ...f, taxOfficeCity: city }))}
            />
        </Screen>
    );
}
