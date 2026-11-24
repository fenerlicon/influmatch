import { Alert } from 'react-native';
import { apiRequest } from './api';
import { COMMITMENT_CHECKBOX_LABEL, COMMITMENT_REQUIRED_ERROR, COMMITMENT_TEXT, COMMITMENT_VERSION } from '../constants/trust';

// Marka iş birliği taahhüdü (2026-11-23; web components/trust/CommitmentDialog.tsx ile aynı metin ve sürüm).
// İlk ilan ya da ilk tekliften önce bir kez; kayıt sunucuda (/api/mobile/commitment). Teklif / ilan formları açıkken de
// görünsün diye sistem penceresiyle sorulur (iç içe pencere yok).

export const isCommitmentError = (error) => error === COMMITMENT_REQUIRED_ERROR;

/** Taahhüdü sorar; kabul edilip kaydedilirse true. */
export function askCommitment() {
    return new Promise((resolve) => {
        Alert.alert('İş birliği taahhüdü', `${COMMITMENT_TEXT}\n\nİlk ilanını açmadan ya da ilk teklifini göndermeden önce bir kez onaylaman gerekiyor.`, [
            { text: 'Şimdi değil', style: 'cancel', onPress: () => resolve(false) },
            {
                text: COMMITMENT_CHECKBOX_LABEL,
                onPress: async () => {
                    const result = await apiRequest('commitment', { method: 'POST', body: { accepted: true, version: COMMITMENT_VERSION } });
                    if (result.error) {
                        Alert.alert('Kaydedilemedi', result.error);
                        resolve(false);
                        return;
                    }
                    resolve(true);
                },
            },
        ]);
    });
}
