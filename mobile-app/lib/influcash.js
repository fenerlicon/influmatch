import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from './api';

/** Influcash açık mı ve bakiye (2026-11-23). Kapalıyken { enabled: false }; ekranlar Influcash satırını gizler. */
export function useInflucashSummary() {
    const [summary, setSummary] = useState({ enabled: false, balance: 0 });
    useFocusEffect(useCallback(() => {
        let active = true;
        apiRequest('influcash?ozet=1').then((r) => {
            if (active && !r?.error) setSummary({ enabled: !!r.enabled, balance: r.balance || 0 });
        }).catch(() => null);
        return () => { active = false; };
    }, []));
    return summary;
}
