// Teklif / başvuru listelerinde iş birliği aşaması (3.14-S1). Web lib/collaboration-shared.ts
// COLLABORATION_STAGE_SHORT_LABELS ve lib/works.ts COLLABORATION_TONES ile aynı tutulur.
import { supabase } from '../lib/supabase';

export const COLLAB_STAGE_SHORT = {
    agreed: { label: 'Anlaşıldı', tone: 'gold' },
    in_progress: { label: 'Devam ediyor', tone: 'info' },
    published: { label: 'Yayında', tone: 'warning' },
    completed: { label: 'Tamamlandı', tone: 'success' },
    cancelled: { label: 'İptal edildi', tone: 'danger' },
};

/**
 * Kabul edilen başvuruların iş birliği aşaması: Map<application_id, { id, status }>. RLS yalnızca tarafın gördüğü
 * iş birliklerini döndürür. Hata olursa boş harita (liste "Kabul edildi" göstermeye devam eder).
 */
export async function loadApplicationCollabs(applicationIds) {
    const ids = [...new Set((applicationIds || []).filter(Boolean))].slice(0, 500);
    const map = new Map();
    if (!ids.length) return map;
    const { data, error } = await supabase.from('collaborations').select('id, status, application_id').in('application_id', ids);
    if (error) {
        console.error('[collaborations] aşamalar alınamadı:', error.message);
        return map;
    }
    (data || []).forEach((row) => row.application_id && map.set(row.application_id, { id: row.id, status: row.status }));
    return map;
}
