import React from 'react';
import { View, Pressable, ScrollView } from 'react-native';
import Text from './Text';
import { colors, ICON_STROKE } from './theme';

/**
 * Segment kontrol: options = [{ key, label, count? }]
 * <Segment options={…} value={tab} onChange={setTab} />
 */
export function Segment({ options, value, onChange }) {
    return (
        <View className="flex-row p-[3px] bg-s1 border border-line rounded-xl">
            {options.map((o) => {
                const on = o.key === value;
                return (
                    <Pressable
                        key={o.key}
                        onPress={() => onChange?.(o.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        className={`flex-1 h-9 rounded-[9px] flex-row items-center justify-center ${on ? 'bg-s3 border border-line-strong' : ''}`}
                        style={{ gap: 6 }}
                    >
                        <Text variant="small" weight={on ? 'medium' : 'regular'} tone={on ? 'fg' : 'fg2'} style={{ fontSize: 14 }} numberOfLines={1}>{o.label}</Text>
                        {o.count ? <Text variant="caption" tone="fg3">{o.count}</Text> : null}
                    </Pressable>
                );
            })}
        </View>
    );
}

// Alt çizgili sekmeler (profil sekmeleri)
export function UnderlineTabs({ options, value, onChange }) {
    return (
        <View className="flex-row border-b border-line px-5" style={{ gap: 22 }}>
            {options.map((o) => {
                const on = o.key === value;
                return (
                    <Pressable
                        key={o.key}
                        onPress={() => onChange?.(o.key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: on }}
                        className={`h-11 justify-center border-b-2 -mb-px ${on ? 'border-gold' : 'border-transparent'}`}
                    >
                        <Text weight={on ? 'medium' : 'regular'} tone={on ? 'fg' : 'fg2'} style={{ fontSize: 14.5 }}>{o.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const CHIP_TONES = {
    neutral: { box: 'bg-s3 border-line', text: 'fg2', icon: colors.fg2 },
    gold: { box: 'bg-gold-soft border-gold-line', text: 'gold', icon: colors.gold },
    success: { box: 'bg-success-soft border-transparent', text: 'success', icon: colors.success },
    warning: { box: 'bg-warning-soft border-transparent', text: 'warning', icon: colors.warning },
    danger: { box: 'bg-danger-soft border-transparent', text: 'danger', icon: colors.danger },
    info: { box: 'bg-info-soft border-transparent', text: 'info', icon: colors.info },
};

// Durum/etiket çipi. dot: başta renkli nokta.
export function Chip({ label, tone = 'neutral', icon: Icon, dot = false }) {
    const t = CHIP_TONES[tone] || CHIP_TONES.neutral;
    return (
        <View className={`flex-row items-center self-start h-6 px-[9px] rounded-full border ${t.box}`} style={{ gap: 5 }}>
            {dot ? <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.icon }} /> : null}
            {Icon ? <Icon size={13} color={t.icon} strokeWidth={ICON_STROKE} /> : null}
            <Text variant="caption" weight="medium" tone={t.text} numberOfLines={1}>{label}</Text>
        </View>
    );
}

// Seçilebilir filtre çipi (36px)
export function FilterChip({ label, selected = false, onPress, icon: Icon }) {
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={`flex-row items-center h-9 px-3.5 rounded-full border ${selected ? 'bg-fg border-fg' : 'border-line-strong'}`}
            style={{ gap: 6 }}
        >
            {Icon ? <Icon size={15} color={selected ? colors.bg : colors.fg2} strokeWidth={ICON_STROKE} /> : null}
            <Text weight={selected ? 'medium' : 'regular'} style={{ fontSize: 14, color: selected ? colors.bg : colors.fg2 }}>{label}</Text>
        </Pressable>
    );
}

// Yatay kayan çip satırı
export function ChipRow({ children }) {
    return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
            {children}
        </ScrollView>
    );
}
