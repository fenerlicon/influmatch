import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from './Text';
import { colors, ICON_STROKE } from './theme';

/**
 * Alt sekme çubuğu (design/mobile): düz zemin, üst çizgi, etiketli 5 sekme, okunmamış sayısı altın rozet.
 * Sekme tanımında options.tabIcon (Lucide bileşeni), options.title ve isteğe bağlı options.tabBarBadge kullanılır.
 */
export default function TabBar({ state, descriptors, navigation }) {
    const insets = useSafeAreaInsets();
    return (
        <View className="flex-row bg-bg border-t border-line px-1.5 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const focused = state.index === index;
                const Icon = options.tabIcon;
                const label = options.title ?? route.name;
                const badge = options.tabBarBadge;
                const color = focused ? colors.gold : colors.fg3;

                const onPress = () => {
                    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                    if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
                };

                return (
                    <Pressable
                        key={route.key}
                        onPress={onPress}
                        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: focused }}
                        accessibilityLabel={badge ? `${label}, ${badge} yeni` : label}
                        className="flex-1 items-center pt-1 h-[50px]"
                        style={{ gap: 4 }}
                    >
                        <View>
                            {Icon ? <Icon size={23} color={color} strokeWidth={ICON_STROKE} /> : null}
                            {badge ? (
                                <View className="absolute -top-1 left-[17px] min-w-[17px] h-[17px] px-[5px] rounded-full bg-gold items-center justify-center">
                                    <Text weight="bold" tone="goldInk" style={{ fontSize: 10.5, lineHeight: 13 }}>{badge > 99 ? '99+' : badge}</Text>
                                </View>
                            ) : null}
                        </View>
                        <Text weight="medium" style={{ fontSize: 10.5, lineHeight: 13, color }} numberOfLines={1}>{label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}
