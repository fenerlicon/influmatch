import React, { useState } from 'react';
import { View, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { FileDown, Paperclip, ShieldAlert } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import {
    DISPUTE_NOTE_MAX,
    DISPUTE_PROOF_BUCKET,
    DISPUTE_PROOF_MAX_BYTES,
    DISPUTE_STATUS_TONES,
    PAYMENT_PROGRESS_TONES,
} from '../constants/trust';
import { DELIVERABLE_KIND_LABELS } from '../constants/collaborationWorkspace';
import { Text, Button, Chip, Notice, Sheet, TextField, colors } from './ui';

const formatDate = (value) =>
    value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

/** Ödeme durumu çipi + kısa uyarı (ödeme kartının başında). */
export function PaymentProgress({ trust }) {
    if (!trust || (!trust.enabled && trust.paymentProgress === 'none')) return null;
    return (
        <View style={{ gap: 8 }}>
            {trust.paymentProgress !== 'none' ? (
                <View className="flex-row"><Chip label={trust.paymentProgressLabel} tone={PAYMENT_PROGRESS_TONES[trust.paymentProgress]} dot /></View>
            ) : null}
            {trust.enabled ? (
                <View className="flex-row" style={{ gap: 6 }}>
                    <ShieldAlert size={14} color={colors.gold} />
                    <Text variant="caption" tone="fg2" style={{ flex: 1 }}>{trust.warning}</Text>
                </View>
            ) : null}
        </View>
    );
}

/**
 * Güvenli iş birliği (2026-11-23; web components/trust/CollaborationTrustPanel.tsx ile aynı): hatırlatmalar, bildirimler (anlaşmazlık)
 * ve işlemleri, "Teslim edilmedi" (marka), iş birliği kaydı. Bütün işlemler web sunucusunda (/api/mobile/collaborations/[id]).
 */
export default function CollaborationTrust({ collaborationId, trust, deliverables, isBrand, onChanged, canClaimPayment }) {
    // claim: marka "Ödemeyi yaptım ama onaylanmadı" (dekont zorunlu; 2026-11-24)
    const [sheet, setSheet] = useState(null); // { kind: 'respond'|'resolve'|'escalate'|'nondelivery'|'claim', dispute?, deliverable?, note, file }
    const [busy, setBusy] = useState(false);
    if (!trust?.enabled) return null;

    const post = async (body) => {
        setBusy(true);
        const result = await apiRequest(`collaborations/${collaborationId}`, { method: 'POST', body });
        setBusy(false);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return false;
        }
        Alert.alert('Kaydedildi', result.message || 'Kaydedildi.');
        setSheet(null);
        onChanged?.();
        return true;
    };

    const pickPdf = async () => {
        try {
            const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
            if (picked.canceled || !picked.assets?.[0]) return;
            const asset = picked.assets[0];
            const bytes = await (await fetch(asset.uri)).arrayBuffer();
            if (bytes.byteLength > DISPUTE_PROOF_MAX_BYTES) return Alert.alert('Dosya çok büyük', 'Dosya en fazla 10 MB olabilir.');
            setSheet((s) => ({ ...s, file: { bytes, extension: 'pdf', contentType: 'application/pdf', name: asset.name || 'dekont.pdf' } }));
        } catch (e) {
            Alert.alert('Dosya seçilemedi', e?.message || 'Lütfen tekrar dene.');
        }
    };

    const pickPhoto = async () => {
        try {
            const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.Images, quality: 0.8, base64: true });
            if (picked.canceled || !picked.assets?.[0]?.base64) return;
            const bytes = decode(picked.assets[0].base64);
            if (bytes.byteLength > DISPUTE_PROOF_MAX_BYTES) return Alert.alert('Görsel çok büyük', 'Görsel en fazla 10 MB olabilir.');
            setSheet((s) => ({ ...s, file: { bytes, extension: 'jpg', contentType: 'image/jpeg', name: 'görsel.jpg' } }));
        } catch (e) {
            Alert.alert('Görsel seçilemedi', e?.message || 'Lütfen tekrar dene.');
        }
    };

    const submit = async () => {
        const s = sheet;
        if (s.kind === 'nondelivery') return post({ action: 'report_nondelivery', deliverableId: s.deliverable.id, note: s.note });
        if (s.kind === 'resolve') return post({ action: 'dispute_mark_resolved', disputeId: s.dispute.id, note: s.note });
        if (s.kind === 'escalate') return post({ action: 'dispute_escalate', disputeId: s.dispute.id, note: s.note });
        if (s.kind === 'claim') {
            if (!s.file) return Alert.alert('Dekont gerekli', 'Ödeme dekontunu yükleyin.');
            setBusy(true);
            const upload = await apiRequest(`collaborations/${collaborationId}/dispute-proof`, {
                method: 'POST',
                body: { action: 'claim-upload-url', extension: s.file.extension },
            });
            if (upload.error || !upload.path || !upload.token) {
                setBusy(false);
                return Alert.alert('Dosya yüklenemedi', upload.error || 'Lütfen tekrar dene.');
            }
            const { error } = await supabase.storage.from(DISPUTE_PROOF_BUCKET).uploadToSignedUrl(upload.path, upload.token, s.file.bytes, { contentType: s.file.contentType });
            setBusy(false);
            if (error) return Alert.alert('Dosya yüklenemedi', 'Lütfen tekrar dene.');
            return post({ action: 'claim_payment', proofPath: upload.path, note: s.note });
        }
        // Yanıt: dosya varsa önce imzalı adresle yüklenir (kovaya doğrudan yükleme kapalı).
        let proofPath = null;
        if (s.file) {
            setBusy(true);
            const upload = await apiRequest(`collaborations/${collaborationId}/dispute-proof`, {
                method: 'POST',
                body: { action: 'upload-url', disputeId: s.dispute.id, extension: s.file.extension },
            });
            if (upload.error || !upload.path || !upload.token) {
                setBusy(false);
                return Alert.alert('Dosya yüklenemedi', upload.error || 'Lütfen tekrar dene.');
            }
            const { error } = await supabase.storage.from(DISPUTE_PROOF_BUCKET).uploadToSignedUrl(upload.path, upload.token, s.file.bytes, { contentType: s.file.contentType });
            setBusy(false);
            if (error) return Alert.alert('Dosya yüklenemedi', 'Lütfen tekrar dene.');
            proofPath = upload.path;
        }
        return post({ action: 'dispute_respond', disputeId: s.dispute.id, note: s.note, proofPath });
    };

    const openProof = async (dispute) => {
        const result = await apiRequest(`collaborations/${collaborationId}/dispute-proof`, { method: 'POST', body: { action: 'view', disputeId: dispute.id } });
        if (result.error || !result.url) return Alert.alert('Açılamadı', result.error || 'Lütfen tekrar dene.');
        Linking.openURL(result.url);
    };

    const openRecord = async () => {
        const result = await apiRequest(`collaborations/${collaborationId}/record`, { method: 'POST' });
        if (result.error || !result.url) return Alert.alert('Açılamadı', result.error || 'Lütfen tekrar dene.');
        Linking.openURL(result.url);
    };

    const now = Date.now();
    const nondelivery = isBrand
        ? (deliverables || []).filter((d) => trust.nondeliveryAvailableAt?.[d.id] && now >= new Date(trust.nondeliveryAvailableAt[d.id]).getTime())
        : [];

    return (
        <View style={{ gap: 10 }}>
            {trust.reminderBase && trust.paymentProgress === 'awaiting_brand' ? (
                <Text variant="caption" tone="fg3">Markaya ödeme hatırlatmaları {formatDate(trust.reminderBase)} tarihinden itibaren 0, 3, 7 ve 14. günde gider.</Text>
            ) : null}
            {trust.reminders?.length ? (
                <View style={{ gap: 2 }}>
                    <Text variant="caption" tone="fg3">Gönderilen hatırlatmalar</Text>
                    {trust.reminders.map((r) => (
                        <Text key={`${r.kind}-${r.step}`} variant="caption" tone="fg2">
                            {formatDate(r.sentAt)} · {r.kind === 'payment_brand' ? `Markaya ödeme hatırlatması (${r.step}. gün)` : `Influencer'a teyit hatırlatması (${r.step}. gün)`}
                        </Text>
                    ))}
                </View>
            ) : null}

            {(trust.disputes || []).map((d) => (
                <View key={d.id} className="bg-s2 border border-line rounded-2xl p-3" style={{ gap: 8 }}>
                    <View className="flex-row items-center justify-between" style={{ gap: 8 }}>
                        <Text weight="semibold" style={{ flex: 1 }}>{d.kindLabel}</Text>
                        <Chip label={d.statusLabel} tone={DISPUTE_STATUS_TONES[d.status] || 'neutral'} dot />
                    </View>
                    <Text variant="caption" tone="fg2">Bildirim: {formatDate(d.openedAt)}{d.status === 'open' ? ` · yanıt süresi ${formatDate(d.responseDueAt)}` : ''}</Text>
                    {d.reporterNote ? <Text variant="caption" tone="fg2">Not: {d.reporterNote}</Text> : null}
                    {d.responseNote ? <Text variant="caption" tone="fg2">Yanıt: {d.responseNote}</Text> : null}
                    {d.decisionNote ? <Text variant="caption" tone="fg2">Karar: {d.decisionNote}</Text> : null}
                    {d.kind === 'payment_unconfirmed' && !d.viewerIsReporter && ['escalated', 'open', 'responded'].includes(d.status) ? (
                        <Notice tone="warning" text={'Marka ödemeyi yaptığını dekontla bildirdi. Ödeme geldiyse "Ödeme alındı" ile teyit et; gelmediyse açıklamanı yaz. Kararı destek ekibi verir.'} />
                    ) : null}
                    {d.status === 'open' && !d.viewerIsReporter ? (
                        <Notice
                            tone="warning"
                            text={`${formatDate(d.responseDueAt)} tarihine kadar ${d.kind === 'nonpayment' ? 'ödeme dekontunu' : 'teslim kanıtını'} yükle ya da durumu açıkla. Yanıt verilmezse hesabın incelemeye alınır.`}
                        />
                    ) : null}
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {d.hasProof ? <Button title="Kanıtı aç" icon={Paperclip} variant="ghost" size="sm" onPress={() => openProof(d)} /> : null}
                        {d.actions.includes('respond') ? (
                            <Button title={d.kind === 'payment_unconfirmed' ? 'Açıklama yaz' : d.kind === 'nonpayment' ? 'Dekont yükle / yanıtla' : 'Kanıt yükle / yanıtla'} size="sm" disabled={busy} onPress={() => setSheet({ kind: 'respond', dispute: d, note: '', file: null })} />
                        ) : null}
                        {d.actions.includes('mark_resolved') ? (
                            <Button title={d.kind === 'nonpayment' ? 'Ödendi, çözüldü' : 'Teslim edildi, çözüldü'} variant="secondary" size="sm" disabled={busy} onPress={() => setSheet({ kind: 'resolve', dispute: d, note: '' })} />
                        ) : null}
                        {d.actions.includes('confirm_resolved') ? (
                            <Button title={d.kind === 'nonpayment' ? 'Ödemeyi aldım, çözüldü' : 'Teslim aldım, çözüldü'} size="sm" disabled={busy} onPress={() => post({ action: 'dispute_confirm_resolved', disputeId: d.id })} />
                        ) : null}
                        {d.actions.includes('escalate') ? (
                            <Button title="Destek ekibine taşı" variant="danger" size="sm" disabled={busy} onPress={() => setSheet({ kind: 'escalate', dispute: d, note: '' })} />
                        ) : null}
                    </View>
                </View>
            ))}

            {nondelivery.map((d) => (
                <Button key={d.id} title={`Teslim edilmedi: ${DELIVERABLE_KIND_LABELS[d.kind] || 'Teslimat'} ×${d.quantity}`} variant="danger" size="sm" disabled={busy} onPress={() => setSheet({ kind: 'nondelivery', deliverable: d, note: '' })} />
            ))}

            {canClaimPayment ? (
                <Button title="Ödemeyi yaptım ama onaylanmadı" variant="secondary" size="sm" disabled={busy} onPress={() => setSheet({ kind: 'claim', note: '', file: null })} />
            ) : null}

            <Button title="İş birliği kaydını indir" icon={FileDown} variant="ghost" size="sm" onPress={openRecord} />
            <Text variant="caption" tone="fg3">Anlaşma, teslimatlar, ödeme işaretleri, olaylar ve sohbet; yazdırılabilir sayfa (bağlantı 10 dakika geçerli).</Text>

            <Sheet
                visible={!!sheet}
                onClose={() => (busy ? null : setSheet(null))}
                title={sheet?.kind === 'claim' ? 'Ödeme teyit edilmedi' : sheet?.kind === 'nondelivery' ? 'Teslim edilmedi' : sheet?.kind === 'resolve' ? 'Çözüldü olarak bildir' : sheet?.kind === 'escalate' ? 'Destek ekibine taşı' : 'Yanıt ver'}
            >
                {sheet ? (
                    <>
                        {sheet.kind === 'claim' ? (
                            <Notice tone="info" text="Dekontun destek ekibine iletilir, influencer da bilgilendirilir. Ödeme doğrulanırsa teslim dosyalarının indirilmesi açılır." />
                        ) : null}
                        {sheet.kind === 'nondelivery' ? (
                            <Notice tone="info" text="Influencer'a bildirilir; 7 gün içinde kanıt ya da yanıt vermezse hesabı incelemeye alınır, kararı destek ekibi verir." />
                        ) : null}
                        <TextField
                            label={sheet.kind === 'respond' ? 'Açıklama (dosya yoksa en az 10 karakter)' : 'Not (isteğe bağlı)'}
                            value={sheet.note}
                            onChangeText={(note) => setSheet({ ...sheet, note })}
                            multiline
                            height={96}
                            maxLength={sheet.kind === 'respond' ? DISPUTE_NOTE_MAX : 500}
                        />
                        {(sheet.kind === 'respond' && sheet.dispute?.kind !== 'payment_unconfirmed') || sheet.kind === 'claim' ? (
                            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                                <Button title="PDF seç" variant="secondary" size="sm" onPress={pickPdf} />
                                <Button title="Görsel seç" variant="secondary" size="sm" onPress={pickPhoto} />
                                {sheet.file ? <Text variant="caption" tone="fg2">{sheet.file.name}</Text> : null}
                            </View>
                        ) : null}
                        <Button title="Gönder" variant={sheet.kind === 'escalate' || sheet.kind === 'nondelivery' ? 'danger' : 'primary'} onPress={submit} loading={busy} disabled={busy} block />
                    </>
                ) : null}
            </Sheet>
        </View>
    );
}
