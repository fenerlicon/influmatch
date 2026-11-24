// Zorunlu telefon (2026-11-24; web /onboarding/phone ile aynı): numarası olmayan influencer / UGC / marka panele girmeden
// önce bir kez numarasını ekler. Numarayı yalnızca Influmatch ekibi görür (web lib/user-contact.ts).
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { resolveHomeRoute } from '../lib/routing';
import { supabase } from '../lib/supabase';
import { signOutAndClearPush } from '../utils/notifications';
import { MARKETING_SMS_LABEL, PHONE_PURPOSE_NOTE, normalizePhone } from '../constants/phone';
import { Screen, StackHeader, BottomBar, Text, Button, IconButton, TextField, Checkbox } from '../components/ui';

export default function PhoneGateScreen({ navigation }) {
    const [phone, setPhone] = useState('');
    const [marketingSms, setMarketingSms] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const signOut = () => signOutAndClearPush().then(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }));

    const save = async () => {
        setError(null);
        const checked = normalizePhone(phone);
        if (checked.error) return setError(checked.error);
        setSaving(true);
        const result = await apiRequest('contact', { method: 'POST', body: { phone: checked.phone, marketingSms } });
        if (!result?.success) {
            setSaving(false);
            return setError(result?.error || 'Kaydedilemedi. Tekrar dene.');
        }
        const { data } = await supabase.auth.getUser();
        const dest = data?.user ? await resolveHomeRoute(data.user.id).catch(() => null) : null;
        setSaving(false);
        if (!dest) return Alert.alert('Kaydedildi', 'Uygulamayı yeniden açın.');
        navigation.reset({ index: 0, routes: [{ name: dest }] });
    };

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="Telefon numarası" right={<IconButton icon={LogOut} onPress={signOut} accessibilityLabel="Çıkış yap" />} />}
            footer={<BottomBar><View className="flex-1"><Button title="Kaydet ve devam et" onPress={save} loading={saving} block /></View></BottomBar>}
        >
            <View style={{ gap: 6 }} className="mb-1">
                <Text variant="title" style={{ fontSize: 28, lineHeight: 32 }}>Son bir adım</Text>
                <Text tone="fg2">Hesabını kullanmaya devam etmek için telefon numaranı eklemen gerekiyor.</Text>
            </View>
            <TextField
                label="Telefon numarası"
                hint={PHONE_PURPOSE_NOTE}
                error={error || undefined}
                placeholder="0532 123 45 67"
                keyboardType="phone-pad"
                autoComplete="tel"
                value={phone}
                onChangeText={setPhone}
                maxLength={20}
            />
            <Checkbox checked={marketingSms} onChange={setMarketingSms}>
                <Text variant="small" tone="fg2" style={{ lineHeight: 20 }}>{MARKETING_SMS_LABEL}</Text>
            </Checkbox>
        </Screen>
    );
}
