import React, { useMemo, useState } from 'react';
import { View, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { Check } from 'lucide-react-native';
import Sheet from './Sheet';
import Text from './Text';
import { SearchBar } from './Form';
import { colors, ICON_STROKE } from './theme';

/**
 * Aranabilir seçim listesi (şehir vb.). options: string[] veya { value, label }[].
 */
export default function OptionSheet({ visible, onClose, title, options, value, onSelect, searchPlaceholder = 'Ara' }) {
    const [query, setQuery] = useState('');
    const { height } = useWindowDimensions();
    const items = useMemo(() => options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)), [options]);
    const filtered = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('tr-TR');
        return q ? items.filter((o) => o.label.toLocaleLowerCase('tr-TR').includes(q)) : items;
    }, [items, query]);

    const close = () => { setQuery(''); onClose?.(); };

    return (
        <Sheet visible={visible} onClose={close} title={title}>
            {items.length > 8 ? <SearchBar value={query} onChangeText={setQuery} placeholder={searchPlaceholder} autoFocus={false} /> : null}
            <FlatList
                data={filtered}
                keyExtractor={(o) => String(o.value)}
                style={{ maxHeight: height * 0.5 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                    const on = item.value === value;
                    return (
                        <Pressable
                            onPress={() => { onSelect?.(item.value); close(); }}
                            accessibilityRole="button"
                            accessibilityState={{ selected: on }}
                            className="flex-row items-center justify-between h-12 border-b border-line px-1"
                        >
                            <Text weight={on ? 'medium' : 'regular'} tone={on ? 'gold' : 'fg'}>{item.label}</Text>
                            {on ? <Check size={18} color={colors.gold} strokeWidth={ICON_STROKE} /> : null}
                        </Pressable>
                    );
                }}
                ListEmptyComponent={<View className="py-6"><Text tone="fg3" style={{ textAlign: 'center' }}>Sonuç yok</Text></View>}
            />
        </Sheet>
    );
}
