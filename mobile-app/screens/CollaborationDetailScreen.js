import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Alert, RefreshControl, TextInput, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, X, Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../lib/api';
import {
    AGREEMENT_LIMITS,
    AGREEMENT_SUMMARY_NOTE,
    DELIVERABLE_KINDS,
    DELIVERABLE_KIND_LABELS,
    DELIVERABLE_STATUS,
    PAYMENT_TYPE_LABELS,
    formatTryAmount,
    reliabilityText,
    revisionUsageText,
} from '../constants/collaborationWorkspace';

// İş birliği takip alanı: anlaşma özeti, teslimatlar (taslak / revize / yayın) ve ödeme teyidi.
// Web'deki /dashboard/collaborations/[id] ile aynı akış; bütün işlemler /api/mobile/collaborations/[id] üzerinden
// web'in sunucu kodundan geçer (lib/collaboration-workspace.ts). Taslak bugün yalnızca link (dosya yükleme R2 ile gelecek).

const COLLAB_STATUS = {
    agreed: { label: 'Anlaşıldı', color: '#38bdf8' },
    in_progress: { label: 'İçerik hazırlanıyor', color: '#fbbf24' },
    published: { label: 'Yayında, onay bekliyor', color: '#c084fc' },
    completed: { label: 'Tamamlandı', color: '#34d399' },
    cancelled: { label: 'İptal edildi', color: '#f87171' },
};

const formatDate = (value) =>
    value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const today = () => new Date().toISOString().slice(0, 10);

const Chip = ({ label, color }) => (
    <View className="px-2.5 py-1 rounded-full border self-start" style={{ borderColor: `${color}66`, backgroundColor: `${color}1A` }}>
        <Text style={{ color }} className="text-[11px] font-semibold">{label}</Text>
    </View>
);

const Btn = ({ label, color = '#e5e7eb', onPress, disabled }) => (
    <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        className="px-4 py-2.5 rounded-xl border mr-2 mb-2"
        style={{ borderColor: `${color}66`, backgroundColor: `${color}1A`, opacity: disabled ? 0.5 : 1 }}
    >
        <Text style={{ color }} className="text-xs font-semibold">{label}</Text>
    </TouchableOpacity>
);

const Card = ({ title, right, children }) => (
    <View className="rounded-[22px] border border-white/10 bg-white/5 p-4 mb-4">
        <View className="flex-row items-center justify-between mb-3">
            <Text className="text-white font-bold text-base">{title}</Text>
            {right}
        </View>
        {children}
    </View>
);

const Field = ({ label, children }) => (
    <View className="mb-3">
        <Text className="text-gray-400 text-xs mb-1">{label}</Text>
        {children}
    </View>
);

const inputClass = 'bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white';

const LinkText = ({ url }) =>
    url ? (
        <TouchableOpacity onPress={() => Linking.openURL(url).catch(() => null)}>
            <Text className="text-soft-gold text-xs" numberOfLines={1}>{url}</Text>
        </TouchableOpacity>
    ) : null;

export default function CollaborationDetailScreen({ navigation, route }) {
    const id = route?.params?.id;
    const [ws, setWs] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [draft, setDraft] = useState(null); // anlaşma düzenleme formu
    const [sheet, setSheet] = useState(null); // { kind, deliverable?, url, note, date }
    const [historyOpen, setHistoryOpen] = useState({});

    const load = useCallback(async () => {
        if (!id) return;
        const result = await apiRequest(`collaborations/${id}`);
        if (result.error) setError(result.error);
        else {
            setError(null);
            setWs(result.workspace);
        }
        setLoading(false);
        setRefreshing(false);
    }, [id]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const run = async (body, after) => {
        setBusy(true);
        const result = await apiRequest(`collaborations/${id}`, { method: 'POST', body });
        setBusy(false);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        setSheet(null);
        after?.();
        if (result.message) Alert.alert('Tamam', result.message);
        await load();
    };

    const runCollab = async (action) => {
        setBusy(true);
        const result = await apiRequest('collaborations', { method: 'POST', body: { id, action } });
        setBusy(false);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        await load();
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    const collab = ws?.collaboration;
    const agreement = ws?.agreement;
    const deliverables = ws?.deliverables || [];
    const payment = ws?.payment;
    const perms = ws?.permissions || {};
    const isBrand = collab?.viewer_role === 'brand';
    const otherName = collab?.other?.full_name || (collab?.other?.username ? `@${collab.other.username}` : 'Kullanıcı');
    const lockedIds = new Set(deliverables.filter((d) => d.status !== 'pending' || d.draft_submitted_at || d.revisions_used > 0).map((d) => d.id));

    const startEditing = () => {
        setDraft({
            payment_type: agreement?.payment_type || 'cash',
            fee_amount: agreement?.fee_amount != null ? String(agreement.fee_amount) : '',
            revision_limit: String(agreement?.revision_limit ?? 2),
            usage_rights: agreement?.usage_rights || '',
            deliverables: deliverables.length
                ? deliverables.map((d) => ({ id: d.id, kind: d.kind, quantity: String(d.quantity), note: d.note || '', due_date: d.due_date || '' }))
                : [{ id: null, kind: 'reel', quantity: '1', note: '', due_date: '' }],
        });
    };

    const saveAgreement = () =>
        run(
            {
                action: 'save_agreement',
                version: agreement?.version ?? null,
                agreement: {
                    payment_type: draft.payment_type,
                    fee_amount: draft.fee_amount.trim() === '' ? null : Number(draft.fee_amount),
                    revision_limit: Number(draft.revision_limit),
                    usage_rights: draft.usage_rights,
                    deliverables: draft.deliverables.map((d) => ({
                        id: d.id,
                        kind: d.kind,
                        quantity: Number(d.quantity),
                        note: d.note,
                        due_date: d.due_date.trim() || null,
                    })),
                },
            },
            () => setDraft(null),
        );

    const updateRow = (index, patch) =>
        setDraft((d) => ({ ...d, deliverables: d.deliverables.map((row, i) => (i === index ? { ...row, ...patch } : row)) }));

    const openSheet = (kind, deliverable) => setSheet({ kind, deliverable, url: '', note: '', date: today() });

    const submitSheet = () => {
        const s = sheet;
        if (s.kind === 'submit_draft') run({ action: 'submit_draft', deliverableId: s.deliverable.id, url: s.url.trim(), note: s.note });
        else if (s.kind === 'request_revision') run({ action: 'request_revision', deliverableId: s.deliverable.id, note: s.note });
        else if (s.kind === 'publish_deliverable') run({ action: 'publish_deliverable', deliverableId: s.deliverable.id, url: s.url.trim() });
        else if (s.kind === 'mark_paid' || s.kind === 'confirm_payment') run({ action: s.kind, date: s.date.trim(), note: s.note });
        else if (s.kind === 'report_nonpayment') run({ action: 'report_nonpayment', note: s.note });
    };

    const SHEET_TITLES = {
        submit_draft: 'Taslak gönder',
        request_revision: 'Revize iste',
        publish_deliverable: 'Yayın linki',
        mark_paid: 'Ödeme yapıldı',
        confirm_payment: 'Ödeme alındı',
        report_nonpayment: 'Ödeme alamadım',
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pt-4 pb-2 flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest">İŞ BİRLİĞİ</Text>
                        <Text className="text-white text-xl font-bold tracking-tight" numberOfLines={1}>{collab?.title || 'İş birliği'}</Text>
                    </View>
                </View>

                {error || !collab ? (
                    <View className="flex-1 items-center justify-center px-8">
                        <Text className="text-gray-400 text-sm text-center">{error || 'İş birliği bulunamadı.'}</Text>
                    </View>
                ) : (
                    <ScrollView
                        className="flex-1 px-6 pt-2"
                        contentContainerStyle={{ paddingBottom: 60 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#D4AF37" />}
                    >
                        <View className="mb-4">
                            <Text className="text-gray-400 text-xs">
                                {otherName} · {collab.source === 'offer' ? 'Teklif' : 'İlan başvurusu'} · {formatDate(collab.created_at)}
                            </Text>
                            {!isBrand ? (
                                <Text className="text-gray-400 text-xs mt-1">
                                    Marka geçmişi: <Text className="text-gray-200">{reliabilityText(ws.brandReliability.completed, ws.brandReliability.confirmed)}</Text>
                                </Text>
                            ) : null}
                            <View className="mt-2"><Chip {...(COLLAB_STATUS[collab.status] || COLLAB_STATUS.agreed)} /></View>
                            {collab.auto_complete_at ? (
                                <Text className="text-gray-400 text-xs mt-2">
                                    {isBrand
                                        ? `Onaylamazsanız ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır.`
                                        : `Marka yanıt vermezse ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır.`}
                                </Text>
                            ) : null}
                            {collab.actions.includes('approve') ? (
                                <View className="flex-row mt-3">
                                    <Btn
                                        label="Onayla ve tamamla"
                                        color="#34d399"
                                        disabled={busy}
                                        onPress={() =>
                                            Alert.alert('İş birliğini onayla', 'Yayın linklerini kontrol ettiyseniz iş birliği tamamlanacak.', [
                                                { text: 'Vazgeç', style: 'cancel' },
                                                { text: 'Onayla', onPress: () => runCollab('approve') },
                                            ])
                                        }
                                    />
                                </View>
                            ) : null}
                        </View>

                        {/* Anlaşma özeti */}
                        <Card
                            title="Anlaşma özeti"
                            right={agreement ? (
                                <Chip label={ws.agreementConfirmed ? 'İki taraf onayladı' : 'Onay bekliyor'} color={ws.agreementConfirmed ? '#34d399' : '#fbbf24'} />
                            ) : null}
                        >
                            {agreement ? (
                                <>
                                    <Text className="text-gray-200 text-sm">
                                        Ücret: {formatTryAmount(agreement.fee_amount)} · {PAYMENT_TYPE_LABELS[agreement.payment_type]}
                                    </Text>
                                    <Text className="text-gray-200 text-sm mt-1">Revize sayısı: {agreement.revision_limit}</Text>
                                    <Text className="text-gray-200 text-sm mt-1">Kullanım hakkı: {agreement.usage_rights || '—'}</Text>
                                    <View className="mt-2">
                                        {deliverables.map((d) => (
                                            <Text key={d.id} className="text-gray-300 text-xs mt-1">
                                                • {DELIVERABLE_KIND_LABELS[d.kind]} ×{d.quantity}
                                                {d.due_date ? ` · teslim ${formatDate(d.due_date)}` : ''}
                                                {d.note ? ` · ${d.note}` : ''}
                                            </Text>
                                        ))}
                                    </View>
                                    <Text className="text-gray-400 text-xs mt-3">
                                        Marka onayı: {agreement.brand_confirmed_at ? formatDateTime(agreement.brand_confirmed_at) : 'bekleniyor'}
                                    </Text>
                                    <Text className="text-gray-400 text-xs mt-1">
                                        Influencer onayı: {agreement.influencer_confirmed_at ? formatDateTime(agreement.influencer_confirmed_at) : 'bekleniyor'}
                                    </Text>
                                    <Text className="text-gray-500 text-[11px] mt-2">{AGREEMENT_SUMMARY_NOTE}</Text>
                                    <View className="flex-row flex-wrap mt-3">
                                        {perms.canConfirmAgreement ? (
                                            <Btn label="Özeti onayla" color="#34d399" disabled={busy} onPress={() => run({ action: 'confirm_agreement', version: agreement.version })} />
                                        ) : null}
                                        {perms.canEditAgreement ? <Btn label="Düzenle" disabled={busy} onPress={startEditing} /> : null}
                                    </View>
                                </>
                            ) : (
                                <>
                                    <Text className="text-gray-400 text-sm leading-5">
                                        Henüz anlaşma özeti yok. Teslimatları, ücreti, tarihleri, kullanım hakkını ve revize sayısını bir taraf yazar, diğeri onaylar.
                                    </Text>
                                    {perms.canEditAgreement ? (
                                        <View className="flex-row mt-3"><Btn label="Anlaşma özeti hazırla" color="#D4AF37" onPress={startEditing} /></View>
                                    ) : null}
                                </>
                            )}
                        </Card>

                        {/* Teslimatlar */}
                        {deliverables.length > 0 ? (
                            <Card title="Teslimatlar">
                                {!ws.agreementConfirmed && ['agreed', 'in_progress'].includes(collab.status) ? (
                                    <Text className="text-gray-400 text-xs mb-3">Teslimatlar, anlaşma özeti iki tarafça onaylanınca başlar.</Text>
                                ) : null}
                                {deliverables.map((d) => {
                                    const st = DELIVERABLE_STATUS[d.status] || DELIVERABLE_STATUS.pending;
                                    const limit = agreement?.revision_limit ?? 0;
                                    return (
                                        <View key={d.id} className="border border-white/10 rounded-2xl p-3 mb-3">
                                            <View className="flex-row items-start justify-between">
                                                <View className="flex-1 pr-2">
                                                    <Text className="text-white font-semibold text-sm">{DELIVERABLE_KIND_LABELS[d.kind]} ×{d.quantity}</Text>
                                                    <Text className="text-gray-400 text-xs mt-0.5">
                                                        {d.due_date ? `Teslim: ${formatDate(d.due_date)} · ` : ''}{revisionUsageText(d.revisions_used, limit)}
                                                    </Text>
                                                    {d.note ? <Text className="text-gray-500 text-xs mt-0.5">{d.note}</Text> : null}
                                                </View>
                                                <Chip label={st.label} color={st.color} />
                                            </View>
                                            {d.draft_url ? (
                                                <View className="mt-2">
                                                    <Text className="text-gray-500 text-[11px]">Son taslak</Text>
                                                    <LinkText url={d.draft_url} />
                                                    {d.draft_note ? <Text className="text-gray-400 text-xs">{d.draft_note}</Text> : null}
                                                </View>
                                            ) : null}
                                            {d.status === 'revision_requested' && d.review_note ? (
                                                <Text className="text-yellow-200 text-xs mt-2">Revize isteği: {d.review_note}</Text>
                                            ) : null}
                                            {d.publish_url ? (
                                                <View className="mt-2">
                                                    <Text className="text-gray-500 text-[11px]">Yayın</Text>
                                                    <LinkText url={d.publish_url} />
                                                </View>
                                            ) : null}
                                            <View className="flex-row flex-wrap mt-3">
                                                {d.actions.includes('submit_draft') ? (
                                                    <Btn label={d.status === 'pending' ? 'Taslak gönder' : 'Yeni taslak gönder'} color="#c084fc" disabled={busy} onPress={() => openSheet('submit_draft', d)} />
                                                ) : null}
                                                {d.actions.includes('approve_draft') ? (
                                                    <Btn label="Taslağı onayla" color="#34d399" disabled={busy} onPress={() => run({ action: 'approve_draft', deliverableId: d.id })} />
                                                ) : null}
                                                {d.actions.includes('request_revision') ? (
                                                    <Btn label="Revize iste" color="#fbbf24" disabled={busy} onPress={() => openSheet('request_revision', d)} />
                                                ) : null}
                                                {d.actions.includes('publish_deliverable') ? (
                                                    <Btn label="Yayın linkini gir" color="#D4AF37" disabled={busy} onPress={() => openSheet('publish_deliverable', d)} />
                                                ) : null}
                                                {d.submissions?.length ? (
                                                    <Btn label={`Geçmiş (${d.submissions.length})`} onPress={() => setHistoryOpen((h) => ({ ...h, [d.id]: !h[d.id] }))} />
                                                ) : null}
                                            </View>
                                            {isBrand && d.status === 'draft_submitted' && d.revisions_used >= limit ? (
                                                <Text className="text-gray-500 text-xs">Revize hakkı doldu.</Text>
                                            ) : null}
                                            {historyOpen[d.id] ? (
                                                <View className="border-l border-white/10 pl-3 mt-2">
                                                    {d.submissions.map((s) => (
                                                        <View key={s.id} className="mb-2">
                                                            <Text className="text-gray-300 text-xs">{formatDateTime(s.created_at)}</Text>
                                                            <LinkText url={s.url} />
                                                            {s.note ? <Text className="text-gray-400 text-xs">{s.note}</Text> : null}
                                                            {s.review === 'approved' ? <Text className="text-emerald-300 text-xs">Onaylandı</Text> : null}
                                                            {s.review === 'revision_requested' ? <Text className="text-yellow-200 text-xs">Revize: {s.review_note}</Text> : null}
                                                        </View>
                                                    ))}
                                                </View>
                                            ) : null}
                                        </View>
                                    );
                                })}
                            </Card>
                        ) : null}

                        {/* Ödeme */}
                        <Card title="Ödeme">
                            <Text className="text-gray-400 text-sm">
                                Marka: <Text className="text-gray-200">
                                    {payment?.brand_paid_at ? `Ödeme yapıldı (${formatDate(payment.brand_paid_date || payment.brand_paid_at)})` : 'işaretlenmedi'}
                                </Text>
                            </Text>
                            {payment?.brand_note ? <Text className="text-gray-500 text-xs">{payment.brand_note}</Text> : null}
                            <Text className="text-gray-400 text-sm mt-1">
                                Influencer: <Text className="text-gray-200">
                                    {payment?.influencer_received_at ? `Ödeme alındı (${formatDate(payment.influencer_received_date || payment.influencer_received_at)})` : 'teyit edilmedi'}
                                </Text>
                            </Text>
                            {payment?.influencer_note ? <Text className="text-gray-500 text-xs">{payment.influencer_note}</Text> : null}
                            {payment?.nonpayment_reported_at ? (
                                <Text className="text-yellow-200 text-xs mt-2">
                                    Ödeme alınamadı bildirimi {formatDate(payment.nonpayment_reported_at)} tarihinde destek ekibine iletildi.
                                </Text>
                            ) : null}
                            <View className="flex-row flex-wrap mt-3">
                                {perms.canMarkPaid ? (
                                    <Btn label={payment?.brand_paid_at ? 'Ödeme bilgisini güncelle' : 'Ödeme yapıldı'} color="#34d399" disabled={busy} onPress={() => openSheet('mark_paid')} />
                                ) : null}
                                {perms.canUnmarkPaid ? <Btn label="İşareti kaldır" disabled={busy} onPress={() => run({ action: 'unmark_paid' })} /> : null}
                                {perms.canConfirmPayment ? (
                                    <Btn label={payment?.influencer_received_at ? 'Ödeme bilgisini güncelle' : 'Ödeme alındı'} color="#34d399" disabled={busy} onPress={() => openSheet('confirm_payment')} />
                                ) : null}
                                {perms.canUnconfirmPayment ? <Btn label="Teyidi kaldır" disabled={busy} onPress={() => run({ action: 'unconfirm_payment' })} /> : null}
                                {perms.canReportNonpayment ? <Btn label="Ödeme alamadım" color="#f87171" disabled={busy} onPress={() => openSheet('report_nonpayment')} /> : null}
                            </View>
                            {!perms.canReportNonpayment && perms.nonpaymentAvailableAt && !payment?.nonpayment_reported_at ? (
                                <Text className="text-gray-500 text-xs">
                                    Ödemeyi alamazsanız {formatDate(perms.nonpaymentAvailableAt)} tarihinden sonra buradan destek ekibine bildirebilirsiniz.
                                </Text>
                            ) : null}
                        </Card>
                    </ScrollView>
                )}
            </SafeAreaView>

            {/* İşlem formu */}
            <Modal animationType="slide" transparent visible={!!sheet} onRequestClose={() => setSheet(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/70 justify-end">
                    {sheet ? (
                        <View className="bg-[#0F1014] rounded-t-[28px] border-t border-white/10 p-6 pb-10">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-white text-lg font-bold">{SHEET_TITLES[sheet.kind]}</Text>
                                <TouchableOpacity onPress={() => setSheet(null)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                    <X color="white" size={18} />
                                </TouchableOpacity>
                            </View>
                            {sheet.kind === 'submit_draft' || sheet.kind === 'publish_deliverable' ? (
                                <Field label={sheet.kind === 'submit_draft' ? 'Taslak linki (Drive, WeTransfer, önizleme…)' : 'Instagram, TikTok veya YouTube linki'}>
                                    <TextInput
                                        value={sheet.url}
                                        onChangeText={(url) => setSheet({ ...sheet, url })}
                                        placeholder="https://..."
                                        placeholderTextColor="#6b7280"
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="url"
                                        maxLength={500}
                                        className={inputClass}
                                    />
                                </Field>
                            ) : null}
                            {sheet.kind === 'mark_paid' || sheet.kind === 'confirm_payment' ? (
                                <Field label="Ödeme tarihi (YYYY-AA-GG)">
                                    <TextInput
                                        value={sheet.date}
                                        onChangeText={(date) => setSheet({ ...sheet, date })}
                                        placeholder="2026-10-10"
                                        placeholderTextColor="#6b7280"
                                        maxLength={10}
                                        className={inputClass}
                                    />
                                </Field>
                            ) : null}
                            {sheet.kind === 'request_revision' ? (
                                <Text className="text-gray-400 text-xs mb-2">
                                    Bu istekle {revisionUsageText(sheet.deliverable.revisions_used + 1, agreement?.revision_limit ?? 0)}.
                                </Text>
                            ) : null}
                            {sheet.kind === 'report_nonpayment' ? (
                                <Text className="text-gray-400 text-xs mb-2">Bildiriminiz destek ekibine iletilir ve markaya haber verilir.</Text>
                            ) : null}
                            {sheet.kind !== 'publish_deliverable' ? (
                                <Field label={sheet.kind === 'request_revision' ? 'Ne değişmeli?' : 'Not (isteğe bağlı)'}>
                                    <TextInput
                                        value={sheet.note}
                                        onChangeText={(note) => setSheet({ ...sheet, note })}
                                        placeholderTextColor="#6b7280"
                                        multiline
                                        maxLength={sheet.kind === 'mark_paid' || sheet.kind === 'confirm_payment' ? AGREEMENT_LIMITS.paymentNoteMax : AGREEMENT_LIMITS.draftNoteMax}
                                        className={inputClass}
                                    />
                                </Field>
                            ) : null}
                            <TouchableOpacity disabled={busy} onPress={submitSheet} className={`mt-2 rounded-xl py-3 items-center ${sheet.kind === 'report_nonpayment' ? 'bg-red-500/80' : 'bg-soft-gold'}`}>
                                {busy ? <ActivityIndicator color="#000" /> : <Text className={`font-bold ${sheet.kind === 'report_nonpayment' ? 'text-white' : 'text-black'}`}>Gönder</Text>}
                            </TouchableOpacity>
                        </View>
                    ) : null}
                </KeyboardAvoidingView>
            </Modal>

            {/* Anlaşma özeti düzenleme */}
            <Modal animationType="slide" transparent visible={!!draft} onRequestClose={() => setDraft(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/70 justify-end">
                    {draft ? (
                        <View className="bg-[#0F1014] rounded-t-[28px] border-t border-white/10 p-6 pb-10" style={{ maxHeight: '90%' }}>
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-white text-lg font-bold">Anlaşma özeti</Text>
                                <TouchableOpacity onPress={() => setDraft(null)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                    <X color="white" size={18} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView keyboardShouldPersistTaps="handled">
                                {ws?.agreementConfirmed ? (
                                    <Text className="text-yellow-100 text-xs mb-3">
                                        Kaydettiğinizde iki onay da sıfırlanır; kaydınız yeni hali onayınız sayılır, karşı taraf yeniden onaylar.
                                    </Text>
                                ) : null}
                                <Field label="Ödeme türü">
                                    <View className="flex-row">
                                        {Object.keys(PAYMENT_TYPE_LABELS).map((t) => (
                                            <TouchableOpacity
                                                key={t}
                                                onPress={() => setDraft({ ...draft, payment_type: t })}
                                                className={`px-4 py-2 rounded-xl border mr-2 ${draft.payment_type === t ? 'border-soft-gold bg-soft-gold/10' : 'border-white/10'}`}
                                            >
                                                <Text className={draft.payment_type === t ? 'text-soft-gold text-xs font-semibold' : 'text-gray-400 text-xs'}>{PAYMENT_TYPE_LABELS[t]}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </Field>
                                <Field label={`Anlaşılan ücret (₺)${draft.payment_type === 'barter' ? ', isteğe bağlı' : ''}`}>
                                    <TextInput value={draft.fee_amount} onChangeText={(v) => setDraft({ ...draft, fee_amount: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={8} className={inputClass} />
                                </Field>
                                <Field label={`Revize sayısı (0–${AGREEMENT_LIMITS.maxRevisions})`}>
                                    <TextInput value={draft.revision_limit} onChangeText={(v) => setDraft({ ...draft, revision_limit: v.replace(/[^0-9]/g, '') })} keyboardType="number-pad" maxLength={2} className={inputClass} />
                                </Field>
                                <Field label="Kullanım hakkı (kısa)">
                                    <TextInput value={draft.usage_rights} onChangeText={(v) => setDraft({ ...draft, usage_rights: v })} multiline maxLength={AGREEMENT_LIMITS.usageRightsMax} className={inputClass} />
                                </Field>
                                <Text className="text-gray-400 text-xs mb-2">Teslimatlar</Text>
                                {draft.deliverables.map((row, index) => (
                                    <View key={row.id || `new-${index}`} className="border border-white/10 rounded-2xl p-3 mb-3">
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                                            {DELIVERABLE_KINDS.map((k) => (
                                                <TouchableOpacity
                                                    key={k.value}
                                                    onPress={() => updateRow(index, { kind: k.value })}
                                                    className={`px-3 py-1.5 rounded-full border mr-2 ${row.kind === k.value ? 'border-soft-gold bg-soft-gold/10' : 'border-white/10'}`}
                                                >
                                                    <Text className={row.kind === k.value ? 'text-soft-gold text-xs' : 'text-gray-400 text-xs'}>{k.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                        <View className="flex-row gap-2">
                                            <TextInput
                                                value={row.quantity}
                                                onChangeText={(v) => updateRow(index, { quantity: v.replace(/[^0-9]/g, '') })}
                                                keyboardType="number-pad"
                                                maxLength={2}
                                                placeholder="Adet"
                                                placeholderTextColor="#6b7280"
                                                className={`${inputClass} w-20`}
                                            />
                                            <TextInput
                                                value={row.due_date}
                                                onChangeText={(v) => updateRow(index, { due_date: v })}
                                                maxLength={10}
                                                placeholder="Teslim (YYYY-AA-GG)"
                                                placeholderTextColor="#6b7280"
                                                className={`${inputClass} flex-1`}
                                            />
                                        </View>
                                        <TextInput
                                            value={row.note}
                                            onChangeText={(v) => updateRow(index, { note: v })}
                                            maxLength={AGREEMENT_LIMITS.deliverableNoteMax}
                                            placeholder="Kısa not (isteğe bağlı)"
                                            placeholderTextColor="#6b7280"
                                            className={`${inputClass} mt-2`}
                                        />
                                        {!(row.id && lockedIds.has(row.id)) ? (
                                            <TouchableOpacity
                                                onPress={() => setDraft({ ...draft, deliverables: draft.deliverables.filter((_, i) => i !== index) })}
                                                className="mt-2 self-start"
                                            >
                                                <Text className="text-red-300 text-xs">Çıkar</Text>
                                            </TouchableOpacity>
                                        ) : null}
                                    </View>
                                ))}
                                {draft.deliverables.length < AGREEMENT_LIMITS.maxDeliverables ? (
                                    <TouchableOpacity
                                        onPress={() => setDraft({ ...draft, deliverables: [...draft.deliverables, { id: null, kind: 'story', quantity: '1', note: '', due_date: '' }] })}
                                        className="flex-row items-center mb-4"
                                    >
                                        <Plus color="#D4AF37" size={16} />
                                        <Text className="text-soft-gold text-xs font-semibold ml-1">Teslimat ekle</Text>
                                    </TouchableOpacity>
                                ) : null}
                                <TouchableOpacity disabled={busy} onPress={saveAgreement} className="rounded-xl py-3 items-center bg-soft-gold">
                                    {busy ? <ActivityIndicator color="#000" /> : <Text className="font-bold text-black">Kaydet</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    ) : null}
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
