import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { Award, MessageCircle, BarChart3, Info } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { getThumbnailUrl } from '../../utils/image';
import { apiRequest } from '../../lib/api';
import { influencerBadges } from '../../constants/badges';
import { influencerCategoryLabel } from '../../constants/categories';
import { RATE_CARD_ITEMS, RATE_CARD_SELECT, formatTry } from '../../constants/rateCard';
import DiscoveryWheelCard from '../../components/DiscoveryWheelCard';
import PortfolioResults from '../../components/PortfolioResults';
import ProfileAnalysis from '../../components/ProfileAnalysis';
import { availabilityText, busyOfferWarning } from '../../constants/availability';
import { formatCount, formatPercent } from '../../lib/format';
import {
    Screen, StackHeader, BottomBar, Text, Button, Card, ListGroup, ListRow, IconBox, Avatar, NameWithTick, Chip, Segment,
    UnderlineTabs, ChipRow, StatCard, KeyValue, TextField, Sheet, Notice, EmptyState, FilterChip,
} from '../../components/ui';

const BADGES_BY_ID = Object.fromEntries(influencerBadges.map((b) => [b.id, b]));

export default function InfluencerDetailScreen({ navigation, route }) {
    // Listeden gelen kart hemen gösterilir; ayrıntı (sosyal hesap istatistikleri) web sunucusundan yüklenir
    // (/api/mobile/profiles/:id, lib/profile-reads.ts: başka hesapların satırları istemciden okunamaz, çark kuralı orada).
    const baseInfluencer = route.params.influencer;
    const [detail, setDetail] = useState(null);
    const influencer = useMemo(() => (detail ? { ...baseInfluencer, ...detail } : baseInfluencer), [baseInfluencer, detail]);
    const [currentUserRole, setCurrentUserRole] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('instagram');
    const [tab, setTab] = useState('stats');

    // Avatar adresi tam URL olarak saklanır (avatars kovası).
    const resolveAvatar = (url) => (url && url.startsWith('http') ? url : null);

    // Teklif formu (yalnızca onaylı markalar; kurallar sunucuda, lib/offers.ts)
    const [offerVisible, setOfferVisible] = useState(false);
    const [sending, setSending] = useState(false);
    const [existingRoomId, setExistingRoomId] = useState(null);
    // Tamamlanan iş birliği sayısı herkese açık; fiyat kartını RLS yalnızca doğrulanmış markaya ve sahibine döndürür.
    const [completedCount, setCompletedCount] = useState(0);
    const [rateCard, setRateCard] = useState(null);
    const [form, setForm] = useState({ campaignName: '', campaignType: '', paymentType: 'cash', budget: '', message: '' });
    // Teklif şablonları ve son teklif (web ile aynı uç: /api/mobile/offer-templates, lib/offer-templates.ts)
    const [templates, setTemplates] = useState(null);
    const [lastOffer, setLastOffer] = useState(null);
    const [templateName, setTemplateName] = useState('');
    const [savingTemplate, setSavingTemplate] = useState(false);
    // Ücretsiz marka sınırları açıkken: kalan teklif hakkı ve keşif çarkı erişimi (web ile aynı sunucu kodu).
    const [quotaText, setQuotaText] = useState(null);
    const [wheelBlock, setWheelBlock] = useState(null);
    // Müsaitlik (3.19, sunucudan) ve teklifi bağlanabilecek kampanyalar (taslak / aktif).
    const [availability, setAvailability] = useState(route.params.influencer?.availability || null);
    const [campaigns, setCampaigns] = useState([]);
    const [campaignId, setCampaignId] = useState(route?.params?.campaignId || '');
    // Portföyde iş birliği sonuçları (4.3-S7): sunucu yalnızca Influencer Pro profilinde (ya da sahibine) döndürür.
    const [portfolio, setPortfolio] = useState(null);

    const draftToForm = (draft) => ({
        campaignName: draft.campaign_name || '',
        campaignType: draft.campaign_type || '',
        paymentType: draft.payment_type === 'barter' ? 'barter' : 'cash',
        budget: draft.budget === null || draft.budget === undefined ? '' : String(Math.round(Number(draft.budget))),
        message: draft.message || '',
    });

    const openOfferForm = async () => {
        setOfferVisible(true);
        if (templates !== null) return;
        const result = await apiRequest('offer-templates');
        setTemplates(result.templates || []);
        setLastOffer(result.lastOffer || null);
        setQuotaText(result.quotaText || null);
        setCampaigns(Array.isArray(result.campaigns) ? result.campaigns : []);
    };

    const saveTemplate = async () => {
        if (!templateName.trim() || !form.campaignName.trim()) {
            Alert.alert('Eksik bilgi', 'Şablon adı ve kampanya adı gerekli.');
            return;
        }
        setSavingTemplate(true);
        const result = await apiRequest('offer-templates', { method: 'POST', body: { name: templateName, ...form } });
        setSavingTemplate(false);
        if (result.error) {
            Alert.alert('Şablon kaydedilemedi', result.error);
            return;
        }
        setTemplates((prev) => [result.template, ...(prev || []).filter((t) => t.id !== result.template.id)]);
        setTemplateName('');
        Alert.alert('Şablon kaydedildi');
    };

    const deleteTemplate = (template) => {
        Alert.alert('Şablonu sil', `"${template.name}" silinsin mi?`, [
            { text: 'Vazgeç', style: 'cancel' },
            {
                text: 'Sil', style: 'destructive', onPress: async () => {
                    const result = await apiRequest(`offer-templates?id=${encodeURIComponent(template.id)}`, { method: 'DELETE' });
                    if (result.error) {
                        Alert.alert('Şablon silinemedi', result.error);
                        return;
                    }
                    setTemplates((prev) => (prev || []).filter((t) => t.id !== template.id));
                },
            },
        ]);
    };

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle();
                setCurrentUserRole(data?.role);
                // Profil ayrıntısı sunucudan; keşif çarkı (ücretsiz marka yalnızca çarktaki ya da ilişkisi olan profilleri açar)
                // ve onay kuralı orada uygulanır.
                const access = await apiRequest(`profiles/${encodeURIComponent(baseInfluencer.id)}`);
                if (access?.status === 'wheel_blocked') {
                    setWheelBlock(access);
                } else if (access?.status === 'ok' && access.profile) {
                    const accounts = access.socialAccounts || [];
                    setAvailability(access.availability || null);
                    setPortfolio(access.portfolio || null);
                    setDetail({
                        ...access.profile,
                        isVerified: Array.isArray(access.profile.displayed_badges) && access.profile.displayed_badges.includes('verified-account'),
                        instagram: accounts.find((a) => a.platform === 'instagram') || null,
                        tiktok: accounts.find((a) => a.platform === 'tiktok') || null,
                    });
                }
                if (data?.role === 'brand') {
                    // Bu influencer ile teklif veya başvuru üzerinden açılmış bir sohbet varsa gösterilir.
                    const { data: rooms } = await supabase.from('rooms').select('id').eq('brand_id', user.id).eq('influencer_id', influencer.id).limit(1);
                    setExistingRoomId(rooms?.[0]?.id ?? null);
                }
            }
        };
        const loadTrust = async () => {
            const [{ data: counts }, { data: card }] = await Promise.all([
                supabase.rpc('completed_collaboration_counts', { p_user_ids: [influencer.id] }),
                supabase.from('rate_cards').select(RATE_CARD_SELECT).eq('user_id', influencer.id).maybeSingle(),
            ]);
            setCompletedCount(counts?.[0]?.completed_count ?? 0);
            setRateCard(card || null);
        };
        checkRole();
        loadTrust();
    }, []);

    const openChat = useCallback(() => {
        if (!existingRoomId) return;
        navigation.navigate('BrandDashboard', {
            screen: 'Mesajlar',
            params: { openRoomId: existingRoomId, partnerName: influencer.full_name || influencer.username, partnerAvatar: influencer.avatar_url },
        });
    }, [navigation, influencer, existingRoomId]);

    // Sohbet yalnızca teklif veya başvuru üzerinden açılır (web ile aynı kural); burada teklif gönderilir.
    const sendOffer = async () => {
        if (!form.campaignName.trim()) {
            Alert.alert('Eksik bilgi', 'Kampanya adını yazın.');
            return;
        }
        setSending(true);
        const result = await apiRequest('offers', { method: 'POST', body: { receiverId: influencer.id, ...form, campaignId: campaignId || null } });
        setSending(false);
        if (result.error) {
            Alert.alert('Teklif gönderilemedi', result.error);
            return;
        }
        setOfferVisible(false);
        // Kalan teklif hakkı bir sonraki açılışta yeniden okunur.
        if (quotaText) setTemplates(null);
        setLastOffer({ campaign_name: form.campaignName, campaign_type: form.campaignType, payment_type: form.paymentType, budget: form.budget || null, message: form.message });
        setForm({ campaignName: '', campaignType: '', paymentType: 'cash', budget: '', message: '' });
        setCampaignId('');
        Alert.alert('Teklif gönderildi', 'Influencer yanıt verdiğinde bildirim alacaksınız.', [
            { text: 'Tamam' },
            { text: 'Tekliflerim', onPress: () => navigation.navigate('BrandDashboard', { screen: 'İşler' }) },
        ]);
    };

    // Yalnızca TikTok hesabı olan profilde istatistik o platformdan açılır
    useEffect(() => {
        if (!influencer.instagram && influencer.tiktok) setSelectedPlatform('tiktok');
    }, [influencer.instagram, influencer.tiktok]);

    const currentStats = selectedPlatform === 'instagram' ? influencer.instagram : influencer.tiktok;

    if (wheelBlock) {
        return (
            <Screen scroll header={<StackHeader onBack={() => navigation.goBack()} />}>
                <DiscoveryWheelCard
                    variant="profile"
                    profilesPerSpin={wheelBlock.profilesPerSpin}
                    windowHours={wheelBlock.windowHours}
                    expiresAt={wheelBlock.expiresAt}
                />
                <Button title="Keşfete dön" variant="secondary" onPress={() => navigation.navigate('BrandDashboard', { screen: 'Keşfet' })} block />
            </Screen>
        );
    }

    const isBrandViewer = currentUserRole === 'brand';
    const name = influencer.full_name || influencer.username || 'Influencer';
    const badges = (influencer.displayed_badges || []).map((id) => BADGES_BY_ID[id]).filter(Boolean);
    const platforms = [['instagram', 'Instagram'], ['tiktok', 'TikTok']].filter(([key]) => influencer[key]);
    const tabs = [
        { key: 'stats', label: 'İstatistik' },
        ...(portfolio ? [{ key: 'results', label: 'Sonuçlar' }] : []),
        ...(rateCard ? [{ key: 'rate', label: 'Fiyat kartı' }] : []),
        { key: 'about', label: 'Hakkında' },
        { key: 'badges', label: 'Rozetler' },
    ];
    const metrics = currentStats ? [
        ['Takipçi', formatCount(currentStats.follower_count)],
        ['Etkileşim', currentStats.engagement_rate ? formatPercent(currentStats.engagement_rate) : '—'],
        ['Ort. beğeni', formatCount(currentStats.stats_payload?.avg_likes)],
        ['Ort. yorum', formatCount(currentStats.stats_payload?.avg_comments)],
        ['Ort. izlenme', formatCount(currentStats.stats_payload?.avg_views)],
    ] : [];

    return (
        <Screen
            scroll
            header={<StackHeader onBack={() => navigation.goBack()} />}
            footer={isBrandViewer ? (
                <BottomBar>
                    {existingRoomId ? <Button title="Sohbet" icon={MessageCircle} variant="secondary" onPress={openChat} /> : null}
                    <View className="flex-1"><Button title="Teklif gönder" onPress={openOfferForm} block /></View>
                </BottomBar>
            ) : null}
        >
            {/* Üst bilgi */}
            <View className="items-center" style={{ gap: 10 }}>
                <Avatar name={name} uri={resolveAvatar(influencer.avatar_url) ? getThumbnailUrl(influencer.avatar_url) : null} size="xl" />
                <View className="items-center">
                    <NameWithTick name={name} verified={influencer.isVerified} spotlight={!!influencer.spotlight_active} variant="heading" />
                    <Text variant="small" tone="fg2">
                        {[influencer.username && `@${influencer.username}`, influencerCategoryLabel(influencer.category), influencer.city].filter(Boolean).join(' · ')}
                    </Text>
                </View>
                <View className="flex-row flex-wrap justify-center" style={{ gap: 6 }}>
                    {availability?.status === 'busy' ? <Chip label="Şu an dolu" tone="warning" dot /> : null}
                    {rateCard?.negotiable ? <Chip label="Pazarlığa açık" /> : null}
                    <Chip label={`${completedCount} tamamlanan iş birliği`} />
                </View>
                {availability?.status === 'busy' ? (
                    <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>
                        {availabilityText(availability)}{availability.note ? ` · ${availability.note}` : ''}
                    </Text>
                ) : null}
            </View>

            <View className="-mx-4"><UnderlineTabs options={tabs} value={tab} onChange={setTab} /></View>

            {tab === 'stats' ? (
                platforms.length ? (
                    <>
                        {platforms.length > 1 ? (
                            <Segment options={platforms.map(([key, label]) => ({ key, label }))} value={selectedPlatform} onChange={setSelectedPlatform} />
                        ) : null}
                        {currentStats ? (
                            <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                                {metrics.map(([label, value]) => (
                                    <View key={label} style={{ width: '48%' }}><StatCard label={label} value={value} /></View>
                                ))}
                            </View>
                        ) : (
                            <Text variant="small" tone="fg3">Bu platformda istatistik yok.</Text>
                        )}
                        {/* Profil analizi (10.3-S25): web ile aynı kurallar ve paket kontrolü sunucuda */}
                        {detail ? (
                            <ProfileAnalysis profileId={influencer.id} platform={selectedPlatform} onOpenPlans={() => navigation.navigate('Spotlight')} />
                        ) : null}
                    </>
                ) : (
                    <Card padded={false}><EmptyState icon={BarChart3} title="İstatistik yok" text="Doğrulanmış sosyal hesap istatistiği bulunmuyor." /></Card>
                )
            ) : null}

            {tab === 'results' && portfolio ? (
                <PortfolioResults view={portfolio} onOpenPlans={() => navigation.navigate('Spotlight')} />
            ) : null}

            {tab === 'rate' && rateCard ? (
                <View style={{ gap: 8 }}>
                    <Text variant="small" tone="fg2">Teslimat başına başlangıç fiyatları</Text>
                    <Card padded={false} className="px-4">
                        {RATE_CARD_ITEMS.filter((item) => rateCard[item.column]).map((item, i, arr) => (
                            <KeyValue key={item.key} label={item.label} value={formatTry(rateCard[item.column])} last={i === arr.length - 1} />
                        ))}
                    </Card>
                </View>
            ) : null}

            {tab === 'about' ? (
                influencer.bio ? <Text tone="fg2" style={{ lineHeight: 22 }}>{influencer.bio}</Text> : <Text variant="small" tone="fg3">Henüz tanıtım yazısı yok.</Text>
            ) : null}

            {tab === 'badges' ? (
                badges.length ? (
                    <ListGroup>
                        {badges.map((b) => (
                            <ListRow key={b.id} left={<IconBox icon={b.icon || Award} tone={b.id === 'verified-account' ? 'info' : 'gold'} />} title={b.name} subtitle={b.description} numberOfLines={2} />
                        ))}
                    </ListGroup>
                ) : <Text variant="small" tone="fg3">Henüz rozet kazanılmamış.</Text>
            ) : null}

            {isBrandViewer ? (
                <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>Sohbet, teklif yanıtlanınca açılır.</Text>
            ) : null}

            {/* Teklif formu (yalnızca onaylı markalar; kurallar sunucuda, lib/offers.ts) */}
            <Sheet
                visible={offerVisible}
                onClose={() => setOfferVisible(false)}
                title="Teklif gönder"
                headerRight={lastOffer ? <Text variant="small" weight="medium" tone="gold" onPress={() => setForm(draftToForm(lastOffer))} suppressHighlighting>Son teklifi kopyala</Text> : null}
                scroll
            >
                {quotaText ? <Notice tone="info" icon={Info} text={quotaText} /> : null}
                {availability?.status === 'busy' ? <Notice tone="warning" text={busyOfferWarning(availability, name)} /> : null}
                {campaigns.length ? (
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Kampanya (isteğe bağlı)</Text>
                        <ChipRow>
                            <FilterChip label="Yok" selected={!campaignId} onPress={() => setCampaignId('')} />
                            {campaigns.map((c) => (
                                <FilterChip
                                    key={c.id}
                                    label={c.name}
                                    selected={campaignId === c.id}
                                    onPress={() => {
                                        setCampaignId(c.id);
                                        if (!form.campaignName.trim()) setForm((f) => ({ ...f, campaignName: c.name }));
                                    }}
                                />
                            ))}
                        </ChipRow>
                        <Text variant="caption" tone="fg3">Seçersen kampanya brief’i teklifte influencer’a görünür.</Text>
                    </View>
                ) : null}
                {templates?.length ? (
                    <View style={{ gap: 6 }}>
                        <ChipRow>
                            {templates.map((template) => (
                                <Pressable key={template.id} onPress={() => setForm(draftToForm(template))} onLongPress={() => deleteTemplate(template)}
                                    className="h-9 px-3.5 rounded-full border border-line-strong justify-center">
                                    <Text variant="small" tone="fg2" style={{ fontSize: 14 }}>{template.name}</Text>
                                </Pressable>
                            ))}
                        </ChipRow>
                        <Text variant="caption" tone="fg3">Şablona dokun: formu doldurur. Basılı tut: şablonu siler.</Text>
                    </View>
                ) : null}
                <TextField label="Kampanya / iş adı" value={form.campaignName} onChangeText={(v) => setForm((f) => ({ ...f, campaignName: v }))} placeholder="ör. Yaz serisi" />
                <TextField label="Kampanya türü" value={form.campaignType} onChangeText={(v) => setForm((f) => ({ ...f, campaignType: v }))} placeholder="ör. 2 Reels + 3 Hikâye" />
                <View style={{ gap: 7 }}>
                    <Text variant="small" weight="medium" tone="fg2">Ödeme</Text>
                    <Segment options={[{ key: 'cash', label: 'Nakit' }, { key: 'barter', label: 'Barter' }]} value={form.paymentType} onChange={(v) => setForm((f) => ({ ...f, paymentType: v }))} />
                </View>
                <TextField
                    label={form.paymentType === 'barter' ? 'Ürün piyasa değeri' : 'Bütçe'}
                    prefix="₺"
                    keyboardType="number-pad"
                    value={form.budget}
                    onChangeText={(v) => setForm((f) => ({ ...f, budget: v.replace(/[^0-9]/g, '') }))}
                    placeholder="0"
                />
                <TextField label="Mesaj" multiline value={form.message} onChangeText={(v) => setForm((f) => ({ ...f, message: v }))} placeholder="Markanı ve beklentini kısaca anlat." />
                <Button title="Teklifi gönder" onPress={sendOffer} loading={sending} block />
                <View className="flex-row items-end" style={{ gap: 8 }}>
                    <View className="flex-1"><TextField label="Şablon olarak kaydet" value={templateName} onChangeText={setTemplateName} placeholder="Şablon adı" height={44} /></View>
                    <Button title="Kaydet" variant="secondary" size="md" onPress={saveTemplate} loading={savingTemplate} />
                </View>
            </Sheet>
        </Screen>
    );
}
