import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

// Keşif çarkı açıklaması (web: components/dashboard/DiscoveryWheelCard.tsx ile aynı metin). Fiyat/iddia içermez.
// variant 'profile': açılmak istenen profil güncel çarkta değil.
const formatDateTime = (value) =>
    new Date(value).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function DiscoveryWheelCard({ profilesPerSpin, windowHours, expiresAt, spinning = false, onSpin, variant = 'discover' }) {
    const title = variant === 'profile'
        ? 'Bu profil şu anki keşif çarkında değil'
        : expiresAt ? 'Bugünkü profillerin hazır' : 'Çarkı çevir, sana uygun profilleri gör';

    return (
        <View className="rounded-[24px] border border-soft-gold/30 bg-white/5 p-5">
            <Text className="text-soft-gold text-[10px] font-black uppercase tracking-[3px]">Keşif çarkı</Text>
            <Text className="text-white font-bold text-lg mt-2">{title}</Text>
            <Text className="text-gray-300 text-xs leading-5 mt-2">
                Her {windowHours} saatte bir çarkı çevirebilirsin. Çark, markanın sektörüne uygun {profilesPerSpin} doğrulanmış
                influencer/UGC profilini seçer; bu profiller {windowHours} saat boyunca açık kalır. Sonraki çevirişte, daha önce
                gösterilmemiş profiller gelir. Teklif gönderdiğin, iş birliği yaptığın ya da ilanına başvuran profilleri her zaman
                açabilirsin. Spotlight markalar tüm profilleri görür.
            </Text>
            {expiresAt ? (
                <Text className="text-gray-200 text-xs mt-4">
                    Profiller {formatDateTime(expiresAt)} tarihine kadar açık; sonra çarkı yeniden çevirebilirsin.
                </Text>
            ) : onSpin ? (
                <TouchableOpacity
                    onPress={onSpin}
                    disabled={spinning}
                    className="mt-4 self-start flex-row items-center gap-2 rounded-2xl border border-soft-gold/50 bg-soft-gold/10 px-5 py-3"
                >
                    {spinning ? <ActivityIndicator size="small" color="#D4AF37" /> : <RefreshCw color="#D4AF37" size={16} />}
                    <Text className="text-soft-gold font-bold text-sm">Çarkı çevir</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}
