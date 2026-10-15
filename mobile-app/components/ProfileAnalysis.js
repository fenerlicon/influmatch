import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Lock, TrendingUp } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { Card, Section, Text, Notice, Segment, colors, ICON_STROKE } from './ui';

// Profil analizi (10.3-S25): web profil istatistik kartındaki kural tabanlı analizle aynı (lib/profile-analysis.ts).
// Veri ve seviye kontrolü sunucuda (/api/mobile/analysis): "Genel Özet" herkese, "Kampanya ROI" yalnızca marka izleyiciye
// listelenir ve yalnızca Marka Pro'da içerik döner; değilse kilit kartı (fiyat yok).
const LOCK_TEXT = 'Kampanya ROI analizi Spotlight Pro marka paketine dahildir.';

export default function ProfileAnalysis({ profileId, platform, onOpenPlans }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [section, setSection] = useState('basic');

    useEffect(() => {
        let alive = true;
        apiRequest(`analysis?profileId=${encodeURIComponent(profileId)}`).then((result) => {
            if (!alive) return;
            if (result.error) setError(result.error);
            else setData(result);
        });
        return () => { alive = false; };
    }, [profileId]);

    if (error) return null;
    if (!data) return <View className="py-4"><ActivityIndicator color={colors.gold} /></View>;

    const entry = (data.platforms || []).find((p) => p.platform === platform) || (data.platforms || [])[0];
    if (!entry) return null;
    const sections = entry.sections || [];
    const current = sections.find((s) => s.type === section) || sections[0];
    if (!current) return null;

    return (
        <Section title="Profil analizi">
            {sections.length > 1 ? (
                <Segment options={sections.map((s) => ({ key: s.type, label: s.label }))} value={current.type} onChange={setSection} />
            ) : null}
            {current.locked ? (
                <Notice tone="gold" icon={Lock} title={current.label} text={LOCK_TEXT} onPress={onOpenPlans} />
            ) : (
                <Card style={{ gap: 10 }}>
                    {current.items.map((item, i) => (
                        <View key={i} className="flex-row" style={{ gap: 10 }}>
                            <TrendingUp size={16} color={colors.gold} strokeWidth={ICON_STROKE} style={{ marginTop: 2 }} />
                            <Text variant="small" tone="fg" style={{ flex: 1, fontSize: 13.5 }}>{item}</Text>
                        </View>
                    ))}
                    <Text variant="caption" tone="fg3">Hesabın kayıtlı istatistiklerinden sabit kurallarla hazırlanır; yatırım tavsiyesi değildir.</Text>
                </Card>
            )}
        </Section>
    );
}
