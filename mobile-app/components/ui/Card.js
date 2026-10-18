import React from 'react';
import { View, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, BadgeCheck, Sparkles } from 'lucide-react-native';
import Text from './Text';
import { Touchable } from './Button';
import { colors, ICON_STROKE, AVATAR_TONES } from './theme';

// Düz yüzey kart. accent: altın kenarlı vurgulu kart (ör. Spotlight).
// spotlight: Spotlight üyesinin kartı (2026-10-19, web .spotlight-card ile aynı fikir): üst kenarda ince altın çizgi.
export function Card({ children, padded = true, accent = false, spotlight = false, onPress, className = '', style }) {
    return (
        <Touchable
            onPress={onPress}
            className={`bg-s1 border rounded-2xl overflow-hidden ${accent ? 'border-gold-line' : 'border-line'} ${padded ? 'p-4' : ''} ${className}`}
            style={style}
        >
            {accent ? (
                <LinearGradient colors={[colors.goldSoft, 'transparent']} locations={[0, 0.75]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            ) : null}
            {spotlight ? (
                <LinearGradient colors={['transparent', colors.gold, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }} />
            ) : null}
            {children}
        </Touchable>
    );
}

// Satırları tek kartta toplayan liste
export function ListGroup({ children, className = '' }) {
    const items = React.Children.toArray(children).filter(Boolean);
    return (
        <View className={`bg-s1 border border-line rounded-2xl overflow-hidden ${className}`}>
            {items.map((child, i) => (
                <View key={child.key ?? i} className={i < items.length - 1 ? 'border-b border-line' : ''}>{child}</View>
            ))}
        </View>
    );
}

export function ListRow({ left, title, subtitle, right, onPress, chevron = false, titleTone, numberOfLines = 1 }) {
    return (
        <Touchable onPress={onPress} className="flex-row items-center px-3.5 py-3 min-h-[60px]" style={{ gap: 12 }}>
            {left}
            <View className="flex-1 min-w-0">
                {typeof title === 'string' ? <Text weight="medium" tone={titleTone} numberOfLines={numberOfLines}>{title}</Text> : title}
                {subtitle ? (typeof subtitle === 'string' ? <Text variant="small" tone="fg2" numberOfLines={numberOfLines}>{subtitle}</Text> : subtitle) : null}
            </View>
            {right}
            {chevron ? <ChevronRight size={18} color={colors.fg3} strokeWidth={ICON_STROKE} /> : null}
        </Touchable>
    );
}

const ICON_TONES = {
    neutral: { bg: 'bg-s3', color: colors.fg2 },
    gold: { bg: 'bg-gold-soft', color: colors.gold },
    success: { bg: 'bg-success-soft', color: colors.success },
    warning: { bg: 'bg-warning-soft', color: colors.warning },
    danger: { bg: 'bg-danger-soft', color: colors.danger },
    info: { bg: 'bg-info-soft', color: colors.info },
};

// Satır başındaki simge kutusu
export function IconBox({ icon: Icon, tone = 'neutral', size = 36 }) {
    const t = ICON_TONES[tone] || ICON_TONES.neutral;
    return (
        <View className={`items-center justify-center rounded-[10px] ${t.bg}`} style={{ width: size, height: size }}>
            <Icon size={Math.round(size / 2)} color={t.color} strokeWidth={ICON_STROKE} />
        </View>
    );
}

export function StatCard({ label, value, hint, className = '' }) {
    return (
        <View className={`flex-1 bg-s1 border border-line rounded-[14px] px-3.5 py-3 ${className}`}>
            <Text variant="caption" tone="fg3">{label}</Text>
            <Text weight="semibold" style={{ fontSize: 21, lineHeight: 26, letterSpacing: -0.4, fontVariant: ['tabular-nums'] }} className="mt-0.5">{value}</Text>
            {hint ? <Text variant="caption" tone="fg3">{hint}</Text> : null}
        </View>
    );
}

// Anahtar-değer satırı (anlaşma özeti, ilan bilgisi)
export function KeyValue({ label, value, valueTone, last = false }) {
    return (
        <View className={`flex-row justify-between py-[11px] ${last ? '' : 'border-b border-line'}`} style={{ gap: 12 }}>
            <Text tone="fg2" variant="small" style={{ fontSize: 14 }}>{label}</Text>
            <Text weight="medium" tone={valueTone} variant="small" style={{ fontSize: 14, textAlign: 'right', flexShrink: 1 }}>{value}</Text>
        </View>
    );
}

export function EmptyState({ icon: Icon, title, text, action }) {
    return (
        <View className="items-center px-6 py-9" style={{ gap: 10 }}>
            {Icon ? (
                <View className="w-14 h-14 rounded-2xl bg-s2 border border-line items-center justify-center">
                    <Icon size={26} color={colors.fg3} strokeWidth={ICON_STROKE} />
                </View>
            ) : null}
            <Text weight="semibold" style={{ fontSize: 16, textAlign: 'center' }}>{title}</Text>
            {text ? <Text tone="fg2" variant="small" style={{ fontSize: 14, textAlign: 'center', maxWidth: 260 }}>{text}</Text> : null}
            {action ? <View className="mt-1">{action}</View> : null}
        </View>
    );
}

const AVATAR_SIZES = { sm: 32, md: 40, lg: 64, xl: 84 };

function initialsOf(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts.length === 1 ? parts[0].slice(0, 1) : parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase('tr-TR');
}

function toneOf(name = '') {
    let h = 0;
    for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_TONES[h % AVATAR_TONES.length];
}

// Fotoğraf varsa fotoğraf, yoksa baş harf (web ile aynı koyu tonlar)
export function Avatar({ name, uri, size = 'md', square = false }) {
    const px = typeof size === 'number' ? size : AVATAR_SIZES[size] || 40;
    const radius = square ? Math.round(px * 0.3) : px / 2;
    if (uri) {
        return <Image source={{ uri }} style={{ width: px, height: px, borderRadius: radius, backgroundColor: colors.s3 }} />;
    }
    return (
        <View
            className="items-center justify-center border border-line-strong"
            style={{ width: px, height: px, borderRadius: radius, backgroundColor: toneOf(name) }}
        >
            <Text weight="semibold" style={{ fontSize: Math.round(px * 0.34), lineHeight: Math.round(px * 0.42) }}>{initialsOf(name)}</Text>
        </View>
    );
}

// Ad + mavi tik
// spotlight: "Spotlight" yazısı yerine isim yanında küçük altın parıltı (2026-10-19).
export function NameWithTick({ name, verified, spotlight = false, variant = 'body', weight = 'semibold', numberOfLines = 1 }) {
    return (
        <View className="flex-row items-center min-w-0" style={{ gap: 5 }}>
            <Text variant={variant} weight={weight} numberOfLines={numberOfLines} style={{ flexShrink: 1 }}>{name}</Text>
            {verified ? <BadgeCheck size={variant === 'heading' ? 18 : 15} color={colors.info} strokeWidth={ICON_STROKE} /> : null}
            {spotlight ? <Sparkles size={variant === 'heading' ? 17 : 14} color={colors.gold} strokeWidth={ICON_STROKE} accessibilityLabel="Spotlight üyesi" /> : null}
        </View>
    );
}
