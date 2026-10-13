import React, { useState } from 'react';
import { View, Pressable, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Instagram, Music2, Copy, CircleCheck, LogOut, AtSign } from 'lucide-react-native';
import { signOutAndClearPush } from '../../utils/notifications';
import { apiRequest } from '../../lib/api';
import { Screen, StackHeader, Text, Button, IconButton, TextField, Card, colors, ICON_STROKE } from '../../components/ui';

// Zorunlu sosyal hesap doğrulaması (web: /onboarding/verify). Influencer / UGC, Instagram veya TikTok
// hesaplarından en az birini biyografi koduyla doğrulamadan panele giremez. Kod üretme ve kontrol
// web'in sunucu uçlarından (/api/mobile/verify-instagram, verify-tiktok) yapılır.

const PLATFORMS = [
    { id: 'instagram', label: 'Instagram', icon: Instagram },
    { id: 'tiktok', label: 'TikTok', icon: Music2 },
];

function Step({ n, children }) {
    return (
        <View className="flex-row items-start" style={{ gap: 12 }}>
            <View className="w-6 h-6 rounded-full bg-s3 items-center justify-center">
                <Text variant="caption" weight="semibold" tone="fg2">{n}</Text>
            </View>
            <Text tone="fg2" style={{ flex: 1, fontSize: 14 }}>{children}</Text>
        </View>
    );
}

export default function SocialVerifyGateScreen({ navigation }) {
    const [platform, setPlatform] = useState('instagram');
    const [username, setUsername] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(null);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(false);

    const endpoint = platform === 'tiktok' ? 'verify-tiktok' : 'verify-instagram';
    const platformLabel = platform === 'tiktok' ? 'TikTok' : 'Instagram';

    const generate = async () => {
        const clean = username.trim().replace(/^@/, '').toLowerCase();
        if (!clean) return setError('Kullanıcı adı boş olamaz.');
        setBusy('generate');
        setError(null);
        const result = await apiRequest(endpoint, { method: 'POST', body: { action: 'generate', username: clean } });
        setBusy(null);
        if (result.error || !result.success) return setError(result.error || 'Kod üretilemedi.');
        setCode(result.code);
    };

    const verify = async () => {
        setBusy('verify');
        setError(null);
        const result = await apiRequest(endpoint, { method: 'POST', body: { action: 'verify' } });
        setBusy(null);
        if (result.error || !result.success) return setError(result.error || 'Doğrulama başarısız.');
        setDone(true);
    };

    const copyCode = async () => {
        await Clipboard.setStringAsync(code);
        Alert.alert('Kopyalandı', 'Kodu biyografine yapıştır, kaydet ve "Doğrula"ya bas.');
    };

    const switchPlatform = (id) => {
        if (id === platform) return;
        setPlatform(id);
        setCode('');
        setError(null);
    };

    const signOut = () => signOutAndClearPush().then(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }));

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="Hesap doğrulama" right={<IconButton icon={LogOut} onPress={signOut} accessibilityLabel="Çıkış yap" />} />}
            contentClassName="pt-2"
        >
            <View style={{ gap: 6 }}>
                <Text variant="title">Hesabının sana ait olduğunu doğrula</Text>
                <Text tone="fg2">Devam etmek için Instagram veya TikTok hesaplarından en az birini doğrulaman gerekiyor. Biyografine geçici bir kod ekleyeceksin.</Text>
            </View>

            {done ? (
                <Card className="border-success/40" style={{ gap: 10 }}>
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <CircleCheck color={colors.success} size={20} strokeWidth={ICON_STROKE} />
                        <Text weight="semibold" tone="success">Hesabın doğrulandı</Text>
                    </View>
                    <Text variant="small" tone="fg2">Artık biyografindeki kodu silebilirsin.</Text>
                    <Button title="Devam et" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Dashboard' }] })} block />
                </Card>
            ) : (
                <>
                    <View className="flex-row" style={{ gap: 10 }}>
                        {PLATFORMS.map((p) => {
                            const on = platform === p.id;
                            return (
                                <Pressable
                                    key={p.id}
                                    onPress={() => switchPlatform(p.id)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: on }}
                                    className={`flex-1 h-14 rounded-[14px] border flex-row items-center justify-center ${on ? 'border-gold-line bg-gold-soft' : 'border-line-strong'}`}
                                    style={{ gap: 8 }}
                                >
                                    <p.icon size={20} color={on ? colors.fg : colors.fg2} strokeWidth={ICON_STROKE} />
                                    <Text weight="medium" tone={on ? 'fg' : 'fg2'}>{p.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>

                    <TextField
                        label={`${platformLabel} kullanıcı adın`}
                        icon={AtSign}
                        placeholder="kullaniciadi"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={username}
                        onChangeText={(v) => { setUsername(v); setCode(''); }}
                    />

                    {!code ? (
                        <Button title="Doğrulama kodu al" onPress={generate} loading={busy === 'generate'} disabled={!!busy} block />
                    ) : (
                        <>
                            <Pressable onPress={copyCode} accessibilityRole="button" accessibilityLabel="Kodu kopyala"
                                className="flex-row items-center justify-between p-4 rounded-[14px] border border-dashed border-gold-line bg-gold-soft">
                                <View>
                                    <Text variant="caption" tone="fg3">Doğrulama kodun</Text>
                                    <Text weight="semibold" tone="champagne" style={{ fontSize: 22, lineHeight: 28, letterSpacing: 2.5 }}>{code}</Text>
                                </View>
                                <View className="flex-row items-center h-[34px] px-3 rounded-[9px] bg-s3 border border-line-strong" style={{ gap: 6 }}>
                                    <Copy size={15} color={colors.fg} strokeWidth={ICON_STROKE} />
                                    <Text variant="small" weight="medium">Kopyala</Text>
                                </View>
                            </Pressable>
                            <View style={{ gap: 12 }}>
                                <Step n={1}>Kodu {platformLabel} biyografine ekle ve kaydet.</Step>
                                <Step n={2}>Buraya dön ve "Doğrula"ya dokun.</Step>
                                <Step n={3}>Doğrulandıktan sonra kodu silebilirsin.</Step>
                            </View>
                            <Button title="Doğrula" onPress={verify} loading={busy === 'verify'} disabled={!!busy} block />
                            <Button title="Yeni kod al" variant="ghost" size="md" onPress={generate} disabled={!!busy} block />
                        </>
                    )}

                    {error ? <Text variant="small" tone="danger">{error}</Text> : null}
                </>
            )}
        </Screen>
    );
}
