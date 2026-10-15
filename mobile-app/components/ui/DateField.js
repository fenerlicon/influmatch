import React, { useMemo, useState } from 'react';
import { View, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react-native';
import Text from './Text';
import Button from './Button';
import Sheet from './Sheet';
import { SelectField } from './Form';
import { colors, ICON_STROKE } from './theme';

// Tarih seçici (3.19-S2): ek yerel paket gerektirmeyen ay takvimi. Değer her zaman YYYY-AA-GG (sunucunun beklediği biçim)
// ya da boş metin. min / max (YYYY-AA-GG) dışındaki günler seçilemez. Takvim haftası pazartesi başlar.

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
    return { y, m: m - 1, d };
}

function todayIso() {
    const now = new Date();
    return isoOf(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "30 Kasım 2026" */
export function formatDateTr(value) {
    const p = parseIso(value);
    return p ? `${p.d} ${MONTHS[p.m]} ${p.y}` : '';
}

export default function DateField({ label, hint, value, onChange, min, max, placeholder = 'Tarih seç', clearable = true }) {
    const [open, setOpen] = useState(false);
    const initial = parseIso(value) || parseIso(min) || parseIso(todayIso());
    const [view, setView] = useState({ y: initial.y, m: initial.m });

    const openPicker = () => {
        const start = parseIso(value) || parseIso(min) || parseIso(todayIso());
        setView({ y: start.y, m: start.m });
        setOpen(true);
    };

    const cells = useMemo(() => {
        const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay(); // 0 = pazar
        const offset = (first + 6) % 7;
        const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
        const list = Array.from({ length: offset }, () => null);
        for (let d = 1; d <= days; d++) list.push(d);
        while (list.length % 7) list.push(null);
        return list;
    }, [view]);

    const shift = (delta) => setView((v) => {
        const m = v.m + delta;
        return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });

    const today = todayIso();
    const disabled = (iso) => (min && iso < min) || (max && iso > max);

    return (
        <>
            <SelectField label={label} hint={hint} icon={Calendar} value={formatDateTr(value)} placeholder={placeholder} onPress={openPicker} />
            <Sheet visible={open} onClose={() => setOpen(false)} title={label || 'Tarih seç'}>
                <View className="flex-row items-center justify-between">
                    <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Önceki ay">
                        <ChevronLeft size={22} color={colors.fg2} strokeWidth={ICON_STROKE} />
                    </Pressable>
                    <Text weight="semibold">{`${MONTHS[view.m]} ${view.y}`}</Text>
                    <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Sonraki ay">
                        <ChevronRight size={22} color={colors.fg2} strokeWidth={ICON_STROKE} />
                    </Pressable>
                </View>
                <View>
                    <View className="flex-row">
                        {WEEKDAYS.map((w) => (
                            <View key={w} style={{ width: `${100 / 7}%` }} className="items-center py-1">
                                <Text variant="small" tone="fg3">{w}</Text>
                            </View>
                        ))}
                    </View>
                    <View className="flex-row flex-wrap">
                        {cells.map((d, i) => {
                            if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
                            const iso = isoOf(view.y, view.m, d);
                            const selected = iso === value;
                            const off = disabled(iso);
                            return (
                                <View key={iso} style={{ width: `${100 / 7}%`, height: 42 }} className="items-center justify-center">
                                    <Pressable
                                        disabled={!!off}
                                        onPress={() => {
                                            onChange(iso);
                                            setOpen(false);
                                        }}
                                        accessibilityRole="button"
                                        accessibilityLabel={formatDateTr(iso)}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: selected ? colors.gold : 'transparent',
                                            borderWidth: iso === today && !selected ? 1 : 0,
                                            borderColor: colors.goldLine,
                                        }}
                                    >
                                        <Text style={{ color: selected ? colors.goldInk : off ? colors.fg3 : colors.fg, opacity: off ? 0.4 : 1 }}>{d}</Text>
                                    </Pressable>
                                </View>
                            );
                        })}
                    </View>
                </View>
                {clearable && value ? (
                    <Button
                        title="Tarihi temizle"
                        variant="secondary"
                        onPress={() => {
                            onChange('');
                            setOpen(false);
                        }}
                        block
                    />
                ) : null}
            </Sheet>
        </>
    );
}
