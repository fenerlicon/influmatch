import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { influencerBadges, brandBadges } from '../../constants/badges';
import { CheckCircle2, Circle, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function BadgeProgressInfo({ userRole }) {
    const [userBadgeIds, setUserBadgeIds] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let channel = null;

        const init = async () => {
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (!user) {
                    setIsLoading(false);
                    return;
                }

                const fetchUserBadges = async () => {
                    const { data, error } = await supabase
                        .from('user_badges')
                        .select('badge_id')
                        .eq('user_id', user.id);

                    if (error) {
                        console.log('Error fetching badges', error)
                    }

                    setUserBadgeIds(data?.map((b) => b.badge_id) ?? []);
                };

                await fetchUserBadges();
                setIsLoading(false);

                // Subscribe to real-time updates for this user
                channel = supabase
                    .channel(`user-badges-updates-${user.id}`)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'user_badges',
                            filter: `user_id=eq.${user.id}`,
                        },
                        () => {
                            fetchUserBadges();
                        }
                    )
                    .subscribe();
            } catch (error) {
                console.error('Error initializing badge info:', error);
                setIsLoading(false);
            }
        };

        init();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, []);

    const allBadges = userRole === 'influencer' ? influencerBadges : brandBadges;
    const mvpBadges = allBadges.filter((b) => b.phase === 'mvp');
    const futureBadges = allBadges.filter((b) => b.phase !== 'mvp');

    const getBadgeRequirement = (badge) => {
        const requirements = {
            'verified-account': 'Hesabınızı doğrulayarak bu rozeti kazanabilirsiniz.',
            'founder-member': 'Platformun ilk üyelerinden olun.',
            'profile-expert': 'Profilinizi %100 doldurarak bu rozeti kazanın.',
            'rising-star': 'Son 30 günde etkileşim oranınızı %20 artırın.',
            'community-leader': '1000+ takipçiye ulaşın ve aktif bir topluluk oluşturun.',
            'content-creator': 'Düzenli olarak haftada en az 3 içerik paylaşın.',
            'trend-setter': 'İçerikleriniz keşfet sayfasında yer alsın.',
            'brand-favorite': 'En az 5 marka ile başarılı işbirliği yapın.',
            'reliable-partner': 'İşbirliklerini zamanında ve eksiksiz tamamlayın.',
            'early-adopter': 'Platformun ilk üyelerinden biri olun.',
            'premium-member': 'Premium üyelik avantajlarından yararlanın.',
            'corporate': 'Kurumsal hesap doğrulamasını tamamlayın.',
            'brand-ambassador': 'Marka elçisi programına katılın.',
            'pioneer-brand': 'Platformun ilk markalarından biri olun.',
            'official-business': 'Vergi levhanızı doğrulayın.',
            'showcase-brand': 'Vitrin kampanyası oluşturun.'
        };

        return requirements[badge.id] || 'Bu rozeti kazanmak için platformdaki aktivitelerinizi artırın.';
    };

    const isComingSoon = (badge) => {
        const comingSoonBadges = ['corporate', 'brand-ambassador', 'global'];
        return comingSoonBadges.includes(badge.id);
    };

    if (isLoading) {
        return (
            <View className="rounded-3xl border border-white/10 bg-white/5 p-6 items-center justify-center">
                <ActivityIndicator color="#D4AF37" />
                <Text className="text-gray-400 mt-2">Bilgiler yükleniyor...</Text>
            </View>
        );
    }

    const ownedMvpBadges = mvpBadges.filter((b) => userBadgeIds.includes(b.id));
    const unownedMvpBadges = mvpBadges.filter((b) => !userBadgeIds.includes(b.id));

    return (
        <View className="rounded-[30px] border border-white/10 overflow-hidden relative mt-8 mb-8">
            <LinearGradient
                colors={['#151621', '#0C0D10']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0"
            />
            <View className="p-6">
                <View className="mb-6 flex-row items-start gap-3">
                    <Info size={24} className="text-soft-gold" color="#D4AF37" />
                    <View>
                        <Text className="text-xl font-bold text-white mb-1">Rozet Durumu</Text>
                        <Text className="text-sm text-gray-400 leading-5">
                            Toplam {mvpBadges.length} başlangıç rozetinden {ownedMvpBadges.length} tanesine sahipsiniz.
                        </Text>
                    </View>
                </View>

                {/* Owned MVP Badges */}
                {ownedMvpBadges.length > 0 && (
                    <View className="mb-6 space-y-3">
                        <Text className="text-xs font-bold uppercase tracking-wider text-soft-gold mb-3">
                            Sahip Olduğunuz Rozetler ({ownedMvpBadges.length})
                        </Text>
                        <View className="space-y-2">
                            {ownedMvpBadges.map((badge) => (
                                <View
                                    key={badge.id}
                                    className="flex-row items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 mb-2"
                                >
                                    <CheckCircle2 size={20} className="text-emerald-400" color="#34d399" />
                                    <View className="flex-1">
                                        <Text className="font-semibold text-white text-md">{badge.name}</Text>
                                        <Text className="mt-1 text-sm text-gray-300">{badge.description}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                )}

                {/* Unowned MVP Badges */}
                {unownedMvpBadges.length > 0 && (
                    <View className="mb-6 space-y-3">
                        <Text className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-3">
                            Kazanabileceğiniz Rozetler ({unownedMvpBadges.length})
                        </Text>
                        <View className="space-y-2">
                            {unownedMvpBadges.map((badge) => {
                                const comingSoon = isComingSoon(badge);
                                return (
                                    <View
                                        key={badge.id}
                                        className={`flex-row items-start gap-3 rounded-2xl border p-4 mb-2 ${comingSoon
                                                ? 'border-amber-500/25 bg-amber-500/5 opacity-80'
                                                : 'border-amber-500/30 bg-amber-500/10'
                                            }`}
                                    >
                                        <Circle
                                            size={20}
                                            color={comingSoon ? 'rgba(245, 158, 11, 0.7)' : '#fbbf24'}
                                        />
                                        <View className="flex-1">
                                            <Text
                                                className={`font-semibold text-md ${comingSoon ? 'text-white/90' : 'text-white'
                                                    }`}
                                            >
                                                {badge.name}
                                            </Text>
                                            <Text
                                                className={`mt-1 text-sm ${comingSoon ? 'text-gray-300/90' : 'text-gray-300'
                                                    }`}
                                            >
                                                {badge.description}
                                            </Text>
                                            <Text className="mt-2 text-xs text-gray-500 italic">
                                                {getBadgeRequirement(badge)}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Future Badges Info */}
                {futureBadges.length > 0 && (
                    <View className="mt-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                        <Text className="mb-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                            Gelecek Rozetler
                        </Text>
                        <Text className="text-sm text-gray-300 leading-5">
                            {futureBadges.length} yeni rozet yakında platforma eklenecek. Takipte kalın!
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}
