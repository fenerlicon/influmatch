import React from 'react';
import { View, Text } from 'react-native';
import { phaseConfig } from '../../constants/badges';

export default function BadgeCard({ badge, phase }) {
    const config = phaseConfig[phase];
    const Icon = badge.icon;

    const bgStyle = phase === 'mvp' ? 'bg-white/5' : 'bg-white/3';

    return (
        <View
            className={`relative overflow-hidden rounded-2xl border ${config.borderColor} ${bgStyle} p-5 mb-4`}
        >
            <View className="flex-row items-center gap-4">
                {/* Icon */}
                <View
                    className={`h-12 w-12 items-center justify-center rounded-xl border ${config.borderColor} ${config.bgColor}`}
                >
                    {/* Note: Icon color is handled via class usually, but lucide-react-native needs direct color prop or style */}
                    <Icon size={24} className={config.iconColor} color={phase === 'mvp' ? '#fbbf24' : phase === 'v1.2' ? '#94a3b8' : '#c084fc'} />
                </View>

                {/* Content */}
                <View className="flex-1">
                    <Text className="mb-1 text-base font-bold text-white">
                        {badge.name}
                    </Text>
                    <Text className="text-xs text-gray-400 leading-4">
                        {badge.description}
                    </Text>
                </View>
            </View>

            {/* Decorative corner accent */}
            <View
                className={`absolute -right-4 -top-4 h-16 w-16 rounded-full ${config.bgColor} opacity-20`}
            />
        </View>
    );
}
