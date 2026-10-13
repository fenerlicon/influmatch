import React, { useState } from 'react';
import { View, TextInput, Switch, Pressable } from 'react-native';
import { Search, Check } from 'lucide-react-native';
import Text from './Text';
import { colors, fonts, ICON_STROKE } from './theme';

/**
 * Etiketli metin alanı. icon: soldaki Lucide ikonu, right: sağdaki öğe (göz, onay ikonu vb.).
 * prefix: "₺" gibi sabit ön ek.
 */
export function TextField({ label, hint, error, icon: Icon, right, prefix, multiline = false, height, className = '', inputStyle, onFocus, onBlur, ...props }) {
    const [focused, setFocused] = useState(false);
    const border = error ? 'border-danger/60' : focused ? 'border-gold-line' : 'border-line-strong';
    return (
        <View className={className} style={{ gap: 7 }}>
            {label ? <Text variant="small" weight="medium" tone="fg2">{label}</Text> : null}
            <View
                className={`flex-row bg-s2 border rounded-xl px-3.5 ${border} ${multiline ? 'items-start pt-3' : 'items-center'}`}
                style={{ gap: 10, height: multiline ? (height || 96) : (height || 50) }}
            >
                {Icon ? <Icon size={18} color={colors.fg3} strokeWidth={ICON_STROKE} /> : null}
                {prefix ? <Text tone="fg3">{prefix}</Text> : null}
                <TextInput
                    placeholderTextColor={colors.fg3}
                    selectionColor={colors.gold}
                    cursorColor={colors.gold}
                    multiline={multiline}
                    textAlignVertical={multiline ? 'top' : 'center'}
                    {...props}
                    onFocus={(e) => { setFocused(true); onFocus?.(e); }}
                    onBlur={(e) => { setFocused(false); onBlur?.(e); }}
                    style={[{ flex: 1, color: colors.fg, fontFamily: fonts.regular, fontSize: 15, height: '100%', paddingVertical: 0, outlineStyle: 'none' }, inputStyle]}
                />
                {right}
            </View>
            {error ? <Text variant="small" tone="danger">{error}</Text> : hint ? <Text variant="small" tone="fg3">{hint}</Text> : null}
        </View>
    );
}

export function SearchBar({ value, onChangeText, placeholder = 'Ara', ...props }) {
    return (
        <View className="flex-row items-center h-11 rounded-xl bg-s1 border border-line px-3.5" style={{ gap: 10 }}>
            <Search size={18} color={colors.fg3} strokeWidth={ICON_STROKE} />
            <TextInput
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor={colors.fg3}
                selectionColor={colors.gold}
                returnKeyType="search"
                style={{ flex: 1, color: colors.fg, fontFamily: fonts.regular, fontSize: 15, height: '100%', paddingVertical: 0, outlineStyle: 'none' }}
                {...props}
            />
        </View>
    );
}

export function Toggle({ value, onValueChange, disabled }) {
    return (
        <Switch
            value={!!value}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{ false: colors.s3, true: colors.gold }}
            thumbColor={value ? colors.goldInk : colors.fg2}
            activeThumbColor={colors.goldInk}
            ios_backgroundColor={colors.s3}
        />
    );
}

// Kare onay kutusu + metin (koşulları kabul vb.)
export function Checkbox({ checked, onChange, children }) {
    return (
        <Pressable onPress={() => onChange?.(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked: !!checked }} className="flex-row items-start" style={{ gap: 12 }}>
            <View className={`w-[22px] h-[22px] rounded-md border items-center justify-center mt-px ${checked ? 'bg-gold border-gold' : 'border-line-strong bg-s2'}`}>
                {checked ? <Check size={14} color={colors.goldInk} strokeWidth={2.5} /> : null}
            </View>
            <View className="flex-1">{children}</View>
        </Pressable>
    );
}

// Ayar satırı: başlık + açıklama + anahtar
export function ToggleRow({ title, subtitle, value, onValueChange, disabled }) {
    return (
        <View className="flex-row items-center px-3.5 min-h-[54px] py-2" style={{ gap: 12 }}>
            <View className="flex-1">
                <Text>{title}</Text>
                {subtitle ? <Text variant="small" tone="fg3">{subtitle}</Text> : null}
            </View>
            <Toggle value={value} onValueChange={onValueChange} disabled={disabled} />
        </View>
    );
}
