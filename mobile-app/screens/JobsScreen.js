import React, { useState, useCallback, useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Mail, Handshake, MessageCircle, Bell } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { reliabilityText } from '../constants/collaborationWorkspace';
import { formatTRY, formatDate, timeAgo } from '../lib/format';
import {
    Screen, LargeHeader, Text, Button, IconButton, Card, ListGroup, ListRow, Avatar, NameWithTick, Chip, Segment,
    Timeline, EmptyState, Sheet, TextField, KeyValue, colors,
} from '../components/ui';

// İşler: teklifler + iş birlikleri tek ekranda (design/mobile/influencer.html "İşler").
// Teklif işlemleri lib/offers.ts (/api/mobile/offers), iş birliği işlemleri lib/collaborations.ts (/api/mobile/collaborations);
// yetki, doğrulama, sohbet odası ve bildirimler sunucuda.

const OFFER_STATUS = {
    pending: { label: 'Beklemede', tone: 'warning' },
    accepted: { label: 'Kabul edildi', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
    // 7 gün yanıtlanmayan teklif (sunucu 'expired' döner; kabul edilemez).
    expired: { label: 'Süresi doldu', tone: 'neutral' },
};

const COLLAB_STATUS = {
    agreed: { label: 'Anlaşıldı', tone: 'info', stage: 1 },
    in_progress: { label: 'İçerik hazırlanıyor', tone: 'warning', stage: 2 },
    published: { label: 'Yayında, onay bekliyor', tone: 'gold', stage: 3 },
    completed: { label: 'Tamamlandı', tone: 'success', stage: 5 },
    cancelled: { label: 'İptal edildi', tone: 'danger', stage: 0 },
};
const ACTIVE = ['agreed', 'in_progress', 'published'];

// İş birliği kartındaki sıradaki tek eylem (sunucunun izin verdiği eylemlerden)
const NEXT_ACTION = [
    ['approve', 'Onayla ve tamamla'],
    ['publish', 'Yayın linkini gir'],
    ['start', 'İçerik hazırlanıyor'],
];

const nameOf = (p) => p?.full_name || (p?.username ? `@${p.username}` : 'Kullanıcı');

export default function JobsScreen({ navigation, route }) {
    const [segment, setSegment] = useState(route?.params?.segment || 'offers');
    const [role, setRole] = useState(null);
    const [offers, setOffers] = useState([]);
    const [collabs, setCollabs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(null);
    const [showExpired, setShowExpired] = useState(false);
    const [form, setForm] = useState(null); // { item, kind: 'publish' | 'cancel' }
    const [formText, setFormText] = useState('');

    // Bildirimden ya da başka ekrandan belirli bölümle açılabilir
    useEffect(() => {
        if (route?.params?.segment) setSegment(route.params.segment);
    }, [route?.params?.segment]);

    const load = useCallback(async () => {
        const [o, c] = await Promise.all([apiRequest('offers'), apiRequest('collaborations')]);
        if (o.error && c.error) {
            Alert.alert('İşler yüklenemedi', o.error);
        } else {
            setRole(o.role || c.role || null);
            setOffers(o.offers || []);
            setCollabs(c.collaborations || []);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const isBrand = role === 'brand';
    const counterpart = (offer) => (isBrand ? offer.receiver : offer.sender);

    const goToChat = (person, roomId) => {
        setSelected(null);
        navigation.navigate('Mesajlar', {
            openRoomId: roomId,
            partnerName: person?.full_name || person?.username,
            partnerAvatar: person?.avatar_url,
        });
    };

    // ── Teklif işlemleri (lib/offers.ts) ──
    const respond = async (offer, response) => {
        setBusy(`${offer.id}:${response}`);
        const result = await apiRequest(`offers/${offer.id}/respond`, { method: 'POST', body: { response } });
        setBusy(null);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        await load();
        if ((response === 'accepted' || response === 'hold') && result.roomId) {
            goToChat(counterpart(offer), result.roomId);
        } else {
            setSelected(null);
        }
    };

    const confirmReject = (offer) => {
        Alert.alert('Teklifi reddet', 'Bu teklifi reddetmek istediğinize emin misiniz?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Reddet', style: 'destructive', onPress: () => respond(offer, 'rejected') },
        ]);
    };

    // ── İş birliği işlemleri (lib/collaborations.ts) ──
    const run = async (item, action, extra = {}) => {
        setBusy(`${item.id}:${action}`);
        const result = await apiRequest('collaborations', { method: 'POST', body: { id: item.id, action, ...extra } });
        setBusy(null);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        setForm(null);
        setFormText('');
        if (action === 'open_room' && result.roomId) {
            goToChat(item.other, result.roomId);
            return;
        }
        await load();
    };

    const runNext = (item, action) => {
        if (action === 'publish') { setFormText(''); setForm({ item, kind: 'publish' }); return; }
        if (action === 'approve') {
            Alert.alert('İş birliğini onayla', 'Yayın linkini kontrol ettiyseniz iş birliği tamamlanacak.', [
                { text: 'Vazgeç', style: 'cancel' },
                { text: 'Onayla', onPress: () => run(item, 'approve') },
            ]);
            return;
        }
        run(item, action);
    };

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const pendingOffers = offers.filter((o) => o.status === 'pending');
    // Influencer: süresi dolan teklifler işlem listesinden çıkar, isteğe bağlı gösterilir.
    const expiredCount = !isBrand ? offers.filter((o) => o.status === 'expired').length : 0;
    const visibleOffers = !isBrand && !showExpired ? offers.filter((o) => o.status !== 'expired') : offers;
    const activeCollabs = collabs.filter((c) => ACTIVE.includes(c.status));
    const doneCollabs = collabs.filter((c) => !ACTIVE.includes(c.status));

    const segments = [
        { key: 'offers', label: isBrand ? 'Gönderilen' : 'Teklifler', count: pendingOffers.length || undefined },
        { key: 'active', label: 'Aktif', count: activeCollabs.length || undefined },
        { key: 'done', label: 'Tamamlanan' },
    ];

    // ── Teklif kartı: bekleyen teklif (influencer) eylemleri kartın üstünde ──
    const renderPendingOffer = (offer) => {
        const person = counterpart(offer);
        return (
            <Card key={offer.id} onPress={() => setSelected(offer)} style={{ gap: 12 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Avatar name={nameOf(person)} uri={person?.avatar_url} square />
                    <View className="flex-1">
                        <NameWithTick name={nameOf(person)} verified={person?.verification_status === 'verified'} />
                        <Text variant="caption" tone="fg3">{timeAgo(offer.created_at)}</Text>
                    </View>
                    <Chip label="Yeni" tone="gold" />
                </View>
                <View style={{ gap: 6 }}>
                    <Text weight="semibold" style={{ fontSize: 16 }}>{offer.campaign_name || 'İsimsiz teklif'}</Text>
                    {offer.campaign_type ? <Chip label={offer.campaign_type} /> : null}
                </View>
                {offer.message ? (
                    <View className="px-3 py-2.5 rounded-xl bg-s2 border border-line">
                        <Text variant="small" tone="fg2" numberOfLines={3} style={{ fontSize: 14 }}>{offer.message}</Text>
                    </View>
                ) : null}
                <View className="flex-row items-center justify-between">
                    <Text variant="small" tone="fg2">{offer.payment_type === 'barter' ? 'Barter (ürün değeri)' : 'Bütçe'}</Text>
                    <Text weight="semibold" style={{ fontSize: 18 }}>{offer.budget == null ? 'Belirtilmedi' : formatTRY(offer.budget)}</Text>
                </View>
                <Button title="Kabul et" onPress={() => respond(offer, 'accepted')} loading={busy === `${offer.id}:accepted`} disabled={!!busy} block />
                <View className="flex-row" style={{ gap: 8 }}>
                    <View className="flex-1"><Button title="Markayla görüş" variant="secondary" size="md" onPress={() => respond(offer, 'hold')} loading={busy === `${offer.id}:hold`} disabled={!!busy} block /></View>
                    <View className="flex-1"><Button title="Reddet" variant="danger" size="md" onPress={() => confirmReject(offer)} loading={busy === `${offer.id}:rejected`} disabled={!!busy} block /></View>
                </View>
            </Card>
        );
    };

    const renderOfferRow = (offer) => {
        const person = counterpart(offer);
        const s = OFFER_STATUS[offer.status] || OFFER_STATUS.pending;
        return (
            <ListRow
                key={offer.id}
                onPress={() => setSelected(offer)}
                left={<Avatar name={nameOf(person)} uri={person?.avatar_url} square />}
                title={offer.campaign_name || 'İsimsiz teklif'}
                subtitle={`${nameOf(person)} · ${offer.budget == null ? 'Bütçe yok' : formatTRY(offer.budget)}`}
                right={<Chip label={s.label} tone={s.tone} />}
            />
        );
    };

    const renderOffers = () => {
        if (!visibleOffers.length && !expiredCount) {
            return (
                <Card padded={false}>
                    <EmptyState
                        icon={Mail}
                        title="Henüz teklif yok"
                        text={isBrand ? 'Keşfet\'ten bir influencer profilini açıp teklif gönderebilirsin.' : 'Markalar sana teklif gönderdiğinde burada görünür.'}
                        action={isBrand ? <Button title="Keşfet'e git" variant="secondary" size="md" onPress={() => navigation.navigate('Keşfet')} /> : null}
                    />
                </Card>
            );
        }
        const actionable = !isBrand ? visibleOffers.filter((o) => o.status === 'pending') : [];
        const rest = visibleOffers.filter((o) => !actionable.includes(o));
        return (
            <>
                {actionable.map(renderPendingOffer)}
                {rest.length ? <ListGroup>{rest.map(renderOfferRow)}</ListGroup> : null}
                {expiredCount > 0 ? (
                    <Button
                        title={showExpired ? 'Süresi dolan teklifleri gizle' : `Süresi dolan teklifleri göster (${expiredCount})`}
                        variant="ghost" size="md" onPress={() => setShowExpired((v) => !v)} block
                    />
                ) : null}
            </>
        );
    };

    // ── Aktif iş birliği kartı ──
    const renderActive = (item) => {
        const s = COLLAB_STATUS[item.status] || COLLAB_STATUS.agreed;
        const next = NEXT_ACTION.find(([a]) => item.actions?.includes(a));
        return (
            <Card key={item.id} onPress={() => navigation.navigate('CollaborationDetail', { id: item.id })} style={{ gap: 12 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Avatar name={nameOf(item.other)} uri={item.other?.avatar_url} square />
                    <View className="flex-1">
                        <Text weight="semibold" numberOfLines={1}>{item.title}</Text>
                        <Text variant="caption" tone="fg3" numberOfLines={1}>{nameOf(item.other)} · {item.source === 'offer' ? 'Teklif' : 'İlan başvurusu'}</Text>
                    </View>
                    <Chip label={s.label} tone={s.tone} />
                </View>
                <Timeline stage={s.stage} />
                {item.auto_complete_at ? (
                    <Text variant="caption" tone="fg3">
                        {isBrand
                            ? `Onaylamazsanız ${formatDate(item.auto_complete_at)} tarihinde otomatik tamamlanır.`
                            : `Marka yanıt vermezse ${formatDate(item.auto_complete_at)} tarihinde otomatik tamamlanır.`}
                    </Text>
                ) : null}
                {item.deliverable_total > 0 ? (
                    <Text variant="caption" tone="fg2">Teslimat: {item.deliverable_published} / {item.deliverable_total} yayınlandı</Text>
                ) : null}
                <View className="flex-row" style={{ gap: 8 }}>
                    {item.room_id || item.actions?.includes('open_room') ? (
                        <Button
                            title="Sohbet" icon={MessageCircle} variant="secondary" size="md"
                            onPress={() => (item.room_id ? goToChat(item.other, item.room_id) : run(item, 'open_room'))}
                            loading={busy === `${item.id}:open_room`}
                        />
                    ) : null}
                    {next ? (
                        <View className="flex-1"><Button title={next[1]} size="md" onPress={() => runNext(item, next[0])} loading={busy === `${item.id}:${next[0]}`} disabled={!!busy} block /></View>
                    ) : null}
                </View>
                {item.actions?.includes('cancel') ? (
                    <Text variant="caption" tone="fg3" onPress={() => { setFormText(''); setForm({ item, kind: 'cancel' }); }} suppressHighlighting>İş birliğini iptal et</Text>
                ) : null}
            </Card>
        );
    };

    const renderDone = () => {
        if (!doneCollabs.length) {
            return <Card padded={false}><EmptyState icon={Handshake} title="Tamamlanan iş yok" text="Biten ve iptal edilen iş birlikleri burada listelenir." /></Card>;
        }
        return (
            <ListGroup>
                {doneCollabs.map((item) => {
                    const s = COLLAB_STATUS[item.status] || COLLAB_STATUS.completed;
                    const when = item.completed_at || item.cancelled_at;
                    return (
                        <ListRow
                            key={item.id}
                            onPress={() => navigation.navigate('CollaborationDetail', { id: item.id })}
                            left={<Avatar name={nameOf(item.other)} uri={item.other?.avatar_url} square />}
                            title={item.title}
                            subtitle={`${nameOf(item.other)}${when ? ` · ${formatDate(when)}` : ''}${item.auto_completed ? ' (otomatik)' : ''}`}
                            right={<Chip label={s.label} tone={s.tone} />}
                        />
                    );
                })}
            </ListGroup>
        );
    };

    const sel = selected;
    const selPerson = sel ? counterpart(sel) : null;
    const selStatus = sel ? OFFER_STATUS[sel.status] || OFFER_STATUS.pending : null;

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={<LargeHeader title="İşler" right={<IconButton icon={Bell} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Bildirimler" />} />}
        >
            <Segment options={segments} value={segment} onChange={setSegment} />

            {segment === 'offers' ? renderOffers() : null}
            {segment === 'active' ? (
                activeCollabs.length ? activeCollabs.map(renderActive) : (
                    <Card padded={false}><EmptyState icon={Handshake} title="Süren iş yok" text="Bir teklif veya ilan başvurusu kabul edildiğinde iş burada başlar." /></Card>
                )
            ) : null}
            {segment === 'done' ? renderDone() : null}

            {/* Teklif ayrıntısı */}
            <Sheet visible={!!sel} onClose={() => setSelected(null)} title={sel?.campaign_name || 'İsimsiz teklif'} headerRight={selStatus ? <Chip label={selStatus.label} tone={selStatus.tone} /> : null} scroll>
                {sel ? (
                    <>
                        <View className="flex-row items-center" style={{ gap: 12 }}>
                            <Avatar name={nameOf(selPerson)} uri={selPerson?.avatar_url} square />
                            <View className="flex-1">
                                <Text variant="caption" tone="fg3">{isBrand ? 'Alıcı' : 'Gönderen'}</Text>
                                <NameWithTick name={nameOf(selPerson)} verified={selPerson?.verification_status === 'verified'} />
                            </View>
                        </View>
                        {sel.sender_reliability ? (
                            <Text variant="small" tone="fg2">Marka geçmişi: {reliabilityText(sel.sender_reliability.completed, sel.sender_reliability.confirmed)}</Text>
                        ) : null}
                        <Card padded={false} className="px-4">
                            {sel.campaign_type ? <KeyValue label="Tür" value={sel.campaign_type} /> : null}
                            <KeyValue label={sel.payment_type === 'barter' ? 'Barter (ürün değeri)' : 'Bütçe (nakit)'} value={sel.budget == null ? 'Belirtilmedi' : formatTRY(sel.budget)} />
                            <KeyValue label="Gönderildi" value={formatDate(sel.created_at)} last />
                        </Card>
                        {sel.message ? <Text tone="fg2" style={{ fontSize: 14.5 }}>{sel.message}</Text> : null}
                        {sel.status === 'expired' ? (
                            <Text variant="small" tone="fg3">
                                {isBrand
                                    ? 'Teklif 7 gün içinde yanıtlanmadığı için süresi doldu. Başka bir influencer\'a gönderebilirsiniz.'
                                    : 'Bu teklif 7 gün içinde yanıtlanmadığı için artık yanıtlanamaz.'}
                            </Text>
                        ) : null}
                        {!isBrand && sel.status === 'pending' ? (
                            <>
                                <Button title="Kabul et" onPress={() => respond(sel, 'accepted')} loading={busy === `${sel.id}:accepted`} disabled={!!busy} block />
                                <View className="flex-row" style={{ gap: 8 }}>
                                    <View className="flex-1"><Button title="Markayla görüş" variant="secondary" size="md" onPress={() => respond(sel, 'hold')} loading={busy === `${sel.id}:hold`} disabled={!!busy} block /></View>
                                    <View className="flex-1"><Button title="Reddet" variant="danger" size="md" onPress={() => confirmReject(sel)} disabled={!!busy} block /></View>
                                </View>
                            </>
                        ) : null}
                        {sel.room_id ? <Button title="Sohbete git" icon={MessageCircle} variant={!isBrand && sel.status === 'pending' ? 'ghost' : 'primary'} onPress={() => goToChat(selPerson, sel.room_id)} block /> : null}
                    </>
                ) : null}
            </Sheet>

            {/* Yayın linki / iptal gerekçesi */}
            <Sheet visible={!!form} onClose={() => setForm(null)} title={form?.kind === 'publish' ? 'Yayın linki' : 'İş birliğini iptal et'}>
                {form ? (
                    <>
                        <Text variant="small" tone="fg2">
                            {form.kind === 'publish'
                                ? 'Instagram, TikTok veya YouTube linki. Marka onayladığında iş birliği tamamlanır.'
                                : 'Gerekçe isteğe bağlıdır ve karşı tarafa iletilir.'}
                        </Text>
                        <TextField
                            value={formText}
                            onChangeText={setFormText}
                            placeholder={form.kind === 'publish' ? 'https://www.instagram.com/p/...' : 'Gerekçe (isteğe bağlı)'}
                            autoCapitalize={form.kind === 'publish' ? 'none' : 'sentences'}
                            autoCorrect={form.kind !== 'publish'}
                            keyboardType={form.kind === 'publish' ? 'url' : 'default'}
                            multiline={form.kind === 'cancel'}
                            maxLength={500}
                        />
                        <Button
                            title={form.kind === 'publish' ? 'Gönder' : 'İptal et'}
                            variant={form.kind === 'publish' ? 'primary' : 'danger'}
                            loading={busy === `${form.item.id}:${form.kind}`}
                            onPress={() => run(form.item, form.kind, form.kind === 'publish' ? { url: formText.trim() } : { reason: formText.trim() })}
                            block
                        />
                    </>
                ) : null}
            </Sheet>
        </Screen>
    );
}
