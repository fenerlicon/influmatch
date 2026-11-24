import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ShieldAlert } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import AppealCard from './AppealCard';
import { Notice } from './ui';

/**
 * Hesap kısıtı (2026-11-23; web ShellNotices "account_hold" + /dashboard/account-status ile aynı): ödeme / teslim bildirimine
 * süresinde yanıt verilmezse inceleme, admin kararıyla askıya alma. Askıya almada karara bir kez itiraz edilir.
 * Kısıt yoksa ya da özellik kapalıysa (SQL canlıda değil) hiçbir şey göstermez.
 */
export default function AccountHoldNotice() {
    const [hold, setHold] = useState(null);
    const [decision, setDecision] = useState(null);

    const load = useCallback(() => {
        let active = true;
        apiRequest('commitment').then(async (r) => {
            if (!active) return;
            const next = r?.hold || null;
            setHold(next);
            if (next?.kind === 'suspended') {
                const d = await apiRequest('appeals?type=collaboration_dispute');
                if (active) setDecision(d?.decisions?.[0] || null);
            } else {
                setDecision(null);
            }
        }).catch(() => null);
        return () => { active = false; };
    }, []);
    useFocusEffect(load);

    if (!hold) return null;
    return (
        <View style={{ gap: 8 }}>
            <Notice
                tone={hold.kind === 'suspended' ? 'danger' : 'warning'}
                icon={ShieldAlert}
                title={hold.kind === 'suspended' ? 'Hesabın askıya alındı' : 'Hesabın incelemede'}
                text={hold.kind === 'suspended'
                    ? `Yeni ilan, teklif ve başvuru yapamazsın.${hold.reason ? ` Neden: ${hold.reason}` : ''}`
                    : 'Bir ödeme / teslim bildirimine süresinde yanıt verilmedi. Destek ekibi karar verene kadar yeni ilan, teklif ve başvuru yapamazsın; kanıtını iş birliği ekranından yükleyebilirsin.'}
            />
            {decision && (decision.canAppeal || decision.appeal) ? <AppealCard decision={decision} onDone={load} /> : null}
        </View>
    );
}
