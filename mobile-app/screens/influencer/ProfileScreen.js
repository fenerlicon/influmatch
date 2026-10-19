import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
    Settings, Sparkles, Award, ShieldCheck, UserPen, BarChart3, Store, LogOut, Tags, Trophy,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { signOutAndClearPush } from '../../utils/notifications';
import { OWN_PROFILE_COLUMNS } from '../../lib/userColumns';
import { INFLUENCER_CATEGORIES } from '../../constants/categories';
import { formatCount, formatPercent } from '../../lib/format';
import {
    Screen, StackHeader, Section, Text, Button, IconButton, ListGroup, ListRow, IconBox, Avatar, NameWithTick, Chip, colors,
} from '../../components/ui';

// Influencer profil sekmesi (design/mobile/influencer.html "Profil"): üst bilgi + gruplu menü.
export default function ProfileScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [socialAccount, setSocialAccount] = useState(null);
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: prof }, { data: social }, { data: earnedBadges }] = await Promise.all([
                supabase.from('users').select(OWN_PROFILE_COLUMNS).eq('id', user.id).maybeSingle(),
                supabase.from('social_accounts').select('follower_count, engagement_rate, username').eq('user_id', user.id).eq('platform', 'instagram').maybeSingle(),
                supabase.from('user_badges').select('badge_id').eq('user_id', user.id),
            ]);

            if (prof) setProfile(prof);
            setSocialAccount(social || null);
            setBadges(earnedBadges?.map(b => b.badge_id) || []);
        } catch (e) {
            console.error('[ProfileScreen]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleSignOut = async () => {
        await signOutAndClearPush();
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    };

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const isVerified = profile?.verification_status === 'verified';
    const hasBlueTick = badges.includes('verified-account');
    const isSpotlight = !!profile?.spotlight_active && !(profile?.spotlight_expires_at && new Date(profile.spotlight_expires_at) < new Date());
    const name = profile?.full_name || 'İsimsiz kullanıcı';
    const handle = [profile?.username && `@${profile.username}`, profile?.city].filter(Boolean).join(' · ');
    const category = profile?.category ? INFLUENCER_CATEGORIES[profile.category] || profile.category : null;

    return (
        <Screen
            scroll
            header={<StackHeader right={<IconButton icon={Settings} onPress={() => navigation.navigate('Settings')} accessibilityLabel="Ayarlar" />} />}
        >
            {/* Üst bilgi */}
            <View className="items-center" style={{ gap: 10 }}>
                <Pressable onPress={() => navigation.navigate('MyProfile')} accessibilityRole="button" accessibilityLabel="Profili düzenle">
                    <Avatar name={name} uri={profile?.avatar_url} size="xl" />
                </Pressable>
                <View className="items-center">
                    <NameWithTick name={name} verified={hasBlueTick} variant="heading" />
                    {handle ? <Text variant="small" tone="fg2">{handle}</Text> : null}
                </View>
                <View className="flex-row flex-wrap justify-center" style={{ gap: 6 }}>
                    {category ? <Chip label={category} /> : null}
                    {isSpotlight ? <Chip label="Spotlight aktif" tone="gold" icon={Sparkles} /> : null}
                </View>
                <View className="flex-row w-full bg-s1 border border-line rounded-[14px]">
                    {[
                        ['Takipçi', formatCount(socialAccount?.follower_count)],
                        ['Etkileşim', socialAccount?.engagement_rate ? formatPercent(socialAccount.engagement_rate) : '—'],
                        ['Rozet', String(badges.length)],
                    ].map(([label, value], i) => (
                        <View key={label} className={`flex-1 items-center py-3 ${i ? 'border-l border-line' : ''}`}>
                            <Text weight="semibold" style={{ fontSize: 17, fontVariant: ['tabular-nums'] }}>{value}</Text>
                            <Text variant="caption" tone="fg3">{label}</Text>
                        </View>
                    ))}
                </View>
            </View>

            <Section title="Profil">
                <ListGroup>
                    <ListRow onPress={() => navigation.navigate('MyProfile')} left={<IconBox icon={UserPen} />} title="Profili düzenle" subtitle="Bio, kategori, şehir, sosyal hesaplar" chevron />
                    <ListRow onPress={() => navigation.navigate('MyProfile', { section: 'rate-card' })} left={<IconBox icon={Tags} />} title="Fiyat kartı" subtitle="Teslimat başına başlangıç fiyatların" chevron />
                    <ListRow
                        onPress={() => navigation.navigate('Verification')}
                        left={<IconBox icon={ShieldCheck} tone={isVerified ? 'success' : 'warning'} />}
                        title="Hesap doğrulama"
                        subtitle={isVerified ? 'Hesabın onaylı' : 'Onay bekleniyor'}
                        right={isVerified ? <Chip label="Onaylı" tone="success" /> : null}
                        chevron
                    />
                </ListGroup>
            </Section>

            <Section title="Görünürlük ve performans">
                <ListGroup>
                    <ListRow onPress={() => navigation.navigate('Spotlight')} left={<IconBox icon={Sparkles} tone="gold" />} title="Spotlight" subtitle={isSpotlight ? 'Aktif planı görüntüle' : 'Keşfette öne çık'} right={isSpotlight ? <Chip label="Aktif" tone="gold" /> : null} chevron />
                    <ListRow onPress={() => navigation.navigate('Tasks')} left={<IconBox icon={Trophy} tone="gold" />} title="Görevler" subtitle="Tanıtım, davet ve ilk iş görevleri" chevron />
                    <ListRow onPress={() => navigation.navigate('Statistics')} left={<IconBox icon={BarChart3} />} title="İstatistikler" subtitle="Görüntülenme, teklif ve kazanç" chevron />
                    <ListRow onPress={() => navigation.navigate('Badges')} left={<IconBox icon={Award} />} title="Rozetler" subtitle={`${badges.length} rozet kazanıldı`} chevron />
                    {/* Vitrin alt sekmeden kalktı (5 sekme); buradan açılır */}
                    <ListRow onPress={() => navigation.navigate('Vitrin')} left={<IconBox icon={Store} />} title="Vitrin" subtitle="Diğer influencer'ların vitrini" chevron />
                </ListGroup>
            </Section>

            <Button title="Çıkış yap" icon={LogOut} variant="danger" onPress={handleSignOut} block />
            <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>Influmatch · sürüm 1.0</Text>
        </Screen>
    );
}
