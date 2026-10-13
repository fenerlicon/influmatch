import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Alert, Linking, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    MessageCircle, Clock, Check, CircleDashed, RotateCcw, Send, Globe, Plus, ExternalLink, History, TriangleAlert,
} from 'lucide-react-native';
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
import {
    Screen, StackHeader, BottomBar, Section, Text, Button, IconButton, Card, ListGroup, IconBox, KeyValue, Avatar,
    Chip, Segment, FilterChip, ChipRow, Timeline, Notice, EmptyState, Sheet, TextField, colors, ICON_STROKE,
} from '../components/ui';

// İş birliği takip alanı: anlaşma özeti, teslimatlar (taslak / revize / yayın) ve ödeme teyidi (design/mobile/ortak.html).
// Web'deki /dashboard/collaborations/[id] ile aynı akış; bütün işlemler /api/mobile/collaborations/[id] üzerinden
// web'in sunucu kodundan geçer (lib/collaboration-workspace.ts). Taslak bugün yalnızca link (dosya yükleme R2 ile gelecek).

const COLLAB_STATUS = {
    agreed: { label: 'Anlaşıldı', tone: 'info', stage: 1 },
    in_progress: { label: 'İçerik hazırlanıyor', tone: 'warning', stage: 2 },
    published: { label: 'Yayında, onay bekliyor', tone: 'gold', stage: 3 },
    completed: { label: 'Tamamlandı', tone: 'success', stage: 5 },
    cancelled: { label: 'İptal edildi', tone: 'danger', stage: 0 },
};

// Teslimat durumu → satır simgesi (etiketler web ile ortak sabitten)
const DELIVERABLE_LOOK = {
    pending: { icon: CircleDashed, tone: 'neutral' },
    draft_submitted: { icon: Send, tone: 'info' },
    revision_requested: { icon: RotateCcw, tone: 'warning' },
    approved: { icon: Check, tone: 'success' },
    published: { icon: Globe, tone: 'gold' },
};

const formatDate = (value) =>
    value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const formatDateTime = (value) =>
    value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const today = () => new Date().toISOString().slice(0, 10);
const nameOf = (p) => p?.full_name || (p?.username ? `@${p.username}` : 'Kullanıcı');
const kindLabel = (d) => `${DELIVERABLE_KIND_LABELS[d.kind] || 'Teslimat'} ×${d.quantity}`;

const SHEET_TITLES = {
    submit_draft: 'Taslak gönder',
    request_revision: 'Revize iste',
    publish_deliverable: 'Yayın linki',
    collab_publish: 'Yayın linki',
    mark_paid: 'Ödeme yapıldı',
    confirm_payment: 'Ödeme alındı',
    report_nonpayment: 'Ödeme alamadım',
    cancel: 'İş birliğini iptal et',
};

function LinkLine({ label, url }) {
    if (!url) return null;
    return (
        <Pressable onPress={() => Linking.openURL(url).catch(() => null)} accessibilityRole="link" className="flex-row items-center" style={{ gap: 6 }}>
            <ExternalLink size={14} color={colors.gold} strokeWidth={ICON_STROKE} />
            <Text variant="small" tone="fg3">{label}</Text>
            <Text variant="small" tone="gold" numberOfLines={1} style={{ flex: 1 }}>{url}</Text>
        </Pressable>
    );
}

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
        if (!id) { setError('İş birliği bulunamadı.'); setLoading(false); return; }
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

    // İş birliği düzeyindeki işlemler (lib/collaborations.ts): approve | start | publish | cancel | open_room
    const runCollab = async (action, extra = {}) => {
        setBusy(true);
        const result = await apiRequest('collaborations', { method: 'POST', body: { id, action, ...extra } });
        setBusy(false);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return null;
        }
        setSheet(null);
        await load();
        return result;
    };

    const collab = ws?.collaboration;
    const agreement = ws?.agreement;
    const deliverables = ws?.deliverables || [];
    const payment = ws?.payment;
    const perms = ws?.permissions || {};
    const isBrand = collab?.viewer_role === 'brand';
    const collabActions = collab?.actions || [];
    const lockedIds = new Set(deliverables.filter((d) => d.status !== 'pending' || d.draft_submitted_at || d.revisions_used > 0).map((d) => d.id));

    // Sohbet: oda varsa doğrudan, yoksa sunucu açar (teklif/başvuru sohbetiyle aynı kural)
    const goToChat = (roomId) => navigation.navigate(isBrand ? 'BrandDashboard' : 'Dashboard', {
        screen: 'Mesajlar',
        params: { openRoomId: roomId, partnerName: nameOf(collab?.other), partnerAvatar: collab?.other?.avatar_url },
    });
    const openChat = async () => {
        if (collab?.room_id) { goToChat(collab.room_id); return; }
        const result = await runCollab('open_room');
        if (result?.roomId) goToChat(result.roomId);
    };

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
        else if (s.kind === 'collab_publish') runCollab('publish', { url: s.url.trim() });
        else if (s.kind === 'cancel') runCollab('cancel', { reason: s.note.trim() });
    };

    const confirmApprove = () =>
        Alert.alert('İş birliğini onayla', 'Yayın linklerini kontrol ettiyseniz iş birliği tamamlanacak.', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Onayla', onPress: () => runCollab('approve') },
        ]);

    if (loading) {
        return (
            <Screen header={<StackHeader title="İş birliği" onBack={() => navigation.goBack()} />}>
                <View className="py-16"><ActivityIndicator color={colors.gold} /></View>
            </Screen>
        );
    }

    if (error || !collab) {
        return (
            <Screen header={<StackHeader title="İş birliği" onBack={() => navigation.goBack()} />}>
                <EmptyState icon={TriangleAlert} title="Açılamadı" text={error || 'İş birliği bulunamadı.'} />
            </Screen>
        );
    }

    const status = COLLAB_STATUS[collab.status] || COLLAB_STATUS.agreed;
    const revisionLimit = agreement?.revision_limit ?? 0;
    const publishedCount = deliverables.filter((d) => d.status === 'published').length;

    // Sıradaki adım ve ekrandaki tek altın eylem (sunucunun izin verdiği işlemlerden, önem sırasıyla)
    const next = (() => {
        if (collabActions.includes('approve')) return { key: 'approve', label: 'Onayla ve tamamla', hint: 'yayını kontrol edip onayla', onPress: confirmApprove };
        if (perms.canConfirmAgreement) {
            return { key: 'confirm_agreement', label: 'Anlaşma özetini onayla', hint: 'anlaşma özetini onayla', onPress: () => run({ action: 'confirm_agreement', version: agreement.version }) };
        }
        if (!agreement && perms.canEditAgreement) return { key: 'edit_agreement', label: 'Anlaşma özeti hazırla', hint: 'anlaşma özetini hazırla', onPress: startEditing };
        const review = deliverables.find((d) => d.actions.includes('approve_draft'));
        if (review) return { key: null, hint: `${kindLabel(review)} taslağını incele` };
        const toSubmit = deliverables.find((d) => d.actions.includes('submit_draft'));
        if (toSubmit) {
            return {
                key: `submit_draft:${toSubmit.id}`,
                label: toSubmit.status === 'pending' ? 'Taslak gönder' : 'Yeni taslak gönder',
                hint: `${kindLabel(toSubmit)} taslağını gönder${toSubmit.due_date ? ` · son tarih ${formatDate(toSubmit.due_date)}` : ''}`,
                onPress: () => openSheet('submit_draft', toSubmit),
            };
        }
        const toPublish = deliverables.find((d) => d.actions.includes('publish_deliverable'));
        if (toPublish) {
            return { key: `publish_deliverable:${toPublish.id}`, label: 'Yayın linkini gir', hint: `${kindLabel(toPublish)} yayın linkini gir`, onPress: () => openSheet('publish_deliverable', toPublish) };
        }
        if (collabActions.includes('publish')) return { key: 'collab_publish', label: 'Yayın linkini gir', hint: 'yayın linkini gir', onPress: () => openSheet('collab_publish') };
        if (collabActions.includes('start')) return { key: 'start', label: 'İçerik hazırlanıyor', hint: 'içerik hazırlığına başladığını bildir', onPress: () => runCollab('start') };
        if (perms.canMarkPaid && !payment?.brand_paid_at) return { key: 'mark_paid', label: 'Ödeme yapıldı', hint: 'ödemeyi yaptığını işaretle', onPress: () => openSheet('mark_paid') };
        if (perms.canConfirmPayment && !payment?.influencer_received_at) return { key: 'confirm_payment', label: 'Ödemeyi aldım', hint: 'ödemeyi aldığını onayla', onPress: () => openSheet('confirm_payment') };
        return null;
    })();
    const isPrimary = (key) => next?.key && next.key === key;

    const sheetSubmitDisabled = busy || (sheet && (
        (['submit_draft', 'publish_deliverable', 'collab_publish'].includes(sheet.kind) && !sheet.url.trim())
        || (sheet.kind === 'request_revision' && !sheet.note.trim())
    ));

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={
                <StackHeader
                    title="İş birliği"
                    onBack={() => navigation.goBack()}
                    right={collab.room_id || collabActions.includes('open_room')
                        ? <IconButton icon={MessageCircle} onPress={openChat} accessibilityLabel="Sohbet" />
                        : null}
                />
            }
            footer={next?.label ? (
                <BottomBar>
                    <View className="flex-1"><Button title={next.label} onPress={next.onPress} loading={busy} block /></View>
                </BottomBar>
            ) : null}
        >
            {/* Başlık */}
            <View style={{ gap: 6 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Avatar name={nameOf(collab.other)} uri={collab.other?.avatar_url} square />
                    <View className="flex-1 min-w-0">
                        <Text weight="semibold" style={{ fontSize: 18, lineHeight: 23 }} numberOfLines={2}>{collab.title}</Text>
                        <Text variant="small" tone="fg2" numberOfLines={1}>
                            {nameOf(collab.other)} · {collab.source === 'offer' ? 'Teklif' : 'İlan başvurusu'} · {formatDate(collab.created_at)}
                        </Text>
                    </View>
                </View>
                {!isBrand ? (
                    <Text variant="caption" tone="fg3">
                        Marka geçmişi: {reliabilityText(ws.brandReliability.completed, ws.brandReliability.confirmed)}
                    </Text>
                ) : null}
            </View>

            {/* Aşama ve sıradaki adım */}
            <Card style={{ gap: 12 }}>
                {collab.status === 'cancelled' ? (
                    <View style={{ gap: 6 }}>
                        <Chip label={status.label} tone={status.tone} dot />
                        {collab.cancel_reason ? <Text variant="small" tone="fg2">Neden: {collab.cancel_reason}</Text> : null}
                    </View>
                ) : (
                    <Timeline stage={status.stage} />
                )}
                {next?.hint ? (
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Clock size={16} color={colors.gold} strokeWidth={ICON_STROKE} />
                        <Text variant="small" style={{ flex: 1 }}>
                            Sıradaki: <Text variant="small" weight="semibold">{next.hint}</Text>
                        </Text>
                    </View>
                ) : null}
                {collab.auto_complete_at ? (
                    <Text variant="caption" tone="fg3">
                        {isBrand
                            ? `Onaylamazsanız ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır.`
                            : `Marka yanıt vermezse ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır.`}
                    </Text>
                ) : null}
                {collab.publish_url ? <LinkLine label="Yayın" url={collab.publish_url} /> : null}
            </Card>

            {/* Anlaşma özeti */}
            <Section title="Anlaşma özeti">
                {agreement ? (
                    <Card style={{ gap: 10 }}>
                        <Chip label={ws.agreementConfirmed ? 'İki taraf onayladı' : 'Onay bekliyor'} tone={ws.agreementConfirmed ? 'success' : 'warning'} dot />
                        <View>
                            <KeyValue label="Ücret" value={`${formatTryAmount(agreement.fee_amount)} · ${PAYMENT_TYPE_LABELS[agreement.payment_type] || ''}`} />
                            <KeyValue label="Revize hakkı" value={String(agreement.revision_limit)} />
                            <KeyValue label="Kullanım hakkı" value={agreement.usage_rights || '—'} />
                            <KeyValue label="Marka onayı" value={agreement.brand_confirmed_at ? formatDateTime(agreement.brand_confirmed_at) : 'Bekleniyor'} valueTone={agreement.brand_confirmed_at ? undefined : 'fg3'} />
                            <KeyValue label="Influencer onayı" value={agreement.influencer_confirmed_at ? formatDateTime(agreement.influencer_confirmed_at) : 'Bekleniyor'} valueTone={agreement.influencer_confirmed_at ? undefined : 'fg3'} last />
                        </View>
                        <Text variant="caption" tone="fg3">{AGREEMENT_SUMMARY_NOTE}</Text>
                        {(perms.canConfirmAgreement && !isPrimary('confirm_agreement')) || perms.canEditAgreement ? (
                            <View className="flex-row" style={{ gap: 8 }}>
                                {perms.canConfirmAgreement && !isPrimary('confirm_agreement') ? (
                                    <Button title="Özeti onayla" variant="secondary" size="md" disabled={busy} onPress={() => run({ action: 'confirm_agreement', version: agreement.version })} />
                                ) : null}
                                {perms.canEditAgreement ? <Button title="Düzenle" variant="secondary" size="md" disabled={busy} onPress={startEditing} /> : null}
                            </View>
                        ) : null}
                    </Card>
                ) : (
                    <Card style={{ gap: 10 }}>
                        <Text variant="small" tone="fg2">
                            Henüz anlaşma özeti yok. Teslimatları, ücreti, tarihleri, kullanım hakkını ve revize sayısını bir taraf yazar, diğeri onaylar.
                        </Text>
                        {perms.canEditAgreement && !isPrimary('edit_agreement') ? (
                            <Button title="Anlaşma özeti hazırla" variant="secondary" size="md" onPress={startEditing} />
                        ) : null}
                    </Card>
                )}
            </Section>

            {/* Teslimatlar */}
            {deliverables.length > 0 ? (
                <Section title="Teslimatlar" action={`${publishedCount} / ${deliverables.length}`}>
                    {!ws.agreementConfirmed && ['agreed', 'in_progress'].includes(collab.status) ? (
                        <Notice tone="info" text="Teslimatlar, anlaşma özeti iki tarafça onaylanınca başlar." />
                    ) : null}
                    <ListGroup>
                        {deliverables.map((d) => {
                            const st = DELIVERABLE_STATUS[d.status] || DELIVERABLE_STATUS.pending;
                            const look = DELIVERABLE_LOOK[d.status] || DELIVERABLE_LOOK.pending;
                            const inline = [
                                d.actions.includes('submit_draft') && !isPrimary(`submit_draft:${d.id}`)
                                    ? { key: 'submit', title: d.status === 'pending' ? 'Taslak gönder' : 'Yeni taslak', onPress: () => openSheet('submit_draft', d) } : null,
                                d.actions.includes('approve_draft')
                                    ? { key: 'approve', title: 'Taslağı onayla', onPress: () => run({ action: 'approve_draft', deliverableId: d.id }) } : null,
                                d.actions.includes('request_revision')
                                    ? { key: 'revise', title: 'Revize iste', onPress: () => openSheet('request_revision', d) } : null,
                                d.actions.includes('publish_deliverable') && !isPrimary(`publish_deliverable:${d.id}`)
                                    ? { key: 'publish', title: 'Yayın linki', onPress: () => openSheet('publish_deliverable', d) } : null,
                            ].filter(Boolean);
                            const subtitle = d.status === 'revision_requested' && d.review_note
                                ? `${st.label}: "${d.review_note}"`
                                : [st.label, d.due_date ? `teslim ${formatDate(d.due_date)}` : null].filter(Boolean).join(' · ');
                            return (
                                <View key={d.id} className="px-3.5 py-3" style={{ gap: 10 }}>
                                    <View className="flex-row items-center" style={{ gap: 12 }}>
                                        <IconBox icon={look.icon} tone={look.tone} />
                                        <View className="flex-1 min-w-0">
                                            <Text weight="medium">{kindLabel(d)}</Text>
                                            <Text variant="small" tone="fg2" numberOfLines={2}>{subtitle}</Text>
                                        </View>
                                    </View>
                                    {d.note ? <Text variant="small" tone="fg3">{d.note}</Text> : null}
                                    <Text variant="caption" tone="fg3">{revisionUsageText(d.revisions_used, revisionLimit)}</Text>
                                    {d.draft_url ? (
                                        <View style={{ gap: 2 }}>
                                            <LinkLine label="Son taslak" url={d.draft_url} />
                                            {d.draft_note ? <Text variant="small" tone="fg2">{d.draft_note}</Text> : null}
                                        </View>
                                    ) : null}
                                    <LinkLine label="Yayın" url={d.publish_url} />
                                    {isBrand && d.status === 'draft_submitted' && d.revisions_used >= revisionLimit ? (
                                        <Text variant="caption" tone="fg3">Revize hakkı doldu.</Text>
                                    ) : null}
                                    {inline.length || d.submissions?.length ? (
                                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                            {inline.map((a) => (
                                                <Button key={a.key} title={a.title} variant="secondary" size="sm" disabled={busy} onPress={a.onPress} />
                                            ))}
                                            {d.submissions?.length ? (
                                                <Button
                                                    title={`Geçmiş (${d.submissions.length})`} icon={History} variant="ghost" size="sm"
                                                    onPress={() => setHistoryOpen((h) => ({ ...h, [d.id]: !h[d.id] }))}
                                                />
                                            ) : null}
                                        </View>
                                    ) : null}
                                    {historyOpen[d.id] ? (
                                        <View className="border-l border-line-strong pl-3" style={{ gap: 10 }}>
                                            {d.submissions.map((s) => (
                                                <View key={s.id} style={{ gap: 2 }}>
                                                    <Text variant="caption" tone="fg2">{formatDateTime(s.created_at)}</Text>
                                                    <LinkLine label="Taslak" url={s.url} />
                                                    {s.note ? <Text variant="small" tone="fg2">{s.note}</Text> : null}
                                                    {s.review === 'approved' ? <Text variant="caption" tone="success">Onaylandı</Text> : null}
                                                    {s.review === 'revision_requested' ? <Text variant="caption" tone="warning">Revize: {s.review_note}</Text> : null}
                                                </View>
                                            ))}
                                        </View>
                                    ) : null}
                                </View>
                            );
                        })}
                    </ListGroup>
                </Section>
            ) : null}

            {/* Ödeme: platform dışında yapılır; uygulama yalnızca iki tarafın onayını kaydeder */}
            <Section title="Ödeme">
                <Card style={{ gap: 12 }}>
                    {agreement ? (
                        <View className="flex-row items-baseline justify-between">
                            <Text tone="fg2">Anlaşılan ücret</Text>
                            <Text weight="semibold" style={{ fontSize: 18 }}>{formatTryAmount(agreement.fee_amount)}</Text>
                        </View>
                    ) : null}
                    <View className="bg-s2 border border-line rounded-[14px] overflow-hidden">
                        <View className="flex-row items-center px-3 py-2.5 border-b border-line" style={{ gap: 12 }}>
                            <IconBox icon={payment?.brand_paid_at ? Check : CircleDashed} tone={payment?.brand_paid_at ? 'success' : 'neutral'} size={32} />
                            <View className="flex-1 min-w-0">
                                <Text variant="small" weight="medium" style={{ fontSize: 14 }}>{isBrand ? 'Ödemeyi yaptın' : 'Marka ödemeyi yaptı'}</Text>
                                <Text variant="caption" tone="fg3">
                                    {payment?.brand_paid_at ? formatDate(payment.brand_paid_date || payment.brand_paid_at) : 'İşaretlenmedi'}
                                    {payment?.brand_note ? ` · ${payment.brand_note}` : ''}
                                </Text>
                            </View>
                        </View>
                        <View className="flex-row items-center px-3 py-2.5" style={{ gap: 12 }}>
                            <IconBox icon={payment?.influencer_received_at ? Check : CircleDashed} tone={payment?.influencer_received_at ? 'success' : 'neutral'} size={32} />
                            <View className="flex-1 min-w-0">
                                <Text variant="small" weight="medium" style={{ fontSize: 14 }}>{isBrand ? 'Influencer aldığını onayladı' : 'Aldığını onayla'}</Text>
                                <Text variant="caption" tone="fg3">
                                    {payment?.influencer_received_at ? formatDate(payment.influencer_received_date || payment.influencer_received_at) : 'Onaylanmadı'}
                                    {payment?.influencer_note ? ` · ${payment.influencer_note}` : ''}
                                </Text>
                            </View>
                        </View>
                    </View>
                    {payment?.nonpayment_reported_at ? (
                        <Notice tone="warning" text={`Ödeme alınamadı bildirimi ${formatDate(payment.nonpayment_reported_at)} tarihinde destek ekibine iletildi.`} />
                    ) : null}
                    {(() => {
                        const buttons = [
                            perms.canMarkPaid && !isPrimary('mark_paid')
                                ? { key: 'mark', title: payment?.brand_paid_at ? 'Ödeme bilgisini güncelle' : 'Ödeme yapıldı', onPress: () => openSheet('mark_paid') } : null,
                            perms.canUnmarkPaid ? { key: 'unmark', title: 'İşareti kaldır', onPress: () => run({ action: 'unmark_paid' }) } : null,
                            perms.canConfirmPayment && !isPrimary('confirm_payment')
                                ? { key: 'confirm', title: payment?.influencer_received_at ? 'Ödeme bilgisini güncelle' : 'Ödemeyi aldım', onPress: () => openSheet('confirm_payment') } : null,
                            perms.canUnconfirmPayment ? { key: 'unconfirm', title: 'Teyidi kaldır', onPress: () => run({ action: 'unconfirm_payment' }) } : null,
                        ].filter(Boolean);
                        return buttons.length ? (
                            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                {buttons.map((b) => <Button key={b.key} title={b.title} variant="secondary" size="sm" disabled={busy} onPress={b.onPress} />)}
                            </View>
                        ) : null;
                    })()}
                    {perms.canReportNonpayment ? (
                        <Button title="Ödeme alamadım" variant="danger" size="sm" disabled={busy} onPress={() => openSheet('report_nonpayment')} />
                    ) : null}
                    {!perms.canReportNonpayment && perms.nonpaymentAvailableAt && !payment?.nonpayment_reported_at ? (
                        <Text variant="caption" tone="fg3">
                            Ödemeyi alamazsanız {formatDate(perms.nonpaymentAvailableAt)} tarihinden sonra buradan destek ekibine bildirebilirsiniz.
                        </Text>
                    ) : null}
                </Card>
            </Section>

            {collabActions.includes('cancel') ? (
                <Text variant="small" tone="fg3" style={{ textAlign: 'center', paddingVertical: 4 }} onPress={() => openSheet('cancel')} suppressHighlighting>
                    İş birliğini iptal et
                </Text>
            ) : null}

            {/* İşlem formu */}
            <Sheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet ? (sheet.deliverable ? `${kindLabel(sheet.deliverable)} — ${SHEET_TITLES[sheet.kind]}` : SHEET_TITLES[sheet.kind]) : ''}>
                {sheet ? (
                    <>
                        {['submit_draft', 'publish_deliverable', 'collab_publish'].includes(sheet.kind) ? (
                            <TextField
                                label={sheet.kind === 'submit_draft' ? 'Taslak bağlantısı' : 'Yayın bağlantısı'}
                                hint={sheet.kind === 'submit_draft' ? 'Drive, WeTransfer veya önizleme bağlantısı.' : 'Instagram, TikTok veya YouTube bağlantısı.'}
                                icon={Globe}
                                value={sheet.url}
                                onChangeText={(url) => setSheet({ ...sheet, url })}
                                placeholder="https://..."
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="url"
                                maxLength={500}
                            />
                        ) : null}
                        {sheet.kind === 'mark_paid' || sheet.kind === 'confirm_payment' ? (
                            <TextField
                                label="Ödeme tarihi"
                                hint="YYYY-AA-GG"
                                value={sheet.date}
                                onChangeText={(date) => setSheet({ ...sheet, date })}
                                placeholder="2026-10-10"
                                maxLength={10}
                            />
                        ) : null}
                        {sheet.kind !== 'publish_deliverable' && sheet.kind !== 'collab_publish' ? (
                            <TextField
                                label={sheet.kind === 'request_revision' ? 'Ne değişmeli?' : sheet.kind === 'cancel' ? 'İptal nedeni (isteğe bağlı)' : 'Not (isteğe bağlı)'}
                                value={sheet.note}
                                onChangeText={(note) => setSheet({ ...sheet, note })}
                                multiline
                                height={88}
                                maxLength={sheet.kind === 'mark_paid' || sheet.kind === 'confirm_payment' ? AGREEMENT_LIMITS.paymentNoteMax : AGREEMENT_LIMITS.draftNoteMax}
                            />
                        ) : null}
                        {sheet.kind === 'request_revision' ? (
                            <Notice tone="warning" icon={RotateCcw} text={`Bu istekle ${revisionUsageText(sheet.deliverable.revisions_used + 1, revisionLimit)}.`} />
                        ) : null}
                        {sheet.kind === 'submit_draft' && sheet.deliverable.status === 'revision_requested' ? (
                            <Notice tone="warning" icon={RotateCcw} text={revisionUsageText(sheet.deliverable.revisions_used, revisionLimit)} />
                        ) : null}
                        {sheet.kind === 'report_nonpayment' ? (
                            <Notice tone="info" text="Bildiriminiz destek ekibine iletilir ve markaya haber verilir." />
                        ) : null}
                        {sheet.kind === 'cancel' ? (
                            <Notice tone="danger" text="İptal edilen iş birliği geri alınamaz; karşı tarafa bildirim gider." />
                        ) : null}
                        <Button
                            title={sheet.kind === 'cancel' ? 'İptal et' : 'Gönder'}
                            variant={sheet.kind === 'report_nonpayment' || sheet.kind === 'cancel' ? 'danger' : 'primary'}
                            onPress={submitSheet}
                            loading={busy}
                            disabled={sheetSubmitDisabled}
                            block
                        />
                    </>
                ) : null}
            </Sheet>

            {/* Anlaşma özeti düzenleme */}
            <Sheet visible={!!draft} onClose={() => setDraft(null)} title="Anlaşma özeti" scroll>
                {draft ? (
                    <>
                        {ws?.agreementConfirmed ? (
                            <Notice tone="warning" text="Kaydettiğinizde iki onay da sıfırlanır; kaydınız yeni hali onayınız sayılır, karşı taraf yeniden onaylar." />
                        ) : null}
                        <View style={{ gap: 7 }}>
                            <Text variant="small" weight="medium" tone="fg2">Ödeme türü</Text>
                            <Segment
                                options={Object.keys(PAYMENT_TYPE_LABELS).map((t) => ({ key: t, label: PAYMENT_TYPE_LABELS[t] }))}
                                value={draft.payment_type}
                                onChange={(t) => setDraft({ ...draft, payment_type: t })}
                            />
                        </View>
                        <TextField
                            label={`Anlaşılan ücret${draft.payment_type === 'barter' ? ' (isteğe bağlı)' : ''}`}
                            prefix="₺"
                            value={draft.fee_amount}
                            onChangeText={(v) => setDraft({ ...draft, fee_amount: v.replace(/[^0-9]/g, '') })}
                            keyboardType="number-pad"
                            maxLength={8}
                        />
                        <TextField
                            label={`Revize sayısı (0–${AGREEMENT_LIMITS.maxRevisions})`}
                            value={draft.revision_limit}
                            onChangeText={(v) => setDraft({ ...draft, revision_limit: v.replace(/[^0-9]/g, '') })}
                            keyboardType="number-pad"
                            maxLength={2}
                        />
                        <TextField
                            label="Kullanım hakkı (kısa)"
                            value={draft.usage_rights}
                            onChangeText={(v) => setDraft({ ...draft, usage_rights: v })}
                            multiline
                            height={76}
                            maxLength={AGREEMENT_LIMITS.usageRightsMax}
                        />
                        <Text variant="small" weight="medium" tone="fg2">Teslimatlar</Text>
                        {draft.deliverables.map((row, index) => (
                            <View key={row.id || `new-${index}`} className="bg-s2 border border-line rounded-2xl p-3" style={{ gap: 10 }}>
                                <ChipRow>
                                    {DELIVERABLE_KINDS.map((k) => (
                                        <FilterChip key={k.value} label={k.label} selected={row.kind === k.value} onPress={() => updateRow(index, { kind: k.value })} />
                                    ))}
                                </ChipRow>
                                <View className="flex-row" style={{ gap: 8 }}>
                                    <View style={{ width: 88 }}>
                                        <TextField
                                            label="Adet"
                                            value={row.quantity}
                                            onChangeText={(v) => updateRow(index, { quantity: v.replace(/[^0-9]/g, '') })}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <TextField
                                            label="Teslim tarihi"
                                            value={row.due_date}
                                            onChangeText={(v) => updateRow(index, { due_date: v })}
                                            maxLength={10}
                                            placeholder="YYYY-AA-GG"
                                        />
                                    </View>
                                </View>
                                <TextField
                                    value={row.note}
                                    onChangeText={(v) => updateRow(index, { note: v })}
                                    maxLength={AGREEMENT_LIMITS.deliverableNoteMax}
                                    placeholder="Kısa not (isteğe bağlı)"
                                />
                                {!(row.id && lockedIds.has(row.id)) ? (
                                    <Text
                                        variant="small" tone="danger"
                                        onPress={() => setDraft({ ...draft, deliverables: draft.deliverables.filter((_, i) => i !== index) })}
                                        suppressHighlighting
                                    >
                                        Çıkar
                                    </Text>
                                ) : null}
                            </View>
                        ))}
                        {draft.deliverables.length < AGREEMENT_LIMITS.maxDeliverables ? (
                            <Button
                                title="Teslimat ekle" icon={Plus} variant="ghost" size="md"
                                onPress={() => setDraft({ ...draft, deliverables: [...draft.deliverables, { id: null, kind: 'story', quantity: '1', note: '', due_date: '' }] })}
                            />
                        ) : null}
                        <Button title="Kaydet" onPress={saveAgreement} loading={busy} block />
                    </>
                ) : null}
            </Sheet>
        </Screen>
    );
}
