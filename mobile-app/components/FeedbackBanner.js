import React from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

const FeedbackBanner = ({ navigation }) => {
    const handlePress = () => {
        if (navigation && navigation.isReady()) {
            navigation.navigate('Feedback');
        } else {
            console.warn('Navigation not ready');
        }
    };

    return (
        <View className="bg-[#1e1b4b] flex-row items-center justify-center py-2 px-4 shadow-sm" style={{ paddingTop: Platform.OS === 'ios' ? 50 : 35 }}>
            <AlertTriangle color="#60a5fa" size={14} className="mr-2" />
            <Text className="text-blue-100 text-[10px] font-medium text-center">
                Bu bir <Text className="font-bold text-white">MVP</Text> (Minimum Viable Product) sürümüdür.{" "}
                <Text onPress={handlePress} className="text-white underline font-bold">
                    Hata ve geribildirimlerinizi bizimle paylaşın.
                </Text>
            </Text>
        </View>
    );
};

export default FeedbackBanner;
