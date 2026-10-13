import React, { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquareWarning, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text, colors, ICON_STROKE } from './ui';

const BANNER_KEY = 'mvp_banner_dismissed';

// MVP bilgi bandı. Giriş/kayıt ekranlarında gösterilmez (hidden); panelde tek satırlık sade bant.
const FeedbackBanner = ({ navigation, hidden = false }) => {
    const [visible, setVisible] = useState(false); // start hidden until we check storage
    const insets = useSafeAreaInsets();

    useEffect(() => {
        AsyncStorage.getItem(BANNER_KEY).then((value) => {
            if (value !== 'true') {
                setVisible(true);
            }
        });
    }, []);

    const handleDismiss = async () => {
        setVisible(false);
        await AsyncStorage.setItem(BANNER_KEY, 'true');
    };

    const handlePress = () => {
        if (navigation && navigation.isReady()) {
            navigation.navigate('Feedback');
        }
    };

    if (!visible || hidden) return null;

    return (
        <View className="flex-row items-center px-4 bg-s1 border-b border-line" style={{ paddingTop: insets.top + 6, paddingBottom: 8, gap: 10 }}>
            <MessageSquareWarning color={colors.info} size={15} strokeWidth={ICON_STROKE} />
            <Text variant="caption" tone="fg2" style={{ flex: 1 }}>
                Bu bir MVP sürümüdür.{' '}
                <Text variant="caption" weight="medium" tone="fg" onPress={handlePress} suppressHighlighting style={{ textDecorationLine: 'underline' }}>
                    Hata ve geri bildirimini paylaş
                </Text>
            </Text>
            <Pressable onPress={handleDismiss} hitSlop={12} accessibilityLabel="Bandı kapat">
                <X color={colors.fg3} size={16} strokeWidth={ICON_STROKE} />
            </Pressable>
        </View>
    );
};

export default FeedbackBanner;
