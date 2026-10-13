import React from 'react';
import { Modal, View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';

/**
 * Alttan açılan sayfa (modal yerine). visible / onClose; title ve sağda isteğe bağlı eylem (headerRight).
 */
export default function Sheet({ visible, onClose, title, headerRight, children, scroll = false }) {
    const insets = useSafeAreaInsets();
    const body = scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>{children}</ScrollView>
    ) : (
        <View style={{ gap: 14 }}>{children}</View>
    );
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Pressable className="flex-1 bg-black/60" onPress={onClose} accessibilityLabel="Kapat" />
                <View
                    className="bg-s1 border-t border-line-strong rounded-t-[24px] px-4 pt-2.5"
                    style={{ paddingBottom: Math.max(insets.bottom, 16) + 8, maxHeight: '88%', gap: 14 }}
                >
                    <View className="w-[38px] h-[5px] rounded-full bg-s3 self-center mb-1" />
                    {title || headerRight ? (
                        <View className="flex-row items-center justify-between">
                            <Text weight="semibold" style={{ fontSize: 19, lineHeight: 24, letterSpacing: -0.2 }}>{title}</Text>
                            {headerRight}
                        </View>
                    ) : null}
                    {body}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
