import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Coins, Gift, Copy } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { INFLUCASH_RULE_NOTE, itemDetail } from '../constants/influcash';
import { Screen, StackHeader, Section, Text, Button, Card, Chip, StatCard, EmptyState, Notice, colors } from '../components/ui';

const fmtDate = (v) => new Date(v).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const pts = (n) => Number(n || 0).toLocaleString('tr-TR');

/**
 * Influcash (2026-11-23; web /dashboard/influcash ile aynı): bakiye, ödül kataloğu, nasıl kazanılır, alınan ödüller, geçmiş.
 * Bütün kurallar sunucuda (/api/mobile/influcash, lib/influcash.ts). Özellik kapalıysa ekran bunu söyler.
 */
export default function InflucashScreen({ navigation }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(null);

    const load = useCallback(async () => {
        const result = await apiRequest('influcash');
        setRefreshing(false);
        if (result.error) return setError(result.error);
        setError(null);
        setData(result);
    }, []);
    useFocusEffect(useCallback(() => { load(); }, [load]));

    const redeem = (item) =>
        Alert.alert('Ödülü al', `${item.title} için ${pts(item.cost)} Influcash puanı harcanacak. Bu işlem geri alınamaz.`, [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Puanla al',
                onPress: async () => {
                    setBusy(item.id);
                    const result = await apiRequest('influcash', { method: 'POST', body: { itemId: item.id } });
                    setBusy(null);
                    if (result.error) return Alert.alert('Alınamadı', result.error);
                    Alert.alert('Ödül alındı', result.message || 'Ödül alındı.');
                    load();
                },
            },
        ]);

    const o = data?.overview;
    const r = o?.rules;
    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={<StackHeader title="Influcash" onBack={() => navigation.goBack()} />}
        >
            {error ? <Text tone="danger" variant="small">{error}</Text> : null}
            {!data ? <ActivityIndicator color={colors.gold} /> : null}
            {data && !data.enabled ? <EmptyState icon={Coins} title="Influcash şu an kapalı" text="Açıldığında puanların burada görünecek." /> : null}
            {o ? (
                <>
                    <View className="flex-row" style={{ gap: 8 }}>
                        <StatCard label="Bakiye" value={`${pts(o.spendable)} puan`} />
                        <StatCard label="Alınan ödül" value={String(o.redemptions.length)} />
                    </View>
                    <Notice tone="info" icon={Coins} text={`${INFLUCASH_RULE_NOTE} Günlük giriş ve seri ödülünden ayda en fazla ${r.daily_monthly_cap} puan kazanılır. İptal edilen iş birliğinin ya da haklı bulunan bir bildirimin puanları geri alınır.`} />

                    <Section title="Ödüller">
                        {o.catalog.length === 0 ? <EmptyState icon={Gift} title="Şu an ödül yok" /> : null}
                        {o.catalog.map((i) => (
                            <Card key={i.id} style={{ gap: 8 }}>
                                <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                                    <Text weight="semibold" style={{ flex: 1 }}>{i.title}</Text>
                                    <Chip label={`${pts(i.cost)} puan`} tone="gold" />
                                </View>
                                <Text variant="small" tone="fg2">{itemDetail(i)}</Text>
                                {i.description ? <Text variant="caption" tone="fg3">{i.description}</Text> : null}
                                {i.stock !== null ? <Text variant="caption" tone="fg3">Kalan: {i.stock}</Text> : null}
                                <Button title="Puanla al" size="sm" disabled={!!i.blocker || !!busy} loading={busy === i.id} onPress={() => redeem(i)} />
                                {i.blocker ? <Text variant="caption" tone="fg3">{i.blocker}</Text> : null}
                            </Card>
                        ))}
                        {!o.salesOpen ? <Text variant="caption" tone="fg3">Spotlight günü ödülleri satış başlayınca hesabına işlenir; indirim kodları ödeme sayfasında kullanılır.</Text> : null}
                    </Section>

                    <Section title="Nasıl kazanılır">
                        <Card style={{ gap: 6 }}>
                            {[
                                ['Tamamlanan iş birliği (iki taraf ödemeyi teyit edince)', r.collab_completed],
                                ['Zamanında teslim (teslimat başına) / zamanında ödeme', `${r.ontime_delivery} / ${r.ontime_payment}`],
                                ['Günlük giriş', r.daily_login],
                                ['7 / 30 günlük seri', `${r.streak_7} / ${r.streak_30}`],
                                ['Onaylanan görev', `${Math.min(r.task_other, r.task_story_link)}–${Math.max(r.task_promo_video, r.task_invites, r.task_other)}`],
                                ['Profilini tamamlamak (bir kez)', r.profile_complete],
                                ['Hesabının doğrulanması (bir kez)', r.account_verified],
                            ].map(([label, amount]) => (
                                <View key={label} className="flex-row justify-between" style={{ gap: 8 }}>
                                    <Text variant="small" tone="fg2" style={{ flex: 1 }}>{label}</Text>
                                    <Text variant="small" weight="semibold">{String(amount)}</Text>
                                </View>
                            ))}
                        </Card>
                    </Section>

                    {o.redemptions.length ? (
                        <Section title="Alınan ödüller">
                            {o.redemptions.map((x) => (
                                <Card key={x.id} style={{ gap: 4 }}>
                                    <Text variant="small">{x.title} · {pts(x.cost)} puan · {fmtDate(x.createdAt)}</Text>
                                    {x.code ? (
                                        <View className="flex-row items-center" style={{ gap: 8 }}>
                                            <Text weight="semibold" tone="gold">{x.code}</Text>
                                            <Button title="Kopyala" icon={Copy} size="sm" variant="ghost" onPress={() => Clipboard.setStringAsync(x.code)} />
                                        </View>
                                    ) : null}
                                    {x.status ? <Text variant="caption" tone="fg3">{x.status}</Text> : null}
                                </Card>
                            ))}
                        </Section>
                    ) : null}

                    <Section title="Geçmiş">
                        {o.history.length === 0 ? <Text variant="small" tone="fg3">Henüz hareket yok.</Text> : null}
                        {o.history.map((h) => (
                            <View key={h.id} className="flex-row justify-between py-1.5 border-b border-line" style={{ gap: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="small">{h.label}{h.note ? ` · ${h.note}` : ''}</Text>
                                    <Text variant="caption" tone="fg3">{fmtDate(h.createdAt)}</Text>
                                </View>
                                <Text variant="small" weight="semibold" tone={h.amount > 0 ? 'success' : 'danger'}>{h.amount > 0 ? '+' : ''}{pts(h.amount)}</Text>
                            </View>
                        ))}
                    </Section>
                </>
            ) : null}
        </Screen>
    );
}
