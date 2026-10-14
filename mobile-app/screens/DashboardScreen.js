import React, { useState, useCallback } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bell, Sparkles, Eye, EyeOff, ShieldAlert, Hourglass, Megaphone, Store } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { OWN_PROFILE_COLUMNS } from '../lib/userColumns';
import { formatBudget, daysLeft } from '../lib/format';
import AccountStatusCard from '../components/AccountStatusCard';
import {
    Screen, LargeHeader, Logo, Section, Text, Button, IconButton, Card, ListGroup, ListRow, IconBox, Avatar,
    Chip, Notice, EmptyState, colors,
} from '../components/ui';

export default function DashboardScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [profile, setProfile] = useState(null);
    const [projects, setProjects] = useState([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    const isSpotlightActive = !!profile?.spotlight_active && !(profile?.spotlight_expires_at && new Date(profile?.spotlight_expires_at) < new Date());

    const fetchDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: profileData }, { data: projectsData }, { count: unread }] = await Promise.all([
                supabase.from('users').select(OWN_PROFILE_COLUMNS).eq('id', user.id).single(),
                supabase.from('advert_projects').select('id, title, brand_name, brand_logo, budget_min, budget_max, platform, deadline').eq('status', 'open').order('created_at', { ascending: false }).limit(5),
                supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
            ]);

            // SECURITY: If rejected, force vitrin off
            if (profileData && profileData.verification_status === 'rejected' && profileData.is_showcase_visible) {
                profileData.is_showcase_visible = false;
                await apiRequest('showcase', { method: 'POST', body: { visible: false } });
            }

            setProfile(profileData);
            setProjects(projectsData || []);
            setUnreadNotifCount(unread || 0);
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

            <AccountStatusCard navigation={navigation} />

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
                        onPress={() => navigation.navigate('Vitrin')}
                        left={<IconBox icon={Store} />}
                        title="Vitrine göz at"
                        subtitle="Diğer influencer'ların vitrini"
                        chevron
                    />
                    <ListRow
                        onPress={toggleShowcase}
                        left={<IconBox icon={profile?.is_showcase_visible ? Eye : EyeOff} tone={profile?.is_showcase_visible ? 'success' : 'neutral'} />}
                        title="Vitrinde görün"
                        subtitle={profile?.is_showcase_visible ? 'Markalar seni keşfette görebilir' : 'Şu an markalara gizlisin'}
                        right={<Chip label={profile?.is_showcase_visible ? 'Açık' : 'Kapalı'} tone={profile?.is_showcase_visible ? 'success' : 'neutral'} />}
                    />
                </ListGroup>
            </Section>
        </Screen>
    );
}
