// Sohbette görsel gönderme (3.22-N2, web ile aynı akış): galeriden seçilen görsel yüklemeden önce küçültülür
// (en uzun kenar 1600 px, JPEG %80; web lib/image-compress.ts ile aynı amaç), sunucudan imzalı yükleme adresi alınır
// (/api/mobile/messages/upload-url: oda üyeliği, kapalı oda, engel ve marka onayı kontrolü), gizli chat-attachments
// kovasına yüklenir ve "![image](url)" mesajı web'in sunucu koduyla gönderilir (POST /api/mobile/messages).
// R2 (2026-11-24): sunucu R2 ayarlıysa imzalı PUT adresi döner (provider 'r2'); dosya Cloudflare R2'ye doğrudan yüklenir.
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';

export const CHAT_ATTACHMENT_BUCKET = 'chat-attachments';
export const CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
// Tam boy orijinal (web lib/chat-image.ts ile aynı): sohbette önizleme görünür, "İndir" tam boyu verir.
export const CHAT_FULL_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
const FULL_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MAX_EDGE = 1600;

/** Galeriden görsel seçtirir; vazgeçilirse null. */
export async function pickChatImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { error: 'Galeri izni verilmedi. Telefon ayarlarından izin verebilirsin.' };
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.Images, quality: 1 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return null;
    return { asset: picked.assets[0] };
}

/** Küçültür ve JPEG'e çevirir: { bytes } (ArrayBuffer). */
async function compress(asset) {
    const context = ImageManipulator.manipulate(asset.uri);
    const { width = 0, height = 0 } = asset;
    if (Math.max(width, height) > MAX_EDGE) {
        context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
    }
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
    if (!saved?.base64) throw new Error('Görsel hazırlanamadı.');
    return decode(saved.base64);
}

/**
 * Seçilen görseli odaya gönderir. Sonuç: { success: true, data: mesaj } ya da { success: false, error }.
 */
export async function sendChatImage(roomId, asset) {
    let bytes;
    try {
        bytes = await compress(asset);
    } catch (e) {
        return { success: false, error: 'Görsel hazırlanamadı. Başka bir görsel dene.' };
    }
    if (bytes.byteLength > CHAT_IMAGE_MAX_BYTES) return { success: false, error: 'Görsel en fazla 5 MB olabilir.' };

    // Tam boy orijinal: yalnızca JPEG / PNG / WEBP ve 20 MB'a kadar (HEIC vb. ise yalnızca önizleme gider).
    let original = null;
    const fullExt = FULL_BY_MIME[asset.mimeType] || null;
    if (fullExt) {
        try {
            const blob = await (await fetch(asset.uri)).blob();
            if (blob.size > 0 && blob.size <= CHAT_FULL_IMAGE_MAX_BYTES) original = { blob, extension: fullExt, size: blob.size };
        } catch (e) {
            original = null;
        }
    }

    const upload = await apiRequest('messages/upload-url', {
        method: 'POST',
        body: { roomId, extension: 'jpg', size: bytes.byteLength, full: original ? { extension: original.extension, size: original.size } : null },
    });
    if (upload?.success && upload.provider === 'r2' && upload.uploadUrl && upload.url) {
        try {
            const puts = [fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': upload.contentType || 'image/jpeg' }, body: bytes })];
            if (upload.full && original) {
                puts.push(fetch(upload.full.uploadUrl, { method: 'PUT', headers: { 'Content-Type': upload.full.contentType }, body: original.blob }));
            }
            const results = await Promise.all(puts);
            if (results.some((r) => !r.ok)) return { success: false, error: 'Görsel yüklenemedi. Tekrar dene.' };
        } catch (e) {
            return { success: false, error: 'Görsel yüklenemedi. Tekrar dene.' };
        }
        const sent = await apiRequest('messages', { method: 'POST', body: { roomId, content: `![image](${upload.url})` } });
        if (!sent?.success) return { success: false, error: sent?.error || 'Görsel gönderilemedi.' };
        return { success: true, data: sent.data };
    }
    if (!upload?.success || !upload.path || !upload.token || !upload.url) {
        return { success: false, error: upload?.error || 'Yükleme başlatılamadı. Tekrar dene.' };
    }
    const { error } = await supabase.storage
        .from(CHAT_ATTACHMENT_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, bytes, { contentType: upload.contentType || 'image/jpeg' });
    if (error) return { success: false, error: 'Görsel yüklenemedi. Tekrar dene.' };

    const result = await apiRequest('messages', { method: 'POST', body: { roomId, content: `![image](${upload.url})` } });
    if (!result?.success) return { success: false, error: result?.error || 'Görsel gönderilemedi.' };
    return { success: true, data: result.data };
}
