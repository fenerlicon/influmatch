import React, { useState, useCallback, useMemo } from 'react';
import { View, ActivityIndicator, Alert, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { UserPlus, Pencil, Link2, Users, Lock, Check } from 'lucide-react-native';
import { apiRequest } from '../../lib/api';
import CampaignBrief from '../../components/CampaignBrief';
import CampaignFormSheet from '../../components/CampaignFormSheet';
import { influencerCategoryLabel } from '../../constants/categories';
import {
    CAMPAIGN_LIMITS, CAMPAIGN_OFFER_STATUS, CAMPAIGN_OPEN_STATUSES, CAMPAIGN_STATUSES, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_TONES,
    COLLAB_STATUS_LABELS, formatFollowers, formatTry,
} from '../../constants/campaigns';
import {
    Screen, StackHeader, Section, Text, Button, Card, ListGroup, ListRow, Avatar, Chip, EmptyState, Notice, Sheet, TextField, Segment,
    FilterChip, ChipRow, StatCard, OptionSheet, colors, ICON_STROKE,
} from '../../components/ui';

// Kampanya panosu (3.19): profiller, teklif / iş birliği / teslimat / ödeme durumu, bütçe özeti, toplu davet ve bağlama.
// Bütün kurallar sunucuda (/api/mobile/campaigns/[id] → lib/campaigns.ts); davetler lib/offers.ts createOfferAs ile gider.

const PRO_TEXT = 'Kampanya önerileri ve toplu davet Spotlight Pro markalara özel. Profilleri tek tek ekleyebilirsin: keşifte bir profil aç, teklif formunda bu kampanyayı seç.';

function rowSubtitle(r) {
    const parts = [];
    if (r.collaboration_status) parts.push(COLLAB_STATUS_LABELS[r.collaboration_status] || r.collaboration_status);
    if (r.collaboration_id && r.deliverables_total) parts.push(`${r.deliverables_published}/${r.deliverables_total} yayında`);
    if (r.agreed_fee != null) parts.push(`${formatTry(r.agreed_fee)}${r.payment_type === 'barter' ? ' barter' : ''}`);
    if (r.collaboration_id) parts.push(r.influencer_confirmed ? 'ödeme teyitli' : r.brand_paid ? 'ödeme işaretli' : 'ödeme bekliyor');
    if (r.source === 'application') parts.unshift(`İlan: ${r.advert_title || ''}`);
    return parts.join(' · ') || 'Yanıt bekleniyor';
}

function InviteSheet({ visible, onClose, campaign, bulkInvite, quotaText, onDone }) {
    const [suggestions, setSuggestions] = useState(null);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState([]);
    const [availableOnly, setAvailableOnly] = useState(false);
    const [step, setStep] = useState('pick');
    const [form, setForm] = useState({ campaignType: '', paymentType: 'cash', budget: '', message: '' });
    const [sending, setSending] = useState(false);
    const limit = bulkInvite ? CAMPAIGN_LIMITS.inviteMax : 1;

    React.useEffect(() => {
        if (!visible || suggestions !== null) return;
        apiRequest(`campaigns/${encodeURIComponent(campaign.id)}?view=suggestions`).then((result) => {
            if (result.error) setError(result.error);
            setSuggestions(result.suggestions || []);
        });
    }, [visible, suggestions, campaign.id]);

    const byId = useMemo(() => new Map((suggestions || []).map((s) => [s.id, s])), [suggestions]);
    const nameOf = (id) => byId.get(id)?.full_name || (byId.get(id)?.username ? `@${byId.get(id).username}` : 'Profil');
    const shown = (suggestions || []).filter((s) => !availableOnly || s.availability?.status !== 'busy');
    const busySelected = selected.filter((id) => byId.get(id)?.availability?.status === 'busy');

    const toggle = (id) => setSelected((list) => (list.includes(id) ? list.filter((v) => v !== id) : list.length >= limit ? (limit === 1 ? [id] : list) : [...list, id]));

    const send = async () => {
        if (!form.budget) return Alert.alert('Eksik bilgi', 'Kişi başı bütçeyi yazın.');
        setSending(true);
        const result = await apiRequest(`campaigns/${encodeURIComponent(campaign.id)}`, {
            method: 'POST',
            body: { action: 'invite', creatorIds: selected, ...form },
        });
        setSending(false);
        if (result.error) return Alert.alert('Davet gönderilemedi', result.error);
        const o = result.outcome || { sent: [], failed: [], skipped: [], notAttempted: [] };
        const lines = [];
        if (o.sent.length) lines.push(`${o.sent.length} profile davet gönderildi.`);
        if (o.quotaError) lines.push(o.quotaError);
        o.failed.filter((f) => f.error !== o.quotaError).forEach((f) => lines.push(`${nameOf(f.id)}: ${f.error}`));
        if (o.notAttempted.length) lines.push(`Denenmeyenler: ${o.notAttempted.map(nameOf).join(', ')}`);
        if (o.skipped.length) lines.push(`Zaten teklifi olanlar: ${o.skipped.map((s) => nameOf(s.id)).join(', ')}`);
        Alert.alert('Davet sonucu', lines.join('\n') || 'Gönderim yapılmadı.');
        onDone();
    };

    return (
        <Sheet visible={visible} onClose={onClose} title={step === 'pick' ? 'Önerilen profiller' : 'Davet'} scroll>
            {step === 'pick' ? (
                <>
                    <Text variant="small" tone="fg2">
                        {bulkInvite ? `Hedefe uyan doğrulanmış profiller (müsait olanlar önce). En fazla ${CAMPAIGN_LIMITS.inviteMax} profil.` : 'Tek seferde bir profil davet edebilirsin.'}
                    </Text>
                    <FilterChip label="Yalnızca iş alanlar" selected={availableOnly} onPress={() => setAvailableOnly((v) => !v)} />
                    {error ? <Text tone="danger" variant="small">{error}</Text> : null}
                    {suggestions === null ? <ActivityIndicator color={colors.gold} /> : null}
                    {suggestions && !shown.length && !error ? <Text variant="small" tone="fg3">Hedefe uyan profil bulunamadı; kampanyayı düzenleyip hedefi genişletebilirsin.</Text> : null}
                    {shown.length ? (
                        <ListGroup>
                            {shown.map((s) => {
                                const on = selected.includes(s.id);
                                const name = s.full_name || s.username || 'Profil';
                                return (
                                    <ListRow
                                        key={s.id}
                                        onPress={s.already_invited ? undefined : () => toggle(s.id)}
                                        left={<Avatar name={name} uri={s.avatar_url} />}
                                        title={name}
                                        numberOfLines={2}
                                        subtitle={[
                                            influencerCategoryLabel(s.category),
                                            `${formatFollowers(s.followers)} takipçi`,
                                            s.starting_price != null ? `${formatTry(s.starting_price)}'den${s.fits_budget === false ? ' (bütçe üstü)' : ''}` : 'fiyat kartı yok',
                                            s.availability?.status === 'busy' ? 'şu an dolu' : null,
                                            s.already_invited ? 'davet edildi' : null,
                                        ].filter(Boolean).join(' · ')}
                                        right={
                                            <View className={`w-6 h-6 rounded-md border items-center justify-center ${on ? 'bg-gold border-gold' : 'border-line-strong'}`}>
                                                {on ? <Check size={14} color={colors.goldInk} strokeWidth={ICON_STROKE} /> : null}
                                            </View>
                                        }
                                    />
                                );
                            })}
                        </ListGroup>
                    ) : null}
                    <Button title={selected.length ? `${selected.length} profil seçildi · devam` : 'Profil seç'} disabled={!selected.length} onPress={() => setStep('form')} block />
                </>
            ) : (
                <>
                    {quotaText ? <Notice tone="gold" text={`${quotaText} Her davet bir teklif hakkı kullanır.`} /> : null}
                    {busySelected.length ? <Notice tone="warning" text={`${busySelected.map(nameOf).join(', ')} şu an yeni iş almadığını belirtti. Davet yine gönderilebilir.`} /> : null}
                    <Text variant="small" tone="fg2">Teklif başlığı: “{campaign.name}”. Brief teklifte ayrıca görünür.</Text>
                    <TextField label="İçerik türü" value={form.campaignType} onChangeText={(v) => setForm((f) => ({ ...f, campaignType: v }))} placeholder="ör. Reel" />
                    <Segment options={[{ key: 'cash', label: 'Nakit' }, { key: 'barter', label: 'Barter' }]} value={form.paymentType} onChange={(v) => setForm((f) => ({ ...f, paymentType: v }))} />
                    <TextField label={form.paymentType === 'barter' ? 'Ürün değeri (kişi başı)' : 'Bütçe (kişi başı)'} prefix="₺" keyboardType="number-pad" value={form.budget} onChangeText={(v) => setForm((f) => ({ ...f, budget: v.replace(/[^0-9]/g, '').slice(0, 9) }))} />
                    <TextField label="Mesaj" multiline maxLength={2000} value={form.message} onChangeText={(v) => setForm((f) => ({ ...f, message: v }))} />
                    <View className="flex-row" style={{ gap: 8 }}>
                        <View className="flex-1"><Button title="Geri" variant="secondary" onPress={() => setStep('pick')} block /></View>
                        <View className="flex-1"><Button title="Davet gönder" onPress={send} loading={sending} block /></View>
                    </View>
                </>
            )}
        </Sheet>
    );
}

function LinkSheet({ visible, onClose, campaignId, onDone }) {
    const [data, setData] = useState(null);
    React.useEffect(() => {
        if (!visible || data) return;
        apiRequest(`campaigns/${encodeURIComponent(campaignId)}?view=attachables`).then((r) => setData(r.error ? { offers: [], adverts: [], error: r.error } : r));
    }, [visible, data, campaignId]);

    const link = async (kind, id) => {
        const result = await apiRequest(`campaigns/${encodeURIComponent(campaignId)}`, { method: 'POST', body: { action: 'link', kind, id, attach: true } });
        if (result.error) return Alert.alert('Bağlanamadı', result.error);
        onDone();
    };

    return (
        <Sheet visible={visible} onClose={onClose} title="Teklif ya da ilan bağla" scroll>
            <Text variant="small" tone="fg2">Bağlı ilandan kabul ettiğin başvurular da kampanya panosunda görünür.</Text>
            {!data ? <ActivityIndicator color={colors.gold} /> : null}
            {data?.error ? <Text tone="danger" variant="small">{data.error}</Text> : null}
            {data ? (
                <>
                    <Text variant="eyebrow">Teklifler</Text>
                    {data.offers?.length ? (
                        <ListGroup>
                            {data.offers.map((o) => (
                                <ListRow key={o.id} title={o.receiver_name || 'Profil'} subtitle={`${o.campaign_name || 'Teklif'} · ${CAMPAIGN_OFFER_STATUS[o.status]?.label || o.status}`} onPress={() => link('offer', o.id)} chevron />
                            ))}
                        </ListGroup>
                    ) : <Text variant="small" tone="fg3">Bağlanabilecek teklif yok.</Text>}
                    <Text variant="eyebrow">İlanlar</Text>
                    {data.adverts?.length ? (
                        <ListGroup>
                            {data.adverts.map((a) => <ListRow key={a.id} title={a.title} onPress={() => link('advert', a.id)} chevron />)}
                        </ListGroup>
                    ) : <Text variant="small" tone="fg3">Bağlanabilecek ilan yok.</Text>}
                </>
            ) : null}
        </Sheet>
    );
}

export default function CampaignDetailScreen({ navigation, route }) {
    const campaignId = route.params?.campaignId;
    const [state, setState] = useState(null);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [sheet, setSheet] = useState(null); // 'invite' | 'edit' | 'link' | 'status'

    const load = useCallback(async () => {
        const result = await apiRequest(`campaigns/${encodeURIComponent(campaignId)}`);
        setRefreshing(false);
        if (result.error) return setError(result.error);
        setError(null);
        setState(result);
    }, [campaignId]);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const changeStatus = async (status) => {
        const result = await apiRequest(`campaigns/${encodeURIComponent(campaignId)}`, { method: 'POST', body: { action: 'status', status } });
        if (result.error) return Alert.alert('Durum değiştirilemedi', result.error);
        load();
    };

    const detach = (offerId) =>
        Alert.alert('Kampanyadan çıkar', 'Teklif silinmez, yalnızca bu kampanyadan çıkar.', [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Çıkar', style: 'destructive', onPress: async () => {
                    const result = await apiRequest(`campaigns/${encodeURIComponent(campaignId)}`, { method: 'POST', body: { action: 'link', kind: 'offer', id: offerId, attach: false } });
                    if (result.error) return Alert.alert('Çıkarılamadı', result.error);
                    load();
                },
            },
        ]);

    if (!state) {
        return (
            <Screen header={<StackHeader title="Kampanya" onBack={() => navigation.goBack()} />}>
                {error ? <Text tone="danger">{error}</Text> : <ActivityIndicator color={colors.gold} />}
            </Screen>
        );
    }

    const { dashboard, features, quotaText } = state;
    const { campaign, rows, summary, adverts } = dashboard;
    const open = CAMPAIGN_OPEN_STATUSES.includes(campaign.status);
    const remaining = summary.total_budget != null ? summary.total_budget - summary.committed : null;

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={<StackHeader title="Kampanya" onBack={() => navigation.goBack()} />}
        >
            <View style={{ gap: 6 }}>
                <Text variant="title">{campaign.name}</Text>
                <Pressable onPress={() => setSheet('status')} accessibilityRole="button" accessibilityLabel="Kampanya durumunu değiştir">
                    <Chip label={`${CAMPAIGN_STATUS_LABELS[campaign.status]} · değiştir`} tone={CAMPAIGN_STATUS_TONES[campaign.status]} />
                </Pressable>
            </View>

            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                <View style={{ width: '48%' }}><StatCard label="Toplam bütçe" value={formatTry(summary.total_budget)} hint={remaining != null ? `Kalan ${formatTry(remaining)}` : 'Belirlenmedi'} /></View>
                <View style={{ width: '48%' }}><StatCard label="Anlaşılan" value={formatTry(summary.committed)} hint={`${summary.collaborations} iş birliği`} /></View>
                <View style={{ width: '48%' }}><StatCard label="Ödendi (teyitli)" value={formatTry(summary.confirmed_paid)} hint={`İşaretli ${formatTry(summary.marked_paid)}`} /></View>
                <View style={{ width: '48%' }}><StatCard label="Davet" value={String(summary.invited)} hint={`${summary.pending} bekliyor · ${summary.accepted} kabul`} /></View>
            </View>

            {open ? (
                features?.suggestions ? (
                    <Button title="Profil davet et" icon={UserPlus} onPress={() => setSheet('invite')} block />
                ) : (
                    <Notice tone="gold" icon={Lock} text={PRO_TEXT} />
                )
            ) : null}
            <View className="flex-row" style={{ gap: 8 }}>
                {campaign.status !== 'archived' ? <View className="flex-1"><Button title="Düzenle" icon={Pencil} variant="secondary" size="md" onPress={() => setSheet('edit')} block /></View> : null}
                {open ? <View className="flex-1"><Button title="Bağla" icon={Link2} variant="secondary" size="md" onPress={() => setSheet('link')} block /></View> : null}
            </View>

            <Section title="Profiller" action={rows.length ? String(rows.length) : undefined}>
                {rows.length ? (
                    <ListGroup>
                        {rows.map((r) => {
                            const name = r.creator.full_name || (r.creator.username ? `@${r.creator.username}` : 'Profil');
                            const offer = r.offer_status ? CAMPAIGN_OFFER_STATUS[r.offer_status] : { label: 'Başvuru kabul', tone: 'success' };
                            return (
                                <ListRow
                                    key={r.key}
                                    left={<Avatar name={name} uri={r.creator.avatar_url} />}
                                    title={name}
                                    subtitle={rowSubtitle(r)}
                                    numberOfLines={2}
                                    right={<Chip label={offer.label} tone={offer.tone} />}
                                    onPress={() => {
                                        if (r.collaboration_id) return navigation.navigate('CollaborationDetail', { id: r.collaboration_id });
                                        if (r.offer_id) {
                                            return Alert.alert(name, 'Teklif', [
                                                { text: 'Kapat', style: 'cancel' },
                                                { text: 'İşler’de aç', onPress: () => navigation.navigate('BrandDashboard', { screen: 'İşler' }) },
                                                { text: 'Kampanyadan çıkar', style: 'destructive', onPress: () => detach(r.offer_id) },
                                            ]);
                                        }
                                        return null;
                                    }}
                                    chevron
                                />
                            );
                        })}
                    </ListGroup>
                ) : (
                    <Card padded={false}>
                        <EmptyState icon={Users} title="Bu kampanyada henüz profil yok" text="Profilleri davet et ya da mevcut tekliflerini bağla." />
                    </Card>
                )}
            </Section>

            {adverts?.length ? (
                <Section title="Bağlı ilanlar">
                    <ChipRow>
                        {adverts.map((a) => <FilterChip key={a.id} label={a.title} />)}
                    </ChipRow>
                </Section>
            ) : null}

            <CampaignBrief brief={campaign} title="Brief" />
            <Text variant="caption" tone="fg3">CSV dışa aktarma web panelinde (Kampanyalar → CSV).</Text>

            {sheet === 'invite' ? (
                <InviteSheet visible onClose={() => setSheet(null)} campaign={campaign} bulkInvite={!!features?.bulkInvite} quotaText={quotaText}
                    onDone={() => { setSheet(null); load(); }} />
            ) : null}
            {sheet === 'edit' ? (
                <CampaignFormSheet visible campaign={campaign} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); load(); }} />
            ) : null}
            {sheet === 'link' ? <LinkSheet visible campaignId={campaign.id} onClose={() => setSheet(null)} onDone={() => { setSheet(null); load(); }} /> : null}
            <OptionSheet
                visible={sheet === 'status'}
                onClose={() => setSheet(null)}
                title="Kampanya durumu"
                options={CAMPAIGN_STATUSES.map((s) => ({ value: s, label: CAMPAIGN_STATUS_LABELS[s] }))}
                value={campaign.status}
                onSelect={(s) => s && s !== campaign.status && changeStatus(s)}
            />
        </Screen>
    );
}
