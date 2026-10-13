import React, { useState, useCallback, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, CircleCheck, AlertTriangle, Info, Settings2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { routeForLink } from '../utils/notifications';
import { timeAgo, dayGroup } from '../lib/format';
import { Screen, StackHeader, Text, ListGroup, ListRow, IconBox, EmptyState, colors } from '../components/ui';

// Bildirim türü → simge ve ton (lib/notify.ts: info | success | warning | system)
const TYPE_STYLE = {
    success: { icon: CircleCheck, tone: 'success' },
    warning: { icon: AlertTriangle, tone: 'warning' },
    system: { icon: Settings2, tone: 'info' },
    info: { icon: Bell, tone: 'gold' },
};

const GROUP_ORDER = ['Bugün', 'Bu hafta', 'Daha önce'];

// İki rolde ortak bildirim listesi. Açılınca okunmamışlar web ile aynı uçla okundu işaretlenir (/api/mobile/notifications).
export default function NotificationsScreen({ navigation }) {
    const [items, setItems] = useState([]);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        const [{ data: rows }, { data: me }] = await Promise.all([
            supabase.from('notifications').select('id, title, message, type, link, is_read, created_at')
                .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
            supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
        ]);
        setItems(rows || []);
        setRole(me?.role || null);
        setLoading(false);
        setRefreshing(false);

        // Okunmamışları işaretle; listede okunmamış görünümü bu açılışta korunur
        if ((rows || []).some((n) => !n.is_read)) apiRequest('notifications', { method: 'PATCH', body: {} });
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const groups = useMemo(() => {
        const map = {};
        for (const n of items) (map[dayGroup(n.created_at)] ||= []).push(n);
        return GROUP_ORDER.filter((g) => map[g]?.length).map((g) => [g, map[g]]);
    }, [items]);

    const open = (n) => {
        const target = routeForLink(n.link, role);
        if (target) navigation.navigate(target.name, target.params);
    };

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={<StackHeader title="Bildirimler" onBack={() => navigation.goBack()} />}
        >
            {loading ? (
                <View className="py-16"><ActivityIndicator color={colors.gold} /></View>
            ) : items.length === 0 ? (
                <EmptyState icon={Bell} title="Bildirim yok" text="Teklif, başvuru ve mesajlarla ilgili gelişmeler burada görünür." />
            ) : (
                groups.map(([group, rows]) => (
                    <View key={group} style={{ gap: 8 }}>
                        <Text variant="eyebrow" className="px-1">{group}</Text>
                        <ListGroup>
                            {rows.map((n) => {
                                const s = TYPE_STYLE[n.type] || TYPE_STYLE.info;
                                return (
                                    <ListRow
                                        key={n.id}
                                        onPress={n.link ? () => open(n) : undefined}
                                        left={<IconBox icon={s.icon} tone={s.tone} />}
                                        title={n.title}
                                        subtitle={n.message}
                                        numberOfLines={2}
                                        right={
                                            <View className="items-end" style={{ gap: 6 }}>
                                                <Text variant="caption" tone="fg3">{timeAgo(n.created_at)}</Text>
                                                {!n.is_read ? <View className="w-2 h-2 rounded-full bg-gold" /> : null}
                                            </View>
                                        }
                                    />
                                );
                            })}
                        </ListGroup>
                    </View>
                ))
            )}
        </Screen>
    );
}
