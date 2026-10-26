// Ret nedeni ve itiraz sabitleri (2026-10-26). Web'deki lib/moderation-shared.ts ile aynı tutulmalı
// (tests/mobile-parity.test.ts denetler). Kurallar sunucuda; burada yalnızca ekran metinleri ve sınırlar.

export const APPEAL_TEXT_MAX = 1000;
export const APPEAL_FILES_BUCKET = 'appeal-files';
export const APPEAL_FILE_MAX_BYTES = 5 * 1024 * 1024;

export const APPEAL_STATUS_LABELS = {
    open: 'İnceleniyor',
    accepted: 'Kabul edildi',
    rejected: 'Reddedildi',
};

export const APPEAL_STATUS_TONES = {
    open: 'warning',
    accepted: 'success',
    rejected: 'danger',
};
