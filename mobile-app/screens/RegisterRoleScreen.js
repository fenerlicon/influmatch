import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Sparkles, Building2, Check } from 'lucide-react-native';
import { Screen, StackHeader, BottomBar, Text, Button, colors, ICON_STROKE } from '../components/ui';

const ROLES = [
    {
        role: 'influencer',
        title: 'Influencer / Üretici',
        subtitle: 'İçerik üretiyorum',
        icon: Sparkles,
        features: ['Marka tekliflerini al, değerlendir', 'İlanlara başvur', 'Fiyat kartını ve profilini yönet'],
    },
    {
        role: 'brand',
        title: 'Marka',
        subtitle: 'İş birliği arıyorum',
        icon: Building2,
        features: ['Influencer keşfet, teklif gönder', 'İlan yayınla, başvuruları yönet'],
    },
];

function RoleCard({ item, selected, onPress }) {
    const Icon = item.icon;
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`rounded-[18px] p-[18px] border ${selected ? 'border-gold-line bg-gold-soft' : 'border-line bg-s1'}`}
            style={{ gap: 10 }}
        >
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <View className={`w-11 h-11 rounded-xl items-center justify-center ${selected ? 'bg-gold-soft' : 'bg-s3'}`}>
                    <Icon size={22} color={selected ? colors.gold : colors.fg2} strokeWidth={ICON_STROKE} />
                </View>
                <View className="flex-1">
                    <Text weight="semibold" style={{ fontSize: 17 }}>{item.title}</Text>
                    <Text variant="small" tone="fg2">{item.subtitle}</Text>
                </View>
                <View className={`w-[22px] h-[22px] rounded-full border-[1.5px] items-center justify-center ${selected ? 'border-gold' : 'border-line-strong'}`}>
                    {selected ? <View className="w-[11px] h-[11px] rounded-full bg-gold" /> : null}
                </View>
            </View>
            <View style={{ gap: 6 }}>
                {item.features.map((f) => (
                    <View key={f} className="flex-row items-center" style={{ gap: 8 }}>
                        <Check size={15} color={colors.fg3} strokeWidth={ICON_STROKE} />
                        <Text variant="small" tone="fg2" style={{ fontSize: 13.5 }}>{f}</Text>
                    </View>
                ))}
            </View>
        </Pressable>
    );
}

export default function RegisterRoleScreen({ navigation }) {
    const [selectedRole, setSelectedRole] = useState('influencer'); // Varsayılan seçim

    const handleContinue = () => {
        navigation.navigate('RegisterForm', { role: selectedRole });
    };

    return (
        <Screen
            scroll
            header={<StackHeader onBack={() => navigation.goBack()} right={<Text variant="caption" tone="fg3">1 / 3</Text>} />}
            footer={<BottomBar><View className="flex-1"><Button title="Devam et" onPress={handleContinue} block /></View></BottomBar>}
        >
            <View style={{ gap: 6 }} className="mb-1.5">
                <Text variant="display">Nasıl katılıyorsun?</Text>
                <Text tone="fg2">Hesap türünü seç.</Text>
            </View>
            {ROLES.map((item) => (
                <RoleCard key={item.role} item={item} selected={selectedRole === item.role} onPress={() => setSelectedRole(item.role)} />
            ))}
        </Screen>
    );
}
