import React, { useState, useCallback } from 'react';
import { View, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { Bell, Plus, ShieldAlert, Inbox, Target } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';
import { influencerCategoryLabel } from '../../constants/categories';
import { useFocusEffect } from '@react-navigation/native';
import AccountStatusCard from '../../components/AccountStatusCard';
import { formatCount, timeAgo } from '../../lib/format';
import {
    Screen, LargeHeader, Logo, Section, Text, Button, IconButton, Card, ListGroup, ListRow, Avatar, NameWithTick, Chip,
    StatCard, Notice, EmptyState, IconBox, colors,
} from '../../components/ui';

// Başvuru durumları (lib/adverts.ts)
const STATUS_CONFIG = {
    pending: { label: 'Bekliyor', tone: 'warning' },
    shortlisted: { label: 'Kısa liste', tone: 'info' },
    accepted: { label: 'Kabul', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandDashboardScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({ projects: 0, applications: 0, accepted: 0 });
    const [recentApplications, setRecentApplications] = useState([]);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch brand profile
            const { data: prof } = await supabase
                .from('users')
                .select('full_name, avatar_url, company_legal_name, verification_status, spotlight_active, displayed_badges')
                .eq('id', user.id)
                .maybeSingle();
            setProfile(prof);

            // Öne çıkan profiller web sunucusundan gelir (lib/profile-reads.ts; başka hesapların satırları istemciden
            // okunamaz). Ücretsiz marka sınırları açıkken (keşif çarkı) yalnızca güncel çarktaki profiller; onaysız markada boş.
            const featured = await apiRequest('discover?limit=10');
            const spotlightInfs = featured.error ? [] : (featured.profiles || []);
            setRecommendations(spotlightInfs);

            // Okunmamış bildirim sayısı (liste ortak Bildirimler ekranında)
            const { count: unread } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false);
            setUnreadNotifCount(unread || 0);

            // Fetch brand's projects (only active ones)
            const { data: projects } = await supabase
                .from('advert_projects')
                .select('id')
                .eq('brand_user_id', user.id)
                .eq('status', 'open');

            // We still want to see applications for all projects of this brand,
            // so we fetch all project IDs for the applications query.
            const { data: allProjects } = await supabase
                .from('advert_projects')
                .select('id')
                .eq('brand_user_id', user.id);

            const allProjectIds = allProjects?.map(p => p.id) || [];

            if (allProjectIds.length === 0) {
                setStats({ projects: projects.length, applications: 0, accepted: 0 });
                setRecentApplications([]);
                return;
            }

            // Fetch applications for those projects
            const { data: apps } = await supabase
                .from('advert_applications')
                .select(`
                    id, status, created_at, cover_letter,
                    advert_projects:advert_id(title),
                    influencer:influencer_id(id, full_name, username, avatar_url, verification_status)
                `)
                .in('advert_id', allProjectIds)
                .order('created_at', { ascending: false })
                .limit(20);

            setRecentApplications((apps || []).slice(0, 6));

            const accepted = apps?.filter(a => a.status === 'accepted').length || 0;
            setStats({
                projects: projects.length,
                applications: apps?.length || 0,
                accepted,
            });
        } catch (e) {
            console.error('[BrandDashboard]', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const greetingName = profile?.full_name?.split(' ')[0] || profile?.company_legal_name;
    const verified = profile?.verification_status === 'verified';

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            header={
                <LargeHeader
                    left={<Logo />}
                    right={
                        <>
                            <IconButton icon={Bell} dot={unreadNotifCount > 0} onPress={() => navigation.navigate('Notifications')} accessibilityLabel={unreadNotifCount ? `Bildirimler, ${unreadNotifCount} okunmamış` : 'Bildirimler'} />
                            <Pressable onPress={() => navigation.navigate('BrandProfile')} accessibilityRole="button" accessibilityLabel="Marka profili" hitSlop={6}>
                                <Avatar name={profile?.full_name || profile?.company_legal_name} uri={profile?.avatar_url} size="sm" />
                            </Pressable>
                        </>
                    }
                    title={greetingName ? `Merhaba, ${greetingName}` : 'Merhaba'}
                />
            }
        >
            {profile && !verified ? (
                <Notice
                    tone="warning"
                    icon={ShieldAlert}
                    title="Hesabın henüz onaylanmadı"
                    text="Teklif göndermek ve ilan açmak için işletme doğrulamasını tamamla."
                    onPress={() => navigation.navigate('BrandVerification')}
                />
            ) : null}

            <AccountStatusCard navigation={navigation} />

            <View className="flex-row" style={{ gap: 10 }}>
                <StatCard label="Aktif ilan" value={String(stats.projects)} />
                <StatCard label="Başvuru" value={String(stats.applications)} />
                <StatCard label="Kabul" value={String(stats.accepted)} />
            </View>
            <Button title="Yeni ilan" icon={Plus} onPress={() => navigation.navigate('BrandAdverts', { create: true })} block />
            {verified ? (
                <ListGroup>
                    <ListRow
                        left={<IconBox icon={Target} tone="gold" />}
                        title="Kampanyalar"
                        subtitle="Brief, davetler ve kampanya panosu"
                        onPress={() => navigation.navigate('Campaigns')}
                        chevron
                    />
                </ListGroup>
            ) : null}

            {recommendations.length ? (
                <Section title="Önerilen influencerlar" action="Keşfet" onAction={() => navigation.navigate('Keşfet')}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }} style={{ marginRight: -16 }}>
                        {recommendations.map((inf) => {
                            const social = inf.social_accounts?.[0];
                            return (
                                <Card key={inf.id} onPress={() => navigation.navigate('InfluencerDetail', { influencer: inf })} className="items-center" style={{ width: 148, gap: 8 }}>
                                    <Avatar name={inf.full_name || inf.username} uri={inf.avatar_url} size="lg" />
                                    <NameWithTick name={inf.full_name || inf.username} verified={inf.verification_status === 'verified'} variant="small" />
                                    <Text variant="caption" tone="fg3" numberOfLines={1}>
                                        {[influencerCategoryLabel(inf.category), social?.follower_count ? formatCount(social.follower_count) : null].filter(Boolean).join(' · ') || 'Influencer'}
                                    </Text>
                                </Card>
                            );
                        })}
                    </ScrollView>
                </Section>
            ) : null}

            <Section title="Son başvurular" action={recentApplications.length ? 'Tümü' : undefined} onAction={() => navigation.navigate('BrandAdverts')}>
                {recentApplications.length ? (
                    <ListGroup>
                        {recentApplications.map((app) => {
                            const inf = app.influencer;
                            const s = STATUS_CONFIG[app.status] || STATUS_CONFIG.pending;
                            return (
                                <ListRow
                                    key={app.id}
                                    onPress={() => navigation.navigate('InfluencerDetail', { influencer: inf })}
                                    left={<Avatar name={inf?.full_name || inf?.username} uri={inf?.avatar_url} />}
                                    title={<NameWithTick name={inf?.full_name || inf?.username || 'Kullanıcı'} verified={inf?.verification_status === 'verified'} />}
                                    subtitle={`${app.advert_projects?.title || 'İlan'} · ${timeAgo(app.created_at)}`}
                                    right={<Chip label={s.label} tone={s.tone} />}
                                />
                            );
                        })}
                    </ListGroup>
                ) : (
                    <Card padded={false}>
                        <EmptyState icon={Inbox} title="Henüz başvuru yok" text="İlan oluşturduğunda başvurular burada görünür." />
                    </Card>
                )}
            </Section>
        </Screen>
    );
}
