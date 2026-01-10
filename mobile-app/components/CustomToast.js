import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, Platform, TouchableOpacity } from 'react-native';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react-native';

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

    // Theme Config
    const getTheme = () => {
        switch (type) {
            case 'error':
                return {
                    borderColor: 'border-red-500/50',
                    bgColor: 'bg-red-500/10',
                    textColor: 'text-red-400',
                    icon: <XCircle color="#F87171" size={24} strokeWidth={2} />
                };
            case 'info':
                return {
                    borderColor: 'border-blue-500/50',
                    bgColor: 'bg-blue-500/10',
                    textColor: 'text-blue-400',
                    icon: <AlertCircle color="#60A5FA" size={24} strokeWidth={2} />
                };
            default: // success
                return {
                    borderColor: 'border-soft-gold/50',
                    bgColor: 'bg-soft-gold/10',
                    textColor: 'text-soft-gold',
                    icon: <CheckCircle color="#D4AF37" size={24} strokeWidth={2} />
                };
        }
    };

    const theme = getTheme();

    return (
        <Animated.View
            style={{
                position: 'absolute',
                top: Platform.OS === 'ios' ? 60 : 40, // Adjust for stats bar
                left: 20,
                right: 20,
                zIndex: 9999,
                transform: [{ translateY }],
                opacity: opacity
            }}
        >
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={hide}
                className={`flex-row items-center p-4 rounded-xl border backdrop-blur-xl shadow-2xl ${theme.bgColor} ${theme.borderColor} bg-black/80`}
            >
                <View className="mr-3">
                    {theme.icon}
                </View>
                <View className="flex-1">
                    <Text className={`font-bold text-sm ${theme.textColor} mb-0.5 uppercase tracking-wider`}>
                        {type === 'error' ? 'Hata' : type === 'info' ? 'Bilgi' : 'Başarılı'}
                    </Text>
                    <Text className="text-gray-200 text-xs font-medium leading-4">
                        {message}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};
