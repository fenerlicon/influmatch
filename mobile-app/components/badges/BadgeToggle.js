import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Users, Building2 } from 'lucide-react-native';

export default function BadgeToggle({ activeTab, onTabChange }) {
    const slideAnim = useRef(new Animated.Value(0)).current;
    const containerWidth = useRef(0);

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: activeTab === 'influencer' ? 0 : 1,
            useNativeDriver: false, // width/left layout changes usually don't support native driver
            friction: 8,
            tension: 40,
        }).start();
    }, [activeTab]);

    const leftPosition = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['1.5%', '51%'] // Simplified calculation
    });

    return (
        <View className="relative flex-row items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-1.5 self-center">
            {/* Animated Background */}
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 4,
                    bottom: 4,
                    left: leftPosition,
                    width: '48%',
                    borderRadius: 12,
                    backgroundColor: 'rgba(212, 175, 55, 0.1)', // soft-gold/10
                    borderColor: 'rgba(212, 175, 55, 0.4)',
                    borderWidth: 1,
                }}
            />

            <TouchableOpacity
                onPress={() => onTabChange('influencer')}
                className="flex-row items-center justify-center px-4 py-3 rounded-xl z-10"
                style={{ minWidth: 140 }}
            >
                <Users size={18} color={activeTab === 'influencer' ? '#D4AF37' : '#9ca3af'} />
                <Text className={`ml-2 font-bold ${activeTab === 'influencer' ? 'text-soft-gold' : 'text-gray-400'}`}>
                    Influencer
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => onTabChange('brand')}
                className="flex-row items-center justify-center px-4 py-3 rounded-xl z-10"
                style={{ minWidth: 140 }}
            >
                <Building2 size={18} color={activeTab === 'brand' ? '#D4AF37' : '#9ca3af'} />
                <Text className={`ml-2 font-bold ${activeTab === 'brand' ? 'text-soft-gold' : 'text-gray-400'}`}>
                    Marka
                </Text>
            </TouchableOpacity>
        </View>
    );
}
