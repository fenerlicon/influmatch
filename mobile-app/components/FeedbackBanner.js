import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Animated } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BANNER_KEY = 'mvp_banner_dismissed';

const FeedbackBanner = ({ navigation }) => {
    const [visible, setVisible] = useState(false); // start hidden until we check storage

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

    if (!visible) return null;

    return (
        <View
            className="bg-[#1e1b4b] flex-row items-center px-4 shadow-sm"
            style={{ paddingTop: Platform.OS === 'ios' ? 50 : 35, paddingBottom: 8 }}
        >
            <AlertTriangle color="#60a5fa" size={13} style={{ marginRight: 6, flexShrink: 0 }} />
            <Text className="text-blue-100 text-[10px] font-medium flex-1" numberOfLines={2}>
                Bu bir <Text className="font-bold text-white">MVP</Text> sürümüdür.{' '}
                <Text onPress={handlePress} className="text-white underline font-bold">
                    Geri bildirim paylaşın.
                </Text>
            </Text>
            <TouchableOpacity
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginLeft: 8, padding: 4, flexShrink: 0 }}
            >
                <X color="#93c5fd" size={14} />
            </TouchableOpacity>
        </View>
    );
};

export default FeedbackBanner;
