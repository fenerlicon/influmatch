import React from 'react';
import { Pressable, ActivityIndicator, View } from 'react-native';
import Text from './Text';
import { colors, ICON_STROKE } from './theme';

// Ana eylem altın (ekranda en fazla bir; listelerde satırın kendi ana eylemi). Boylar dokunma hedefine göre.
const VARIANTS = {
    primary: { box: 'bg-gold border-gold', text: 'goldInk', icon: colors.goldInk },
    secondary: { box: 'bg-s3 border-line-strong', text: 'fg', icon: colors.fg },
    ghost: { box: 'bg-transparent border-transparent', text: 'fg2', icon: colors.fg2 },
    danger: { box: 'bg-transparent border-danger/40', text: 'danger', icon: colors.danger },
};

const SIZES = {
    lg: { box: 'h-12 px-[18px] rounded-xl', text: 15, icon: 18 },
    md: { box: 'h-10 px-3.5 rounded-[10px]', text: 14, icon: 16 },
    sm: { box: 'h-[34px] px-3 rounded-[9px]', text: 13, icon: 15 },
};

export default function Button({
    title, onPress, variant = 'primary', size = 'lg', icon: Icon, iconRight: IconRight,
    loading = false, disabled = false, block = false, className = '', accessibilityLabel,
}) {
    const v = VARIANTS[variant] || VARIANTS.primary;
    const s = SIZES[size] || SIZES.lg;
    const inactive = disabled || loading;
    return (
        <Pressable
            onPress={onPress}
            disabled={inactive}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel || title}
            accessibilityState={{ disabled: inactive, busy: loading }}
            className={block ? 'w-full' : ''}
        >
            {({ pressed }) => (
                <View
                    className={`flex-row items-center justify-center border ${v.box} ${s.box} ${className}`}
                    style={{ gap: 8, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 }}
                >
                    {loading ? (
                        <ActivityIndicator size="small" color={v.icon} />
                    ) : (
                        <>
                            {Icon ? <Icon size={s.icon} color={v.icon} strokeWidth={ICON_STROKE} /> : null}
                            {title ? (
                                <Text tone={v.text} weight={size === 'sm' ? 'medium' : 'semibold'} style={{ fontSize: s.text, lineHeight: s.text + 4 }} numberOfLines={1}>
                                    {title}
                                </Text>
                            ) : null}
                            {IconRight ? <IconRight size={s.icon} color={v.icon} strokeWidth={ICON_STROKE} /> : null}
                        </>
                    )}
                </View>
            )}
        </Pressable>
    );
}

// Yalnızca ikon içeren 44px dokunma alanı (üst çubuk vb.)
export function IconButton({ icon: Icon, onPress, color = colors.fg2, size = 22, dot = false, boxed = false, accessibilityLabel }) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={4}>
            {({ pressed }) => (
                <View
                    className={`w-11 h-11 items-center justify-center rounded-xl ${boxed ? 'bg-s1 border border-line' : ''}`}
                    style={{ opacity: pressed ? 0.6 : 1 }}
                >
                    <Icon size={size} color={color} strokeWidth={ICON_STROKE} />
                    {dot ? <View className="absolute top-2.5 right-[11px] w-[7px] h-[7px] rounded-full bg-gold border-2 border-bg" /> : null}
                </View>
            )}
        </Pressable>
    );
}

// Basılabilir sarmalayıcı: kart ve satırlarda basılı görünümü tek yerden verir.
export function Touchable({ onPress, children, className = '', style, disabled, accessibilityLabel }) {
    if (!onPress) return <View className={className} style={style}>{children}</View>;
    return (
        <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
            {({ pressed }) => (
                <View className={className} style={[style, { opacity: pressed ? 0.75 : 1 }]}>{children}</View>
            )}
        </Pressable>
    );
}
