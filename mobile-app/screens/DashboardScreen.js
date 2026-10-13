import React, { useState, useCallback } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bell, Sparkles, Eye, EyeOff, ShieldAlert, Hourglass, Megaphone } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { OWN_PROFILE_COLUMNS } from '../lib/userColumns';
import { formatBudget, daysLeft } from '../lib/format';
import {
    Screen, LargeHeader, Logo, Section, Text, Button, IconButton, Card, ListGroup, ListRow, IconBox, Avatar,
    Chip, Notice, Ring, StepBar, EmptyState, colors,
} from '../components/ui';

// "İlk adımlar" adımı → mobil ekran (web'deki href'in karşılığı; durum /api/mobile/first-steps → lib/first-steps.ts)
const STEP_ROUTES = {
    verify_social: ['Verification'],
    complete_profile: ['MyProfile'],
    rate_card: ['MyProfile', { section: 'rate-card' }],
    first_application: ['İlanlar'],
};
// "Gizle" tercihi yalnızca bu cihazda, kullanıcıya özel (eski FirstStepsCard ile aynı anahtar)
const HIDDEN_KEY_PREFIX = 'first_steps_hidden:';

// Hesap durumu: ilk adımlar tek kartta, yalnızca sıradaki adım (design/mobile/influencer.html)
function AccountStatusCard({ status, onGo, onHide }) {
    const next = status.steps.find((s) => !s.done);
    if (!next) return null;
    const percent = Math.round((status.completed / status.total) * 100);
    return (
        <Card style={{ gap: 14 }}>
            <View className="flex-row items-center" style={{ gap: 14 }}>
                <Ring value={percent} />
                <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                        <Text variant="eyebrow">Hesap durumu</Text>
                        <Text variant="caption" tone="fg3" onPress={onHide} suppressHighlighting>Gizle</Text>
                    </View>
                    <Text weight="semibold" style={{ fontSize: 16 }} className="mt-0.5">Sıradaki adım: {next.title.toLocaleLowerCase('tr-TR')}</Text>
                    <Text variant="small" tone="fg2">{next.description}</Text>
                    {next.note ? <View className="mt-1.5"><Chip label={next.note} tone="warning" /></View> : null}
                </View>
            </View>
            <StepBar total={status.total} done={status.completed} current={status.completed < status.total ? status.completed : undefined} />
            <Text variant="caption" tone="fg3">{status.label}</Text>
            {STEP_ROUTES[next.key] ? <Button title={next.title} onPress={() => onGo(next.key)} block /> : null}
        </Card>
    );
}

export default function DashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [profile, setProfile] = useState(null);
    const [projects, setProjects] = useState([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [steps, setSteps] = useState(null);
    const [stepsHidden, setStepsHidden] = useState(true);

    const isSpotlightActive = !!profile?.spotlight_active && !(profile?.spotlight_expires_at && new Date(profile?.spotlight_expires_at) < new Date());

    const fetchDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let hidden = false;
            try { hidden = (await AsyncStorage.getItem(HIDDEN_KEY_PREFIX + user.id)) === 'true'; } catch (e) { hidden = false; }

            const [{ data: profileData }, { data: projectsData }, { count: unread }, stepsResult] = await Promise.all([
                supabase.from('users').select(OWN_PROFILE_COLUMNS).eq('id', user.id).single(),
                supabase.from('advert_projects').select('id, title, brand_name, brand_logo, budget_min, budget_max, platform, deadline').eq('status', 'open').order('created_at', { ascending: false }).limit(5),
                supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
                hidden ? Promise.resolve({}) : apiRequest('first-steps'),
            ]);

            // SECURITY: If rejected, force vitrin off
            if (profileData && profileData.verification_status === 'rejected' && profileData.is_showcase_visible) {
                profileData.is_showcase_visible = false;
                await apiRequest('showcase', { method: 'POST', body: { visible: false } });
            }

            setProfile(profileData);
            setProjects(projectsData || []);
            setUnreadNotifCount(unread || 0);
            setStepsHidden(hidden);
            setSteps(stepsResult?.error ? null : stepsResult?.status || null);
        } catch (e) {
            console.error('[Dashboard] fetchDashboardData error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchDashboardData(); }, []));

    // Vitrin (keşfette görünürlük) aç/kapa — kurallar sunucuda: /api/mobile/showcase
    const toggleShowcase = async () => {
        if (!profile) return;

        if (profile.verification_status === 'rejected') {
            Alert.alert('Hesap Reddedildi', 'Hesabınız inceleme sonucu reddedildiği için vitrin özelliğini kullanamazsınız. Lütfen destekle iletişime geçin.');
            return;
        }

        const newState = !profile.is_showcase_visible;

        if (newState && profile.verification_status !== 'verified') {
            Alert.alert('Hesap Doğrulama Gerekli', 'Vitrinde görünmek için hesabınızın onaylanmış olması gerekiyor.');
            return;
        }

        setProfile(prev => ({ ...prev, is_showcase_visible: newState }));
        const result = await apiRequest('showcase', { method: 'POST', body: { visible: newState } });

        if (!result.success) {
            Alert.alert('Hata', result.error || 'Durum güncellenemedi.');
            setProfile(prev => ({ ...prev, is_showcase_visible: !newState }));
        } else {
            Alert.alert(newState ? 'Vitrin açık' : 'Vitrin kapalı', newState ? 'Artık markalar tarafından keşfedilebilirsin.' : 'Vitrinden kaldırıldın.');
        }
    };

    const hideSteps = async () => {
        setStepsHidden(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
            try { await AsyncStorage.setItem(HIDDEN_KEY_PREFIX + session.user.id, 'true'); } catch (e) { /* yalnızca bu oturumda gizli */ }
        }
    };

    // Tek bildirim alanı: öncelik sırasıyla ilk uyarı gösterilir, kalanların sayısı "+N"
    const notices = [];
    if (profile?.verification_status === 'rejected') {
        notices.push({ tone: 'danger', icon: ShieldAlert, title: 'Hesabın onaylanmadı', text: 'Ayrıntı için destekle iletişime geç.', onPress: () => navigation.navigate('Settings') });
    } else if (profile && profile.verification_status !== 'verified') {
        notices.push({ tone: 'info', icon: Hourglass, title: 'Hesabın inceleniyor', text: 'Onaylanınca vitrinde görünebilirsin.' });
    }
    if (profile?.verification_status === 'verified' && !profile?.is_showcase_visible) {
        notices.push({ tone: 'warning', icon: EyeOff, title: 'Markalara gizlisin', text: 'Vitrini açarak keşfette görün.', onPress: toggleShowcase });
    }

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} /></View>;
    }

    const firstName = profile?.full_name?.split(' ')[0];
    const showSteps = !stepsHidden && steps && !steps.allDone;

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDashboardData(); }}
            header={
                <LargeHeader
                    left={<Logo />}
                    right={<IconButton icon={Bell} dot={unreadNotifCount > 0} onPress={() => navigation.navigate('Notifications')} accessibilityLabel={unreadNotifCount ? `Bildirimler, ${unreadNotifCount} okunmamış` : 'Bildirimler'} />}
                    title={firstName ? `Merhaba, ${firstName}` : 'Merhaba'}
                />
            }
        >
            {notices.length ? <Notice {...notices[0]} more={notices.length > 1 ? notices.length - 1 : undefined} /> : null}

            {showSteps ? (
                <AccountStatusCard status={steps} onHide={hideSteps} onGo={(key) => navigation.navigate(...STEP_ROUTES[key])} />
            ) : null}

            <Section title="Yeni ilanlar" action="Tümü" onAction={() => navigation.navigate('İlanlar')}>
                {projects.length ? (
                    <ListGroup>
                        {projects.slice(0, 4).map((project) => (
                            <ListRow
                                key={project.id}
                                onPress={() => navigation.navigate('İlanlar', { project })}
                                left={<Avatar name={project.brand_name || project.title} uri={project.brand_logo} square />}
                                title={project.title}
                                subtitle={[project.brand_name, project.platform].filter(Boolean).join(' · ')}
                                right={
                                    <View className="items-end">
                                        <Text variant="small" weight="semibold">{formatBudget(project.budget_min, project.budget_max)}</Text>
                                        {project.deadline ? <Text variant="caption" tone="fg3">{daysLeft(project.deadline)}</Text> : null}
                                    </View>
                                }
                            />
                        ))}
                    </ListGroup>
                ) : (
                    <Card padded={false}><EmptyState icon={Megaphone} title="Şu an açık ilan yok" text="Yeni ilanlar yayınlandığında burada görünür." /></Card>
                )}
            </Section>

            <Section title="Hızlı erişim">
                <ListGroup>
                    <ListRow
                        onPress={() => navigation.navigate('Spotlight')}
                        left={<IconBox icon={Sparkles} tone="gold" />}
                        title="Spotlight"
                        subtitle={isSpotlightActive ? 'Öne çıkarılıyorsun' : 'Keşfette öne çık'}
                        right={<Chip label={isSpotlightActive ? 'Aktif' : 'Pasif'} tone={isSpotlightActive ? 'gold' : 'neutral'} />}
                        chevron
                    />
                    <ListRow
                        onPress={toggleShowcase}
                        left={<IconBox icon={profile?.is_showcase_visible ? Eye : EyeOff} tone={profile?.is_showcase_visible ? 'success' : 'neutral'} />}
                        title="Vitrin"
                        subtitle={profile?.is_showcase_visible ? 'Markalar seni keşfette görebilir' : 'Şu an markalara gizlisin'}
                        right={<Chip label={profile?.is_showcase_visible ? 'Açık' : 'Kapalı'} tone={profile?.is_showcase_visible ? 'success' : 'neutral'} />}
                    />
                </ListGroup>
            </Section>
        </Screen>
    );
}
