// Görevler sabitleri; web lib/tasks-shared.ts ile aynı tutulmalı (tests/mobile-parity.test.ts denetler). Kurallar sunucuda.

export const TASK_PROOF_BUCKET = 'task-proofs';
export const TASK_PROOF_MAX_BYTES = 5 * 1024 * 1024;

export const TASK_SUBMISSION_STATUS_LABELS = {
    measuring: 'Ölçülüyor',
    in_review: 'İncelemede',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
};

export const TASK_REWARD_STATUS_LABELS = {
    pending: 'Satış başlayınca',
    applied: 'Hesaba işlendi',
    cancelled: 'İptal edildi',
};

/** Görev kartındaki durum etiketi ve rengi (web TasksBoard ile aynı). */
export const TASK_STATE_CHIPS = {
    available: { label: 'Açık', tone: 'neutral' },
    ready: { label: 'Ödül hazır', tone: 'gold' },
    measuring: { label: 'Ölçülüyor', tone: 'info' },
    in_review: { label: 'İncelemede', tone: 'info' },
    completed: { label: 'Tamamlandı', tone: 'success' },
    blocked: { label: 'Kilitli', tone: 'neutral' },
};
