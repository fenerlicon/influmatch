import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AlertTriangle, Info, Sparkles } from 'lucide-react-native';
import Text from './Text';
import { Touchable } from './Button';
import { colors, ICON_STROKE } from './theme';

const NOTICE_TONES = {
    warning: { bg: 'bg-warning-soft', color: colors.warning, icon: AlertTriangle },
    info: { bg: 'bg-info-soft', color: colors.info, icon: Info },
    gold: { bg: 'bg-gold-soft', color: colors.gold, icon: Sparkles },
    danger: { bg: 'bg-danger-soft', color: colors.danger, icon: AlertTriangle },
};

/**
 * Tek bildirim alanı: panel üstündeki uyarılar öncelik sırasıyla tek kartta; more = kalan uyarı sayısı.
 */
export function Notice({ tone = 'info', icon, title, text, more, onPress, right }) {
    const t = NOTICE_TONES[tone] || NOTICE_TONES.info;
    const Icon = icon || t.icon;
    return (
        <Touchable onPress={onPress} className="flex-row items-center px-3.5 py-3 rounded-[14px] bg-s1 border border-line" style={{ gap: 12 }}>
            <View className={`w-8 h-8 rounded-[9px] items-center justify-center ${t.bg}`}>
                <Icon size={17} color={t.color} strokeWidth={ICON_STROKE} />
            </View>
            <View className="flex-1 min-w-0">
                {title ? <Text weight="medium" variant="small" style={{ fontSize: 13.5 }}>{title}</Text> : null}
                {text ? <Text variant="small" tone="fg2" style={{ fontSize: 12.5 }}>{text}</Text> : null}
            </View>
            {more ? <Text variant="caption" tone="fg3">+{more}</Text> : null}
            {right}
        </Touchable>
    );
}

export function ProgressBar({ value = 0, tone = 'gold' }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <View className="h-1.5 rounded-full bg-s3 overflow-hidden">
            <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[tone] || colors.gold }} />
        </View>
    );
}

// Parçalı adım çubuğu: total parça, done tamamlanan, current altın parça (onboarding, hesap durumu)
export function StepBar({ total, done = 0, current }) {
    return (
        <View className="flex-row" style={{ gap: 4 }}>
            {Array.from({ length: total }).map((_, i) => (
                <View
                    key={i}
                    className="flex-1 h-1 rounded-full"
                    style={{ backgroundColor: i === current ? colors.gold : i < done ? colors.success : colors.s3 }}
                />
            ))}
        </View>
    );
}

// İş birliği aşamaları (web ile aynı akış)
export const COLLAB_STAGES = ['Teklif', 'Anlaşıldı', 'İçerik', 'Yayın', 'Bitti'];

// stage: içinde bulunulan aşamanın sırası (0–4). Önceki aşamalar tamamlanmış sayılır.
export function Timeline({ stage = 0, stages = COLLAB_STAGES }) {
    return (
        <View className="flex-row" style={{ gap: 4 }}>
            {stages.map((label, i) => {
                const done = i < stage;
                const now = i === stage;
                return (
                    <View key={label} className="flex-1" style={{ gap: 7 }}>
                        <View className="h-1 rounded-full" style={{ backgroundColor: done ? colors.success : now ? colors.gold : colors.s3 }} />
                        <Text
                            variant="caption"
                            weight={now ? 'semibold' : 'regular'}
                            tone={now ? 'gold' : done ? 'fg2' : 'fg3'}
                            style={{ fontSize: 11, textAlign: 'center' }}
                            numberOfLines={1}
                        >
                            {label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

// Yüzde halkası (hesap durumu)
export function Ring({ value = 0, size = 58, stroke = 5 }) {
    const pct = Math.max(0, Math.min(100, Math.round(value)));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    return (
        <View style={{ width: size, height: size }} className="items-center justify-center">
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.s3} strokeWidth={stroke} fill="none" />
                <Circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={pct >= 100 ? colors.success : colors.gold} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - pct / 100)}
                />
            </Svg>
            <Text weight="semibold" style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>%{pct}</Text>
        </View>
    );
}
