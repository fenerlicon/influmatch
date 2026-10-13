import React from 'react';
import { Text as RNText } from 'react-native';
import { colors, fonts } from './theme';

// Yazı ölçeği (design/mobile/index.html "Yazı" paneli)
const VARIANTS = {
    display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.3 },
    title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
    heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
    body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
    small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
    caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
    eyebrow: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, letterSpacing: 1.5, textTransform: 'uppercase' },
};

const WEIGHTS = { regular: fonts.regular, medium: fonts.medium, semibold: fonts.semibold, bold: fonts.bold };

const TONES = {
    fg: colors.fg,
    fg2: colors.fg2,
    fg3: colors.fg3,
    gold: colors.gold,
    goldInk: colors.goldInk,
    champagne: colors.champagne,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
};

/**
 * Uygulamanın tek metin bileşeni. Yazı tipi ve rengi buradan gelir; düzen için className kullan.
 * <Text variant="heading" tone="fg2" weight="medium">…</Text>
 */
export default function Text({ variant = 'body', weight, tone, italic, style, ...props }) {
    const base = VARIANTS[variant] || VARIANTS.body;
    const isDisplay = variant === 'display' || variant === 'title';
    const fontFamily = isDisplay
        ? (italic ? fonts.displayItalic : fonts.display)
        : (weight ? WEIGHTS[weight] : base.fontFamily);
    const color = TONES[tone || (variant === 'eyebrow' ? 'fg3' : 'fg')];
    return <RNText {...props} style={[base, { fontFamily, color }, style]} />;
}
