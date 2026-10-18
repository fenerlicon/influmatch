import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ShieldAlert } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { Sheet, Text, Button, colors } from './ui';

// Admin duyurusu (web lib/admin-notices-shared.ts ile aynı kural): bağlantısında "duyuru=" olan okunmamış bildirim,
// ana sayfaya girişte pencere olarak açılır; "Anladım" okundu işaretler (web ile aynı uç), bir daha açılmaz.
const ADMIN_NOTICE_PARAM = 'duyuru';

const formatDate = (value) =>
    new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function AdminNoticeSheet() {
    const [queue, setQueue] = useState([]);
    const [busy, setBusy] = useState(false);

    useFocusEffect(useCallback(() => {
        let active = true;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase
                .from('notifications')
                .select('id, title, message, created_at')
                .eq('user_id', user.id)
                .eq('is_read', false)
                .like('link', `%${ADMIN_NOTICE_PARAM}=%`)
                .order('created_at', { ascending: true })
                .limit(5);
            if (active) setQueue(data || []);
        })();
        return () => { active = false; };
    }, []));

    const current = queue[0];
    if (!current) return null;

    const acknowledge = async () => {
        setBusy(true);
        await apiRequest('notifications', { method: 'PATCH', body: { ids: [current.id] } });
        setBusy(false);
        setQueue((prev) => prev.slice(1));
    };

    return (
        <Sheet visible onClose={acknowledge} title={current.title}>
            <View className="flex-row items-center" style={{ gap: 10 }}>
                <View className="w-9 h-9 rounded-[10px] items-center justify-center bg-warning-soft">
                    <ShieldAlert size={18} color={colors.warning} />
                </View>
                <Text variant="caption" tone="fg3">{formatDate(current.created_at)}</Text>
            </View>
            <Text style={{ lineHeight: 22 }}>{current.message}</Text>
            <Text variant="small" tone="fg2">Bir yanlışlık olduğunu düşünüyorsan Ayarlar → Destek'ten bize yazabilirsin.</Text>
            <Button title={queue.length > 1 ? `Anladım (${queue.length - 1} duyuru daha)` : 'Anladım'} onPress={acknowledge} loading={busy} block />
        </Sheet>
    );
}
