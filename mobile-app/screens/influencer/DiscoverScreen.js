import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { View, FlatList, Alert, ActivityIndicator, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Lock, Users, ShieldAlert, SlidersHorizontal, MapPin, BarChart3, BadgeCheck } from 'lucide-react-native';
import { TURKISH_CITIES } from '../../constants/cities';
import { supabase } from '../../lib/supabase';
import { influencerCategoryLabel } from '../../constants/categories';
import { getThumbnailUrl } from '../../utils/image';
import { apiRequest } from '../../lib/api';
import { formatCount, formatTRY } from '../../lib/format';
import DiscoveryWheelCard from '../../components/DiscoveryWheelCard';
import {
    LargeHeader, StackHeader, Text, Card, Avatar, NameWithTick, Chip, Segment, SearchBar, FilterChip, ChipRow, TextField,
    SelectField, OptionSheet, Button, EmptyState, Notice, colors, ICON_STROKE,
} from '../../components/ui';

// Keşfet (marka sekmesi) / Vitrin (influencer, profilden açılır). Liste web sunucusundan gelir (lib/profile-reads.ts):
// onaysız marka profil görmez; ücretsiz markada (sınırlar açıkken) yalnızca güncel keşif çarkındaki profiller listelenir.
// Favoriler /api/mobile/favorites (lib/favorites.ts). Fiyat kartlarını RLS yalnızca doğrulanmış markaya döndürür.

// Keşif filtreleri (web keşif ızgarasıyla aynı: platform, üretici türü, şehir, takipçi ve etkileşim aralığı, sıralama,
// Spotlight Pro'da "Verisi olanlar" / "Mavi tikli"). Sunucuda uygulanır (/api/mobile/discover → lib/discover-filters.ts);
// keşif çarkı açıkken yalnızca çarktaki profiller içinde süzer.
const EMPTY_FILTERS = {
    platform: '', creatorType: '', sort: '', city: '',
    minFollowers: '', maxFollowers: '', minEngagement: '', maxEngagement: '',
    withData: false, blueTick: false, availableOnly: false,
};
const PLATFORM_OPTIONS = [{ key: '', label: 'Tümü' }, { key: 'instagram', label: 'Instagram' }, { key: 'tiktok', label: 'TikTok' }];
const CREATOR_OPTIONS = [{ key: '', label: 'Tümü' }, { key: 'influencer', label: 'Influencer' }, { key: 'ugc', label: 'UGC' }];
const SORT_OPTIONS = [
    { key: '', label: 'Öne çıkanlar' },
    { key: 'followers_desc', label: 'En çok takipçi' },
    { key: 'followers_asc', label: 'En az takipçi' },
    { key: 'engagement_desc', label: 'En yüksek etkileşim' },
];
const CITY_OPTIONS = [{ value: '', label: 'Tüm şehirler' }, ...TURKISH_CITIES.map((c) => ({ value: c, label: c }))];
const PRO_FILTER_TEXT = '"Verisi olanlar" ve "Mavi tikli" filtreleri Spotlight Pro paketine dahildir.';

function discoverPath(f, budget) {
    const params = [];
    const add = (key, value) => {
        if (value === '' || value === false || value == null) return;
        params.push(`${key}=${encodeURIComponent(value === true ? '1' : String(value).replace(',', '.'))}`);
    };
    add('platform', f.platform);
    add('creatorType', f.creatorType);
    add('sort', f.sort);
    add('city', f.city);
    add('minFollowers', f.minFollowers);
    add('maxFollowers', f.maxFollowers);
    add('minEngagement', f.minEngagement);
    add('maxEngagement', f.maxEngagement);
    add('withData', f.withData);
    add('blueTick', f.blueTick);
    add('availableOnly', f.availableOnly);
    if (budget > 0) add('budget', budget);
    return params.length ? `discover?${params.join('&')}` : 'discover';
}

function activeFilterCount(f) {
    return [
        f.platform, f.creatorType, f.city, f.minFollowers || f.maxFollowers, f.minEngagement || f.maxEngagement, f.withData, f.blueTick, f.availableOnly,
    ].filter(Boolean).length;
}

const FAVORITES_LOCKED_TEXT = 'Favoriler ve listeler Spotlight markalara özel bir özellik. Daha önce kaydettiğin favoriler silinmedi; Spotlight ile geri gelir.';

const InfluencerCard = memo(({ item, onPress, canFavorite, favoritesLocked, onToggleFavorite, minPrice }) => {
    const social = item.social_accounts?.[0];
    const category = item.category ? influencerCategoryLabel(item.category) : null;
    return (
        <Card onPress={() => onPress(item)} style={{ gap: 12 }} className="mb-3">
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <Avatar name={item.full_name || item.username} uri={item.avatar_url ? getThumbnailUrl(item.avatar_url) : null} size="lg" />
                <View className="flex-1 min-w-0" style={{ gap: 2 }}>
                    <NameWithTick name={item.full_name || item.username || 'Influencer'} verified={item.isVerified} />
                    <Text variant="small" tone="fg2" numberOfLines={1}>{[category, item.city].filter(Boolean).join(' · ') || 'Influencer'}</Text>
                    {item.spotlight_active || item.availability?.status === 'busy' ? (
                        <View className="mt-1 flex-row flex-wrap" style={{ gap: 6 }}>
                            {item.spotlight_active ? <Chip label="Spotlight" tone="gold" /> : null}
                            {/* Müsaitlik (3.19); sunucu geçerli durumu gönderir */}
                            {item.availability?.status === 'busy' ? <Chip label="Şu an dolu" tone="warning" dot /> : null}
                        </View>
                    ) : null}
                </View>
                {canFavorite ? (
                    <Pressable
                        onPress={() => onToggleFavorite(item)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={item.isFavorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                        className={`w-10 h-10 rounded-xl items-center justify-center border ${item.isFavorited ? 'border-gold-line bg-gold-soft' : 'border-line'}`}
                    >
                        {favoritesLocked
                            ? <Lock size={17} color={colors.fg3} strokeWidth={ICON_STROKE} />
                            : <Heart size={18} color={item.isFavorited ? colors.gold : colors.fg3} fill={item.isFavorited ? colors.gold : 'transparent'} strokeWidth={ICON_STROKE} />}
                    </Pressable>
                ) : null}
            </View>
            <View className="flex-row" style={{ gap: 6 }}>
                {[
                    ['Takipçi', social?.follower_count ? formatCount(social.follower_count) : '—'],
                    ['Etkileşim', social?.engagement_rate ? `%${Number(social.engagement_rate).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}` : '—'],
                    ['Başlangıç', minPrice ? formatTRY(minPrice) : '—'],
                ].map(([label, value]) => (
                    <View key={label} className="flex-1 px-2.5 py-2 rounded-[10px] bg-s2">
                        <Text weight="semibold" style={{ fontSize: 15, fontVariant: ['tabular-nums'] }}>{value}</Text>
                        <Text variant="caption" tone="fg3">{label}</Text>
                    </View>
                ))}
            </View>
        </Card>
    );
});

export default function DiscoverScreen({ navigation, route }) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [category, setCategory] = useState('');
    const [segment, setSegment] = useState('all');
    const [isBrand, setIsBrand] = useState(false);
    const [favoritesLocked, setFavoritesLocked] = useState(false);
    // Keşif çarkı (ücretsiz marka sınırları açıkken; web ile aynı kural, /api/mobile/discovery-wheel). null: sınır yok.
    const [wheel, setWheel] = useState(null);
    // Onaysız marka: web ile aynı kural, profil listelenmez.
    const [locked, setLocked] = useState(false);
    const [spinning, setSpinning] = useState(false);
    // Bütçe filtresi (yalnızca marka): fiyat kartında en az bir başlangıç fiyatı bütçeye sığanlar kalır. Sunucuda uygulanır
    // (?budget=, 3.14-S2); başlangıç fiyatı her profilde min_price olarak gelir.
    const [budgetInput, setBudgetInput] = useState('');
    const budget = Number(budgetInput) || 0;
    const isShowcase = route?.name === 'Vitrin';
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [cityOpen, setCityOpen] = useState(false);
    const [proFilters, setProFilters] = useState(false);
    const [filtering, setFiltering] = useState(false);
    const path = discoverPath(filters, isBrand ? budget : 0);
    const pathRef = useRef(path);
    pathRef.current = path;
    const requestRef = useRef(0);
    const firstLoad = useRef(true);
    const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));
    const filterCount = activeFilterCount(filters);

    const fetchInfluencers = async () => {
        const requestId = ++requestRef.current;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const myId = user?.id;
            // Favoriler yalnızca markalar içindir (tablo brand_id ile tutulur).
            const { data: me } = myId ? await supabase.from('users').select('role').eq('id', myId).maybeSingle() : { data: null };
            const viewerIsBrand = me?.role === 'brand';
            setIsBrand(viewerIsBrand);

            const result = await apiRequest(pathRef.current);
            // Filtre değişince eski istek geç dönerse yok sayılır.
            if (requestId !== requestRef.current) return;
            if (result.error) throw new Error(result.error);
            setLocked(!!result.locked);
            setProFilters(!!result.proFilters);
            setWheel(result.limited ? result : null);

            const favState = viewerIsBrand ? await apiRequest('favorites') : null;
            setFavoritesLocked(!!favState?.locked);
            const favIds = new Set(Array.isArray(favState?.ids) ? favState.ids : []);

            if (requestId !== requestRef.current) return;
            setProfiles((result.profiles || []).map((u) => ({
                ...u,
                isVerified: Array.isArray(u.displayed_badges) && u.displayed_badges.includes('verified-account'),
                isFavorited: favIds.has(u.id),
            })));
        } catch (e) {
            console.error(e);
        } finally {
            if (requestId === requestRef.current) {
                setLoading(false);
                setFiltering(false);
            }
        }
    };

    // İlk yükleme hemen, filtre değişikliklerinde (yazarken) kısa beklemeyle sunucudan yeniden okunur.
    useEffect(() => {
        if (firstLoad.current) {
            firstLoad.current = false;
            fetchInfluencers();
            return undefined;
        }
        setFiltering(true);
        const timer = setTimeout(fetchInfluencers, 400);
        return () => clearTimeout(timer);
    }, [path]);

    const toggleProFilter = (key) => {
        if (!proFilters) {
            Alert.alert('Spotlight Pro özelliği', PRO_FILTER_TEXT);
            return;
        }
        setFilter(key, !filters[key]);
    };

    const spinWheel = async () => {
        setSpinning(true);
        const result = await apiRequest('discovery-wheel', { method: 'POST' });
        setSpinning(false);
        if (result.error) {
            Alert.alert('Çark çevrilemedi', result.error);
            return;
        }
        await fetchInfluencers();
    };

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchInfluencers();
        setRefreshing(false);
    }, []);

    const toggleFavorite = async (item) => {
        if (favoritesLocked) {
            Alert.alert('Spotlight özelliği', FAVORITES_LOCKED_TEXT);
            return;
        }
        const result = await apiRequest('favorites', { method: 'POST', body: { influencerId: item.id } });
        if (result.error) {
            Alert.alert('Favoriler güncellenemedi', result.error);
            return;
        }
        setProfiles((prev) => prev.map((p) => (p.id === item.id ? { ...p, isFavorited: !!result.isFavorited } : p)));
    };

    const categories = useMemo(() => [...new Set(profiles.map((p) => p.category).filter(Boolean))], [profiles]);

    const visible = useMemo(() => {
        const q = searchQuery.trim().toLocaleLowerCase('tr-TR');
        const list = profiles.filter((u) => {
            if (segment === 'featured' && !u.spotlight_active) return false;
            if (segment === 'favorites' && !u.isFavorited) return false;
            if (category && u.category !== category) return false;
            if (!q) return true;
            return [u.full_name, u.username, influencerCategoryLabel(u.category), u.city].some((v) => (v || '').toLocaleLowerCase('tr-TR').includes(q));
        });
        // Sıralama seçiliyse sunucunun sırası korunur (dolu profiller sonda, Spotlight önde); değilse dolu profiller sonda, Spotlight önde.
        const busy = (u) => Number(u.availability?.status === 'busy');
        return filters.sort ? list : list.sort((a, b) => busy(a) - busy(b) || Number(!!b.spotlight_active) - Number(!!a.spotlight_active));
    }, [profiles, searchQuery, category, segment, filters.sort]);

    const openProfile = (item) => navigation.navigate('InfluencerDetail', { influencer: item });

    const header = (
        <View style={{ gap: 14 }} className="pb-3">
            {isBrand && !isShowcase ? (
                <Segment
                    options={[{ key: 'all', label: 'Tümü' }, { key: 'featured', label: 'Öne çıkanlar' }, { key: 'favorites', label: 'Favoriler' }]}
                    value={segment}
                    onChange={setSegment}
                />
            ) : null}
            <SearchBar value={searchQuery} onChangeText={setSearchQuery} placeholder="İsim, kategori veya şehir" />
            <ChipRow>
                <FilterChip
                    icon={SlidersHorizontal}
                    label={filterCount ? `Filtreler (${filterCount})` : 'Filtreler'}
                    selected={filtersOpen}
                    onPress={() => setFiltersOpen((v) => !v)}
                />
                {SORT_OPTIONS.map((o) => (
                    <FilterChip key={o.key || 'default'} label={o.label} selected={filters.sort === o.key} onPress={() => setFilter('sort', o.key)} />
                ))}
            </ChipRow>
            {filtersOpen ? (
                <Card style={{ gap: 12 }}>
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Platform</Text>
                        <Segment options={PLATFORM_OPTIONS} value={filters.platform} onChange={(v) => setFilter('platform', v)} />
                    </View>
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Üretici türü</Text>
                        <Segment options={CREATOR_OPTIONS} value={filters.creatorType} onChange={(v) => setFilter('creatorType', v)} />
                    </View>
                    <SelectField label="Şehir" icon={MapPin} placeholder="Tüm şehirler" value={filters.city} onPress={() => setCityOpen(true)} />
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Takipçi</Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                            <TextField className="flex-1" placeholder="En az" keyboardType="number-pad" height={44} value={filters.minFollowers} onChangeText={(v) => setFilter('minFollowers', v.replace(/[^0-9]/g, '').slice(0, 10))} />
                            <TextField className="flex-1" placeholder="En çok" keyboardType="number-pad" height={44} value={filters.maxFollowers} onChangeText={(v) => setFilter('maxFollowers', v.replace(/[^0-9]/g, '').slice(0, 10))} />
                        </View>
                    </View>
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Etkileşim oranı (%)</Text>
                        <View className="flex-row" style={{ gap: 8 }}>
                            <TextField className="flex-1" placeholder="En az" keyboardType="decimal-pad" height={44} value={filters.minEngagement} onChangeText={(v) => setFilter('minEngagement', v.replace(/[^0-9.,]/g, '').slice(0, 5))} />
                            <TextField className="flex-1" placeholder="En çok" keyboardType="decimal-pad" height={44} value={filters.maxEngagement} onChangeText={(v) => setFilter('maxEngagement', v.replace(/[^0-9.,]/g, '').slice(0, 5))} />
                        </View>
                    </View>
                    {isBrand ? (
                        <FilterChip label="Yalnızca iş alanlar" selected={filters.availableOnly} onPress={() => setFilter('availableOnly', !filters.availableOnly)} />
                    ) : null}
                    <ChipRow>
                        <FilterChip icon={proFilters ? BarChart3 : Lock} label="Verisi olanlar" selected={filters.withData} onPress={() => toggleProFilter('withData')} />
                        <FilterChip icon={proFilters ? BadgeCheck : Lock} label="Mavi tikli" selected={filters.blueTick} onPress={() => toggleProFilter('blueTick')} />
                    </ChipRow>
                    {filterCount ? <Button title="Filtreleri temizle" variant="secondary" size="sm" onPress={() => setFilters((prev) => ({ ...EMPTY_FILTERS, sort: prev.sort }))} /> : null}
                </Card>
            ) : null}
            {filtering ? <ActivityIndicator color={colors.gold} /> : null}
            {categories.length ? (
                <ChipRow>
                    <FilterChip label="Tümü" selected={!category} onPress={() => setCategory('')} />
                    {categories.map((c) => (
                        <FilterChip key={c} label={influencerCategoryLabel(c)} selected={category === c} onPress={() => setCategory(category === c ? '' : c)} />
                    ))}
                </ChipRow>
            ) : null}
            {isBrand ? (
                <TextField prefix="₺" placeholder="Bütçen (teslimat başına)" keyboardType="number-pad" height={44} value={budgetInput} onChangeText={(v) => setBudgetInput(v.replace(/[^0-9]/g, ''))} />
            ) : null}
            {wheel ? (
                <DiscoveryWheelCard
                    profilesPerSpin={wheel.profilesPerSpin}
                    windowHours={wheel.windowHours}
                    expiresAt={wheel.spin?.expires_at || null}
                    spinning={spinning}
                    onSpin={spinWheel}
                />
            ) : null}
            {segment === 'favorites' && favoritesLocked ? <Notice tone="gold" icon={Lock} text={FAVORITES_LOCKED_TEXT} /> : null}
        </View>
    );

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-bg">
            {isShowcase
                ? <StackHeader title="Vitrin" onBack={() => navigation.goBack()} />
                : <LargeHeader title="Keşfet" />}
            {loading ? (
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.gold} /></View>
            ) : locked ? (
                <View className="px-4"><Notice tone="warning" icon={ShieldAlert} title="Hesabın henüz onaylanmadı" text="Profilleri görebilmek için hesabınızın onaylanması gerekiyor." onPress={() => navigation.navigate('BrandVerification')} /></View>
            ) : (
                <FlatList
                    data={visible}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <InfluencerCard
                            item={item}
                            onPress={openProfile}
                            canFavorite={isBrand}
                            favoritesLocked={favoritesLocked}
                            onToggleFavorite={toggleFavorite}
                            minPrice={item.min_price}
                        />
                    )}
                    ListHeaderComponent={header}
                    ListEmptyComponent={
                        <Card padded={false}>
                            <EmptyState icon={Users} title="Profil bulunamadı" text={searchQuery || category || budget || filterCount ? 'Aramayı veya filtreleri değiştir.' : 'Şu an listelenecek profil yok.'} />
                        </Card>
                    }
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
                    initialNumToRender={8}
                />
            )}
            <OptionSheet
                visible={cityOpen}
                onClose={() => setCityOpen(false)}
                title="Şehir seçin"
                searchPlaceholder="Şehir ara"
                options={CITY_OPTIONS}
                value={filters.city}
                onSelect={(city) => setFilter('city', city)}
            />
        </SafeAreaView>
    );
}
