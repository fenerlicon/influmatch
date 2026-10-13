import React, { useEffect, useRef } from 'react';
import { Animated, View, Platform, Pressable } from 'react-native';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';
import { Text as UIText, colors, ICON_STROKE } from './ui';

export const CustomToast = ({ visible, message, type = 'success', onHide }) => {
    const translateY = useRef(new Animated.Value(-100)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    speed: 12,
                    bounciness: 6,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                })
            ]).start();

            // Auto hide after 3 seconds
            const timer = setTimeout(() => {
                hide();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            // Reset position if invisible
            translateY.setValue(-100);
            opacity.setValue(0);
        }
    }, [visible]);

    const hide = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            })
        ]).start(() => {
            if (onHide) onHide();
        });
    };

    if (!visible) return null;

    // Tasarım sistemi: düz yüzey, ince kenarlık, anlam rengi yalnızca ikonda (components/ui/theme.js)
    const THEMES = {
        error: { title: 'Hata', color: colors.danger, Icon: XCircle },
        info: { title: 'Bilgi', color: colors.info, Icon: AlertCircle },
        success: { title: 'Başarılı', color: colors.success, Icon: CheckCircle },
    };
    const theme = THEMES[type] || THEMES.success;

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 60 : 40, // Adjust for stats bar
                left: 16,
                right: 16,
                zIndex: 9999,
                transform: [{ translateY }],
                opacity: opacity
            }}
        >
            <Pressable
                onPress={hide}
                accessibilityRole="alert"
                className="flex-row items-center px-3.5 py-3 rounded-[14px] bg-s2 border border-line-strong"
                style={{ gap: 12 }}
            >
                <theme.Icon color={theme.color} size={20} strokeWidth={ICON_STROKE} />
                <View className="flex-1">
                    <UIText variant="small" weight="semibold">{theme.title}</UIText>
                    <UIText variant="small" tone="fg2">{message}</UIText>
                </View>
            </Pressable>
        </Animated.View>
    );
};
