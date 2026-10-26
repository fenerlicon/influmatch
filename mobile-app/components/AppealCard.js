import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { MessageSquareWarning, Paperclip, FileText, Image as ImageIcon, X } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { APPEAL_TEXT_MAX, APPEAL_FILES_BUCKET, APPEAL_FILE_MAX_BYTES, APPEAL_STATUS_TONES } from '../constants/moderation';
import { Text, Button, Chip, TextField, colors } from './ui';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/**
 * Ret nedeni + itiraz (2026-10-26). Web components/appeals/AppealBox.tsx ile aynı: karar başına bir itiraz,
 * isteğe bağlı tek ek (PDF ya da görsel). Kurallar sunucuda (/api/mobile/appeals, lib/moderation.ts).
 */
export default function AppealCard({ decision, showReason = true, onDone }) {
    const [appeal, setAppeal] = useState(decision?.appeal || null);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [file, setFile] = useState(null); // { bytes, extension, contentType, name }
    const [busy, setBusy] = useState(false);

    if (!decision) return null;

    const pickPdf = async () => {
        try {
            const picked = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
            if (picked.canceled || !picked.assets?.[0]) return;
            const asset = picked.assets[0];
            const bytes = await (await fetch(asset.uri)).arrayBuffer();
            if (bytes.byteLength > APPEAL_FILE_MAX_BYTES) return Alert.alert('Dosya çok büyük', 'Dosya en fazla 5 MB olabilir.');
            setFile({ bytes, extension: 'pdf', contentType: 'application/pdf', name: asset.name || 'belge.pdf' });
        } catch (e) {
            Alert.alert('Dosya seçilemedi', e?.message || 'Lütfen tekrar dene.');
        }
    };

    const pickPhoto = async () => {
        try {
            const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.Images, quality: 0.8, base64: true });
            if (picked.canceled || !picked.assets?.[0]?.base64) return;
            const bytes = decode(picked.assets[0].base64);
            if (bytes.byteLength > APPEAL_FILE_MAX_BYTES) return Alert.alert('Görsel çok büyük', 'Görsel en fazla 5 MB olabilir.');
            setFile({ bytes, extension: 'jpg', contentType: 'image/jpeg', name: 'görsel.jpg' });
        } catch (e) {
            Alert.alert('Görsel seçilemedi', e?.message || 'Lütfen tekrar dene.');
        }
    };

    const send = async () => {
        setBusy(true);
        try {
            let attachmentPath;
            if (file) {
                // Kovaya doğrudan yükleme kapalı: sunucu imzalı yükleme adresi verir (web ile aynı).
                const upload = await apiRequest('appeals', { method: 'POST', body: { action: 'upload-url', extension: file.extension } });
                if (upload.error || !upload.path || !upload.token) {
                    Alert.alert('Dosya yüklenemedi', upload.error || 'Ek olmadan da itiraz edebilirsin.');
                    return;
                }
                const { error } = await supabase.storage.from(APPEAL_FILES_BUCKET).uploadToSignedUrl(upload.path, upload.token, file.bytes, { contentType: file.contentType });
                if (error) {
                    Alert.alert('Dosya yüklenemedi', 'Ek olmadan da itiraz edebilirsin.');
                    return;
                }
                attachmentPath = upload.path;
            }
            const result = await apiRequest('appeals', { method: 'POST', body: { action: 'submit', decisionId: decision.id, message, attachmentPath } });
            if (result.error) {
                Alert.alert('Gönderilemedi', result.error);
                return;
            }
            setAppeal(result.appeal);
            setOpen(false);
            Alert.alert('İtirazın alındı', 'Sonucu bildirimle haber vereceğiz.');
            onDone?.();
        } finally {
            setBusy(false);
        }
    };

    return (
        <View className="rounded-xl bg-s2 border border-line" style={{ padding: 12, gap: 10 }}>
            {showReason ? (
                <Text variant="small">
                    <Text variant="small" weight="semibold">Neden: </Text>
                    <Text variant="small" tone="fg2">{decision.reason}</Text>
                    <Text variant="caption" tone="fg3">{`  (${formatDate(decision.decidedAt)})`}</Text>
                </Text>
            ) : null}

            {appeal ? (
                <View style={{ gap: 6 }}>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <Text variant="small" weight="semibold">İtirazın</Text>
                        <Chip label={appeal.statusLabel} tone={APPEAL_STATUS_TONES[appeal.status] || 'neutral'} />
                        <Text variant="caption" tone="fg3">{formatDate(appeal.createdAt)}</Text>
                    </View>
                    <Text variant="small" tone="fg2">{appeal.message}</Text>
                    {appeal.hasAttachment ? <Text variant="caption" tone="fg3">Ek dosya gönderildi.</Text> : null}
                    {appeal.response ? (
                        <Text variant="small">
                            <Text variant="small" weight="semibold">Yanıt: </Text>
                            <Text variant="small" tone="fg2">{appeal.response}</Text>
                        </Text>
                    ) : null}
                    {appeal.status === 'rejected' ? <Text variant="caption" tone="fg3">Bu karara yeniden itiraz edilemez.</Text> : null}
                </View>
            ) : decision.canAppeal ? (
                open ? (
                    <View style={{ gap: 10 }}>
                        <TextField
                            label="İtirazın"
                            hint={`${message.length} / ${APPEAL_TEXT_MAX} · Karar başına bir kez itiraz edebilirsin.`}
                            placeholder="Kararın neden yanlış olduğunu ve varsa düzelttiğin şeyi açıkla."
                            value={message}
                            onChangeText={(v) => setMessage(v.slice(0, APPEAL_TEXT_MAX))}
                            multiline
                            height={110}
                        />
                        {file ? (
                            <View className="flex-row items-center" style={{ gap: 8 }}>
                                <Paperclip size={14} color={colors.fg2} />
                                <Text variant="small" tone="fg2" style={{ flex: 1 }} numberOfLines={1}>{file.name}</Text>
                                <Text variant="small" tone="danger" onPress={() => setFile(null)} suppressHighlighting>Kaldır</Text>
                            </View>
                        ) : (
                            <View className="flex-row" style={{ gap: 8 }}>
                                <View className="flex-1"><Button title="PDF ekle" icon={FileText} variant="secondary" size="md" onPress={pickPdf} disabled={busy} block /></View>
                                <View className="flex-1"><Button title="Görsel ekle" icon={ImageIcon} variant="secondary" size="md" onPress={pickPhoto} disabled={busy} block /></View>
                            </View>
                        )}
                        <View className="flex-row" style={{ gap: 8 }}>
                            <View className="flex-1"><Button title="Vazgeç" icon={X} variant="secondary" onPress={() => setOpen(false)} disabled={busy} block /></View>
                            <View className="flex-1"><Button title="Gönder" onPress={send} loading={busy} disabled={message.trim().length < 10} block /></View>
                        </View>
                    </View>
                ) : (
                    <Button title="Karara itiraz et" icon={MessageSquareWarning} variant="secondary" size="md" onPress={() => setOpen(true)} block />
                )
            ) : null}
        </View>
    );
}
