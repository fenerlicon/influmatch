import React from 'react';
import { View, ScrollView, RefreshControl, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import Text from './Text';
import { IconButton } from './Button';
import { colors } from './theme';

/**
 * Ekran kabuğu: zemin rengi + üst güvenli alan. scroll=true ise içerik kaydırılır.
 * Alt sekme çubuğu olan ekranlarda alt güvenli alanı tab bar karşılar.
 */
export function Screen({ children, scroll = false, refreshing, onRefresh, keyboard = false, contentClassName = '', header, footer }) {
    const body = scroll ? (
        <ScrollView
            className="flex-1"
            contentContainerClassName={`px-4 pb-8 ${contentClassName}`}
            contentContainerStyle={{ gap: 14 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} /> : undefined}
        >
            {children}
        </ScrollView>
    ) : (
        <View className={`flex-1 ${contentClassName}`}>{children}</View>
    );

    const content = (
        <>
            {header}
            {body}
            {footer}
        </>
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-bg">
            {keyboard ? (
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView>
            ) : content}
        </SafeAreaView>
    );
}

// Sekme ekranlarının büyük başlığı (Instrument Serif). left: logo vb., right: zil/avatar.
export function LargeHeader({ title, subtitle, left, right }) {
    return (
        <View className="px-5 pt-1 pb-3.5">
            {(left || right) ? (
                <View className="flex-row items-center justify-between min-h-[44px]">
                    <View>{left}</View>
                    <View className="flex-row items-center" style={{ gap: 4 }}>{right}</View>
                </View>
            ) : null}
            {title ? <Text variant="display">{title}</Text> : null}
            {subtitle ? <Text tone="fg2" className="mt-0.5">{subtitle}</Text> : null}
        </View>
    );
}

// Alt ekranların ortalı başlığı ve geri butonu.
export function StackHeader({ title, onBack, right, backIcon = ChevronLeft }) {
    return (
        <View className="flex-row items-center px-2 pt-1.5 pb-2.5 min-h-[52px]">
            <View className="w-11">{onBack ? <IconButton icon={backIcon} onPress={onBack} accessibilityLabel="Geri" /> : null}</View>
            <Text variant="heading" className="flex-1 text-center" numberOfLines={1}>{title || ''}</Text>
            <View className="min-w-[44px] items-end">{right}</View>
        </View>
    );
}

export function Logo() {
    return (
        <Text weight="bold" style={{ fontSize: 15, letterSpacing: 0.3 }}>
            INFLU<Text weight="bold" tone="gold" style={{ fontSize: 15, letterSpacing: 0.3 }}>MATCH</Text>
        </Text>
    );
}

// Sabit alt eylem alanı (sekme çubuğu olmayan ekranlar). withTabBar: sekme çubuğu üstünde duruyorsa.
export function BottomBar({ children, withTabBar = false }) {
    const insets = useSafeAreaInsets();
    return (
        <View
            className="flex-row items-center px-4 pt-3 bg-bg border-t border-line"
            style={{ gap: 10, paddingBottom: withTabBar ? 12 : Math.max(insets.bottom, 12) + 4 }}
        >
            {children}
        </View>
    );
}

// Bölüm başlığı: "Sana uygun ilanlar ........ Tümü"
export function Section({ title, action, onAction, children }) {
    return (
        <View style={{ gap: 10 }}>
            <View className="flex-row items-baseline justify-between px-1">
                <Text variant="small" weight="semibold">{title}</Text>
                {action ? <Text variant="small" tone="fg2" onPress={onAction} suppressHighlighting>{action}</Text> : null}
            </View>
            {children}
        </View>
    );
}
