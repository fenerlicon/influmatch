import React, { useState } from 'react';
import { View, Keyboard } from 'react-native';
import { Mail, KeyRound, Info } from 'lucide-react-native';
import { API_BASE } from '../lib/api';
import { CustomToast } from '../components/CustomToast';
import { Screen, StackHeader, Text, Button, TextField, Notice, colors, ICON_STROKE } from '../components/ui';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    async function handleReset() {
        if (!email) {
            showToast('Lütfen e-posta adresinizi girin.', 'info');
            return;
        }

        setLoading(true);
        Keyboard.dismiss();

        // Bağlantı web'in sunucusunda üretilir; e-postadaki bağlantı telefonun tarayıcısında da çalışır
        // ve web'in yeni şifre ekranını açar (app/api/mobile/forgot-password).
        let result = {};
        try {
            const res = await fetch(`${API_BASE}/api/mobile/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() }),
            });
            result = await res.json().catch(() => ({}));
            if (!res.ok && !result.error) result = { error: 'Sunucuya ulaşılamadı. Lütfen tekrar deneyin.' };
        } catch (e) {
            result = { error: 'Bağlantı hatası. İnternetinizi kontrol edin.' };
        }

        setLoading(false);
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast('Bu adres kayıtlıysa sıfırlama bağlantısı gönderildi. E-postanızı kontrol edin.', 'success');
            setTimeout(() => {
                navigation.goBack();
            }, 3000);
        }
    }

    return (
        <Screen scroll keyboard header={<StackHeader onBack={() => navigation.goBack()} />} contentClassName="pt-3">
            <CustomToast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

            <View className="w-[72px] h-[72px] rounded-[20px] bg-s1 border border-line items-center justify-center">
                <KeyRound size={32} color={colors.gold} strokeWidth={ICON_STROKE} />
            </View>
            <View style={{ gap: 6 }}>
                <Text variant="title" style={{ fontSize: 32, lineHeight: 36 }}>Şifreni sıfırla</Text>
                <Text tone="fg2">Hesabına bağlı e-postayı yaz, sıfırlama bağlantısı gönderelim.</Text>
            </View>
            <TextField
                label="E-posta"
                icon={Mail}
                placeholder="ornek@mail.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                returnKeyType="send"
                onSubmitEditing={handleReset}
            />
            <Button title="Bağlantı gönder" onPress={handleReset} loading={loading} block />
            <Notice tone="info" icon={Info} text="Bağlantı birkaç dakika içinde gelmezse spam klasörüne bak." />
        </Screen>
    );
}
