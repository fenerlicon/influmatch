// Teslimat taslak dosyası kuralları (web lib/deliverable-files-shared.ts ile aynı tutulmalı; tests/mobile-parity.test.ts kontrol eder).
export const DELIVERABLE_VIDEO_MAX_BYTES = 200 * 1024 * 1024;
export const DELIVERABLE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export const DELIVERABLE_LOCK_NOTE =
    'Marka dosyayı önizleyebilir; orijinal dosyayı indirmek, influencer "Ödeme alındı" işaretledikten sonra açılır.';

const BY_MIME = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};
const VIDEO_EXT = ['mp4', 'mov', 'webm'];
const ALL_EXT = ['mp4', 'mov', 'webm', 'jpg', 'png', 'webp'];

export function deliverableFileExtension(name, mime) {
    if (mime && BY_MIME[mime]) return BY_MIME[mime];
    const ext = String(name || '').split('.').pop().toLowerCase();
    const normalized = ext === 'jpeg' ? 'jpg' : ext;
    return ALL_EXT.includes(normalized) ? normalized : null;
}

export function deliverableFileMaxBytes(extension) {
    return VIDEO_EXT.includes(extension) ? DELIVERABLE_VIDEO_MAX_BYTES : DELIVERABLE_IMAGE_MAX_BYTES;
}

export function isDeliverableFileRef(value) {
    return typeof value === 'string' && /^r2:\/\/deliverables\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z0-9_]+\.(mp4|mov|webm|jpg|png|webp)$/i.test(value);
}

export function deliverableFileKind(value) {
    if (!isDeliverableFileRef(value)) return null;
    return VIDEO_EXT.includes(value.split('.').pop().toLowerCase()) ? 'video' : 'image';
}
