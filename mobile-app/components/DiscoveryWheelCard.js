import React from 'react';
import { View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { Card, Text, Button } from './ui';

// Keşif çarkı açıklaması (web: components/dashboard/DiscoveryWheelCard.tsx ile aynı metin). Fiyat/iddia içermez.
// variant 'profile': açılmak istenen profil güncel çarkta değil.
const formatDateTime = (value) =>
    new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function DiscoveryWheelCard({ profilesPerSpin, windowHours, expiresAt, spinning = false, onSpin, variant = 'discover' }) {
    const title = variant === 'profile'
        ? 'Bu profil şu anki keşif çarkında değil'
        : expiresAt ? 'Bugünkü profillerin hazır' : 'Çarkı çevir, sana uygun profilleri gör';

    return (
        <Card accent style={{ gap: 8 }}>
            <Text variant="eyebrow" tone="gold">Keşif çarkı</Text>
            <Text weight="semibold" style={{ fontSize: 16 }}>{title}</Text>
            <Text variant="small" tone="fg2" style={{ lineHeight: 19 }}>
                Her {windowHours} saatte bir çarkı çevirebilirsin. Çark, markanın sektörüne uygun {profilesPerSpin} doğrulanmış
                influencer/UGC profilini seçer; bu profiller {windowHours} saat boyunca açık kalır. Sonraki çevirişte, daha önce
                gösterilmemiş profiller gelir. Teklif gönderdiğin, iş birliği yaptığın ya da ilanına başvuran profilleri her zaman
                açabilirsin. Spotlight markalar tüm profilleri görür.
            </Text>
            {expiresAt ? (
                <Text variant="small" tone="fg">Profiller {formatDateTime(expiresAt)} tarihine kadar açık; sonra çarkı yeniden çevirebilirsin.</Text>
            ) : onSpin ? (
                <View className="mt-1 self-start">
                    <Button title="Çarkı çevir" icon={RefreshCw} size="md" onPress={onSpin} loading={spinning} />
                </View>
            ) : null}
        </Card>
    );
}
