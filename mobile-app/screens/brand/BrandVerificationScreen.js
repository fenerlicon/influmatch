import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { ArrowLeft, Shield, Building2, FileText, Mail, MapPin, CheckCircle2, Clock, XCircle, AlertCircle, ChevronDown, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';
import { TURKISH_CITIES } from '../../constants/cities';

// Marka doğrulaması web ile aynı akış: kurumsal kimlik (unvan, vergi no, daire, il) → kurumsal e-posta kodu →
// vergi levhası. Tüm kurallar sunucuda (lib/brand-verification.ts, lib/corporate-email-verification.ts).
// Vergi levhası yalnızca kendi sunucumuzda kontrol edilir; dış servislere gönderilmez.

const MAX_BYTES = 5 * 1024 * 1024;

const TAX_STATUS = {
    processing: { title: 'İnceleniyor', color: '#fbbf24', Icon: Clock },
    needs_review: { title: 'Ekibimiz inceliyor', color: '#fbbf24', Icon: Clock },
    auto_approved: { title: 'Vergi levhanız doğrulandı', color: '#4ade80', Icon: CheckCircle2 },
    approved: { title: 'Vergi levhanız doğrulandı', color: '#4ade80', Icon: CheckCircle2 },
    rejected: { title: 'Belge kabul edilmedi', color: '#f87171', Icon: XCircle },
};

const GlassCard = ({ children, className }) => (
    <View className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`}>
        <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </View>
);

const InputField = ({ label, value, onChange, placeholder, keyboardType = 'default', editable = true, autoCapitalize }) => (
    <View className="mb-4">
        <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">{label}</Text>
        <View className={`border border-white/10 rounded-2xl px-4 h-14 justify-center ${editable ? 'bg-black/30' : 'bg-white/5'}`}>
            <TextInput
                className={`text-sm ${editable ? 'text-white' : 'text-gray-400'}`}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#4b5563"
                keyboardType={keyboardType}
                editable={editable}
                autoCapitalize={autoCapitalize}
            />
        </View>
    </View>
);

const SectionTitle = ({ Icon, title, done }) => (
    <View className="flex-row items-center gap-2 mb-3">
        <Icon color={done ? '#4ade80' : '#D4AF37'} size={16} />
        <Text className="text-white font-bold text-sm flex-1">{title}</Text>
        {done && <CheckCircle2 color="#4ade80" size={16} />}
    </View>
);

const Notice = ({ color, Icon, title, children }) => (
    <View className="rounded-2xl border p-3 mb-3" style={{ borderColor: `${color}66`, backgroundColor: `${color}14` }}>
        <View className="flex-row items-center gap-2">
            <Icon color={color} size={16} />
            <Text style={{ color }} className="font-semibold text-sm flex-1">{title}</Text>
        </View>
        {children}
    </View>
);

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

    const load = useCallback(async () => {
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
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
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

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1">
                <View className="px-5 py-4 flex-row items-center gap-3 border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-2xl items-center justify-center border border-white/10">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-white font-bold text-base">İşletme Doğrulama</Text>
                        <Text className="text-gray-500 text-xs">Kurumsal kimlik, kurumsal e-posta ve vergi levhası</Text>
                    </View>
                    <View className="w-10 h-10 bg-amber-500/15 rounded-2xl border border-amber-500/25 items-center justify-center">
                        <Shield color="#fbbf24" size={18} />
                    </View>
                </View>

                <ScrollView className="flex-1 px-5" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60, paddingTop: 20 }}>
                    <Notice
                        color={accountVerified ? '#4ade80' : '#fbbf24'}
                        Icon={accountVerified ? CheckCircle2 : Clock}
                        title={accountVerified ? 'Hesabınız onaylı' : 'Hesabınız henüz onaylanmadı'}
                    >
                        <Text className="text-gray-400 text-xs mt-1 leading-5">
                            {accountVerified
                                ? 'Teklif gönderebilir ve ilan oluşturabilirsiniz.'
                                : 'Teklif göndermek ve ilan oluşturmak için hesabınızın onaylanması gerekir. Aşağıdaki bilgileri tamamlamanız incelemeyi kolaylaştırır.'}
                        </Text>
                    </Notice>
                    <Text className="text-gray-500 text-xs leading-5 mb-5">
                        Vergi levhanız ekibimizce onaylandığında ve kurumsal e-postanız doğrulandığında "Resmi İşletme" rozeti verilir.
                    </Text>

                    {error && (
                        <Notice color="#f87171" Icon={AlertCircle} title={error} />
                    )}
                    {message && !error && (
                        <Notice color="#4ade80" Icon={CheckCircle2} title={message} />
                    )}

                    {/* 1. Kurumsal kimlik */}
                    <GlassCard className="p-5 mb-5">
                        <SectionTitle Icon={Building2} title="Kurumsal Kimlik" done={identityComplete && !editingIdentity} />
                        <InputField label="Resmi Şirket Unvanı" value={identity.companyLegalName} editable={editingIdentity}
                            onChange={(v) => setIdentity((f) => ({ ...f, companyLegalName: v }))} placeholder="Şirket Adı A.Ş." />
                        <InputField label="Vergi Numarası" value={identity.taxId} editable={editingIdentity} keyboardType="number-pad"
                            onChange={(v) => setIdentity((f) => ({ ...f, taxId: v }))} placeholder="10 haneli VKN veya 11 haneli TCKN" />
                        <InputField label="Vergi Dairesi" value={identity.taxOffice} editable={editingIdentity}
                            onChange={(v) => setIdentity((f) => ({ ...f, taxOffice: v }))} placeholder="Vergi dairesini girin" />
                        <Text className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Vergi Levhası İli</Text>
                        <TouchableOpacity disabled={!editingIdentity} onPress={() => setCityPickerVisible(true)}
                            className={`border border-white/10 rounded-2xl px-4 h-14 flex-row items-center justify-between mb-4 ${editingIdentity ? 'bg-black/30' : 'bg-white/5'}`}>
                            <View className="flex-row items-center gap-2">
                                <MapPin color="#6b7280" size={14} />
                                <Text className={identity.taxOfficeCity ? (editingIdentity ? 'text-white text-sm' : 'text-gray-400 text-sm') : 'text-gray-600 text-sm'}>
                                    {identity.taxOfficeCity || 'İl seçin'}
                                </Text>
                            </View>
                            {editingIdentity && <ChevronDown color="#6b7280" size={16} />}
                        </TouchableOpacity>

                        {state?.taxIdVerified && !editingIdentity && (
                            <Notice color="#4ade80" Icon={CheckCircle2} title="Vergi numaranız doğrulandı." />
                        )}

                        {editingIdentity ? (
                            <View className="flex-row gap-3">
                                {identityComplete && (
                                    <TouchableOpacity onPress={() => { setEditingIdentity(false); load(); }}
                                        className="flex-1 h-12 rounded-2xl border border-white/10 items-center justify-center">
                                        <Text className="text-gray-300 font-semibold">Vazgeç</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={saveIdentity} disabled={!!busy}
                                    className="flex-1 h-12 rounded-2xl bg-soft-gold items-center justify-center">
                                    {busy === 'identity' ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold">Kaydet</Text>}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={() => setEditingIdentity(true)}
                                className="h-11 rounded-2xl border border-soft-gold/40 bg-soft-gold/10 items-center justify-center">
                                <Text className="text-soft-gold font-semibold text-sm">Düzenle</Text>
                            </TouchableOpacity>
                        )}
                    </GlassCard>

                    {/* 2. Kurumsal e-posta */}
                    <GlassCard className="p-5 mb-5">
                        <SectionTitle Icon={Mail} title="Kurumsal E-posta" done={state?.corporateEmailVerified && !emailChanged} />
                        <Text className="text-gray-500 text-xs leading-5 mb-4">
                            Web sitenizin alan adına ait bir e-postayı (ör. ad@markaniz.com) kodla doğrulayın. Giriş e-postanızdan farklı olabilir.
                        </Text>
                        {!state?.website ? (
                            <Notice color="#fbbf24" Icon={AlertCircle} title="Önce profilinize web sitenizi ekleyin.">
                                <Text className="text-gray-400 text-xs mt-1">Kurumsal e-postanın alan adı web sitenizle eşleşmelidir.</Text>
                            </Notice>
                        ) : (
                            <>
                                <InputField label="Kurumsal E-posta" value={email} onChange={setEmail} placeholder="ad@markaniz.com"
                                    keyboardType="email-address" autoCapitalize="none" />
                                {state?.corporateEmailVerified && !emailChanged ? (
                                    <Notice color="#4ade80" Icon={CheckCircle2} title={`${state.corporateEmail} doğrulandı.`} />
                                ) : (
                                    <TouchableOpacity disabled={!!busy || !email.trim()} onPress={() => run('email', { action: 'email', email: email.trim() }, { onSuccess: () => { setCodeSent(true); setCode(''); } })}
                                        className={`h-12 rounded-2xl items-center justify-center mb-3 ${email.trim() ? 'bg-soft-gold' : 'bg-white/10'}`}>
                                        {busy === 'email' ? <ActivityIndicator color="black" /> : <Text className={email.trim() ? 'text-black font-bold' : 'text-gray-500 font-bold'}>Doğrulama kodu gönder</Text>}
                                    </TouchableOpacity>
                                )}
                                {codeSent && !emailChanged && !state?.corporateEmailVerified && (
                                    <>
                                        <InputField label="6 Haneli Kod" value={code} onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                                            placeholder="123456" keyboardType="number-pad" />
                                        <View className="flex-row gap-3">
                                            <TouchableOpacity disabled={!!busy} onPress={() => run('resend', { action: 'resend' })}
                                                className="flex-1 h-12 rounded-2xl border border-white/10 items-center justify-center">
                                                {busy === 'resend' ? <ActivityIndicator color="#D4AF37" /> : <Text className="text-gray-300 font-semibold">Tekrar gönder</Text>}
                                            </TouchableOpacity>
                                            <TouchableOpacity disabled={!!busy || code.length !== 6} onPress={() => run('confirm', { action: 'confirm', code })}
                                                className={`flex-1 h-12 rounded-2xl items-center justify-center ${code.length === 6 ? 'bg-soft-gold' : 'bg-white/10'}`}>
                                                {busy === 'confirm' ? <ActivityIndicator color="black" /> : <Text className={code.length === 6 ? 'text-black font-bold' : 'text-gray-500 font-bold'}>Doğrula</Text>}
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </>
                        )}
                    </GlassCard>

                    {/* 3. Vergi levhası */}
                    <GlassCard className="p-5 mb-5">
                        <SectionTitle Icon={FileText} title="Vergi Levhası" done={!!state?.taxIdVerified} />
                        <Text className="text-gray-500 text-xs leading-5 mb-4">
                            e-Devlet veya GİB İnternet Vergi Dairesi'nden indirdiğiniz vergi levhası PDF'ini yükleyin. Fotoğraflar da kabul edilir
                            ancak incelemesi daha uzun sürebilir.
                        </Text>

                        {taxView && shownTax && !(state?.taxIdVerified && shownTax.status === 'rejected') && (
                            <Notice color={taxView.color} Icon={taxView.Icon} title={taxView.title}>
                                {shownTax.status !== 'approved' && shownTax.status !== 'auto_approved' && (shownTax.reasons?.length ?? 0) > 0 && (
                                    <View className="mt-2">
                                        {shownTax.reasons.map((reason) => (
                                            <Text key={reason} className="text-gray-400 text-xs leading-5">• {reason}</Text>
                                        ))}
                                    </View>
                                )}
                            </Notice>
                        )}

                        {showTaxUpload && (
                            <>
                                {!identityComplete && (
                                    <Text className="text-gray-400 text-xs mb-3">Önce resmi unvan, vergi numarası, vergi dairesi ve ili kaydedin.</Text>
                                )}
                                {busy === 'tax' ? (
                                    <View className="h-12 rounded-2xl bg-white/5 flex-row items-center justify-center gap-2">
                                        <ActivityIndicator color="#D4AF37" />
                                        <Text className="text-gray-300 text-sm">Belge kontrol ediliyor...</Text>
                                    </View>
                                ) : (
                                    <View className="flex-row gap-3">
                                        <TouchableOpacity disabled={!identityComplete || !!busy} onPress={pickPdf}
                                            className={`flex-1 h-12 rounded-2xl border items-center justify-center ${identityComplete ? 'border-soft-gold/60 bg-soft-gold/10' : 'border-white/10 bg-white/5'}`}>
                                            <Text className={identityComplete ? 'text-soft-gold font-semibold' : 'text-gray-600 font-semibold'}>PDF yükle</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity disabled={!identityComplete || !!busy} onPress={pickPhoto}
                                            className={`flex-1 h-12 rounded-2xl border items-center justify-center ${identityComplete ? 'border-white/20 bg-white/5' : 'border-white/10 bg-white/5'}`}>
                                            <Text className={identityComplete ? 'text-gray-200 font-semibold' : 'text-gray-600 font-semibold'}>Fotoğraf yükle</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <Text className="text-gray-600 text-[10px] leading-4 mt-3">
                                    Belgeniz sadece Influmatch sunucularında kontrol edilir; yapay zeka servislerine veya üçüncü taraflara gönderilmez.
                                    İnceleme için güvenli bir alanda saklanır.
                                </Text>
                            </>
                        )}
                    </GlassCard>
                </ScrollView>
            </SafeAreaView>

            <Modal visible={cityPickerVisible} animationType="slide" transparent onRequestClose={() => setCityPickerVisible(false)}>
                <View className="flex-1 bg-black/70 justify-end">
                    <View className="bg-[#0F1014] rounded-t-[28px] border-t border-white/10 max-h-[70%]">
                        <View className="flex-row items-center justify-between px-6 py-4 border-b border-white/5">
                            <Text className="text-white font-bold">Vergi Levhası İli</Text>
                            <TouchableOpacity onPress={() => setCityPickerVisible(false)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                <X color="white" size={18} />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={TURKISH_CITIES}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => { setIdentity((f) => ({ ...f, taxOfficeCity: item })); setCityPickerVisible(false); }}
                                    className="px-6 py-3.5 border-b border-white/5">
                                    <Text className={item === identity.taxOfficeCity ? 'text-soft-gold font-semibold' : 'text-gray-200'}>{item}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
