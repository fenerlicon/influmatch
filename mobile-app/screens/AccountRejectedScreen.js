import React, { useCallback, useEffect, useState } from 'react';
import { View, ActivityIndicator, Linking } from 'react-native';
import { XCircle, Mail, LogOut } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import AppealCard from '../components/AppealCard';
import { Screen, Text, Button, Card, IconBox, colors } from '../components/ui';

// Reddedilmiş hesap (web components/dashboard/RejectedScreen.tsx ile aynı, 2026-10-26): ret nedeni + karar başına bir itiraz.
// Karar kaydı yoksa (eski ret ya da tablo yok) destek e-postası. Uygulamaya başka ekrandan girilemez.
export default function AccountRejectedScreen({ navigation }) {
    const [decision, setDecision] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const result = await apiRequest('appeals?type=account');
        const latest = result?.decisions?.[0] || null;
        setDecision(latest && latest.current ? latest : null);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const signOut = async () => {
        await supabase.auth.signOut();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    return (
        <Screen scroll keyboard contentClassName="pt-10">
            <Card style={{ gap: 14 }}>
                <IconBox icon={XCircle} tone="danger" size={48} />
                <Text variant="display" style={{ fontSize: 28, lineHeight: 32 }}>
                    {decision ? 'Hesabın onaylanmadı' : 'Hesabın askıya alındı'}
                </Text>
                <Text variant="small" tone="fg2">
                    {decision
                        ? 'Hesabın yönetici incelemesinde onaylanmadı. Nedeni aşağıda; karara bir kez itiraz edebilirsin.'
                        : 'Hesabın yönetici tarafından reddedildi ya da kullanım koşullarına aykırılık nedeniyle askıya alındı. İtiraz için destek ekibine yazabilirsin.'}
                </Text>
                {loading ? <ActivityIndicator color={colors.gold} /> : null}
                {!loading && decision ? <AppealCard decision={decision} onDone={load} /> : null}
                {!loading && !decision ? (
                    <Button title="İtiraz için yaz" icon={Mail} variant="secondary" onPress={() => Linking.openURL('mailto:destek@influmatch.net').catch(() => null)} block />
                ) : null}
                <Button title="Çıkış yap" icon={LogOut} variant="ghost" onPress={signOut} block />
            </Card>
            <View style={{ height: 24 }} />
        </Screen>
    );
}
