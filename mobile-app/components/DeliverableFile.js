// Teslimat taslak dosyası (R2, teslim kilidi; web components/dashboard/DeliverableFile.tsx ile aynı kurallar).
// - pickAndUploadDeliverable: influencer galeriden video / görsel seçer, dosya imzalı adresle doğrudan R2'ye yüklenir.
// - DeliverableFileView: iki taraf uygulama içinde önizler; indirme influencer'a her zaman, markaya "Ödeme alındı"dan sonra.
import React, { useState } from 'react';
import { View, Image, Linking, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Download, Eye, Lock } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { Button, Text, colors, ICON_STROKE } from './ui';
import {
    deliverableFileExtension, deliverableFileKind, deliverableFileMaxBytes,
} from '../constants/deliverableFiles';

function putWithProgress(url, blob, contentType, onProgress) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', contentType);
        if (xhr.upload) xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
        xhr.onerror = () => resolve(false);
        xhr.send(blob);
    });
}

/**
 * Galeriden seçtirir ve yükler. Sonuç: null (vazgeçildi) | { ref, name } | { error }.
 */
export async function pickAndUploadDeliverable(collaborationId, deliverableId, onProgress) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { error: 'Galeri izni verilmedi. Telefon ayarlarından izin verebilirsin.' };
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos', 'images'], quality: 1, videoMaxDuration: 600 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    const asset = picked.assets[0];
    const extension = deliverableFileExtension(asset.fileName || asset.uri, asset.mimeType);
    if (!extension) return { error: 'Yalnızca video (MP4, MOV, WEBM) veya görsel (JPEG, PNG, WEBP) yükleyebilirsin.' };

    let blob;
    try {
        blob = await (await fetch(asset.uri)).blob();
    } catch (e) {
        return { error: 'Dosya okunamadı. Başka bir dosya dene.' };
    }
    const size = blob.size || asset.fileSize || 0;
    const max = deliverableFileMaxBytes(extension);
    if (!size) return { error: 'Dosya okunamadı. Başka bir dosya dene.' };
    if (size > max) return { error: `Dosya en fazla ${Math.round(max / (1024 * 1024))} MB olabilir.` };

    const start = await apiRequest(`collaborations/${collaborationId}/files`, {
        method: 'POST', body: { action: 'upload-url', deliverableId, extension, size },
    });
    if (!start?.success || !start.uploadUrl) return { error: start?.error || 'Yükleme başlatılamadı.' };
    const ok = await putWithProgress(start.uploadUrl, blob, start.contentType, onProgress);
    if (!ok) return { error: 'Dosya yüklenemedi. Bağlantını kontrol edip tekrar dene.' };
    return { ref: start.ref, name: asset.fileName || (extension === 'mp4' || extension === 'mov' ? 'Video' : 'Görsel') };
}

export function DeliverableFileView({ collaborationId, fileRef, isBrand, downloadUnlocked, compact }) {
    const kind = deliverableFileKind(fileRef);
    const [url, setUrl] = useState(null);
    const [loading, setLoading] = useState(null);
    const canDownload = !isBrand || downloadUnlocked;

    const open = async (mode) => {
        setLoading(mode);
        const result = await apiRequest(`collaborations/${collaborationId}/files`, { method: 'POST', body: { action: mode, ref: fileRef } });
        setLoading(null);
        if (!result?.success || !result.url) {
            Alert.alert('Dosya açılamadı', result?.error || 'Tekrar dene.');
            return;
        }
        if (mode === 'view') setUrl(result.url);
        else Linking.openURL(result.url).catch(() => null);
    };

    return (
        <View style={{ gap: 8 }}>
            <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                {!url ? (
                    <Button
                        title={kind === 'image' ? 'Görseli önizle' : 'Videoyu önizle'} icon={Eye}
                        variant={compact ? 'ghost' : 'secondary'} size="sm" loading={loading === 'view'} onPress={() => open('view')}
                    />
                ) : null}
                {canDownload ? (
                    <Button title="İndir" icon={Download} variant="ghost" size="sm" loading={loading === 'download'} onPress={() => open('download')} />
                ) : (
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                        <Lock size={13} color={colors.fg3} strokeWidth={ICON_STROKE} />
                        <Text variant="caption" tone="fg3">İndirme, "Ödeme alındı" işaretlenince açılır</Text>
                    </View>
                )}
            </View>
            {url ? (
                kind === 'image' ? (
                    <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 12 }} resizeMode="contain" />
                ) : (
                    <Video
                        source={{ uri: url }}
                        style={{ width: '100%', aspectRatio: 9 / 16, maxHeight: 480, borderRadius: 12, backgroundColor: '#000' }}
                        useNativeControls
                        resizeMode={ResizeMode.CONTAIN}
                    />
                )
            ) : null}
        </View>
    );
}
