import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ShieldCheck, Clock, Instagram, UserCheck, UserPen } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, StackHeader, Section, Text, Button, Card, ListGroup, ListRow, IconBox, Chip, colors, ICON_STROKE } from '../../components/ui';

export default function VerificationScreen({ navigation }) {
    const [profile, setProfile] = useState(null);
    const [socialStats, setSocialStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchVerificationStatus();
        }, [])
    );

    const fetchVerificationStatus = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const [{ data: userData }, { data: socialData }] = await Promise.all([
                supabase.from('users').select('full_name, verification_status').eq('id', user.id).single(),
                supabase.from('social_accounts').select('id, user_id, platform, username, is_verified, has_stats, follower_count, engagement_rate, last_scraped_at, stats_payload, updated_at, created_at').eq('user_id', user.id).eq('platform', 'instagram').maybeSingle()
            ]);

            setProfile(userData);
            setSocialStats(socialData);
        } catch (e) {
            console.error('[VerificationScreen] Error:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} size="large" /></View>;
    }

    const isVerified = profile?.verification_status === 'verified';
    const socialVerified = !!socialStats?.is_verified;

    return (
        <Screen scroll header={<StackHeader title="Hesap doğrulama" onBack={() => navigation.goBack()} />}>
            <Card style={{ gap: 12 }} className="items-center">
                <View className={`w-16 h-16 rounded-full items-center justify-center ${isVerified ? 'bg-success-soft' : 'bg-warning-soft'}`}>
                    {isVerified
                        ? <ShieldCheck size={32} color={colors.success} strokeWidth={ICON_STROKE} />
                        : <Clock size={32} color={colors.warning} strokeWidth={ICON_STROKE} />}
                </View>
                <Chip label={isVerified ? 'Hesap onaylı' : 'Onay bekleniyor'} tone={isVerified ? 'success' : 'warning'} dot />
                <Text variant="title" style={{ textAlign: 'center' }}>{isVerified ? 'Hesabın onaylandı' : 'Doğrulama gerekli'}</Text>
                <Text tone="fg2" style={{ textAlign: 'center' }}>
                    {isVerified
                        ? 'Vitrinde görünebilir ve markalarla iş birliği yapabilirsin.'
                        : 'Vitrinde görünmek ve markalarla iş birliği yapmak için hesabının onaylanması gerekiyor.'}
                </Text>
            </Card>

            <Section title="Durum">
                <ListGroup>
                    <ListRow
                        left={<IconBox icon={Instagram} tone={socialVerified ? 'success' : 'neutral'} />}
                        title="Sosyal hesap"
                        subtitle={socialStats?.username ? `@${socialStats.username}` : 'Bağlı değil'}
                        right={<Chip label={socialVerified ? 'Doğrulandı' : 'Bekliyor'} tone={socialVerified ? 'success' : 'warning'} />}
                        onPress={!socialVerified ? () => navigation.navigate('MyProfile') : undefined}
                    />
                    <ListRow
                        left={<IconBox icon={UserCheck} tone={isVerified ? 'success' : 'neutral'} />}
                        title="Hesap onayı"
                        subtitle="Profilin ekibimizce incelenir"
                        right={<Chip label={isVerified ? 'Onaylı' : 'İnceleniyor'} tone={isVerified ? 'success' : 'warning'} />}
                    />
                </ListGroup>
            </Section>

            {!isVerified ? (
                <Section title="Onayı hızlandırmak için">
                    <ListGroup>
                        <ListRow left={<IconBox icon={Instagram} />} title="Sosyal hesabını bağla" subtitle="Instagram veya TikTok hesabını biyografi koduyla doğrula." numberOfLines={2} />
                        <ListRow left={<IconBox icon={UserPen} />} title="Profilini tamamla" subtitle="Fotoğraf, biyografi ve kategorin güncel olsun." numberOfLines={2} />
                    </ListGroup>
                    <Button title="Profile git" onPress={() => navigation.navigate('MyProfile')} block />
                    <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>Kimlik belgesi veya pasaport fotoğrafı istenmez.</Text>
                </Section>
            ) : null}
        </Screen>
    );
}
