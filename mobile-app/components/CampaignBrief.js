import React from 'react';
import { View, Linking } from 'react-native';
import { Text, Card, Chip } from './ui';
import { briefHasContent } from '../constants/campaigns';
import { DELIVERABLE_KIND_LABELS } from '../constants/collaborationWorkspace';

const formatDate = (value) =>
    value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

/** Kampanya brief'i (3.19, salt okunur): davet edilen influencer'ın teklif ve iş birliği ekranlarında. Web CampaignBriefView ile aynı alanlar. */
export default function CampaignBrief({ brief, title = 'Kampanya brief’i' }) {
    if (!brief) return null;
    const start = formatDate(brief.start_date);
    const end = formatDate(brief.end_date);
    const deliverables = (brief.default_deliverables || []).map((d) => `${d.quantity} × ${DELIVERABLE_KIND_LABELS[d.kind] || d.kind}`).join(', ');
    const sections = [
        ['Hedef', brief.goal],
        ['Ana mesajlar', brief.key_messages],
        ['Yapılacaklar', brief.dos],
        ['Yapılmayacaklar', brief.donts],
        ['Notlar', brief.notes],
    ].filter(([, v]) => !!v);
    return (
        <Card>
            <View style={{ gap: 10 }}>
                <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
                    <Text variant="eyebrow">{title}</Text>
                    <Chip label={brief.name} tone="gold" />
                </View>
                {start || end ? <Text variant="caption" tone="fg3">Kampanya tarihleri: {start || '—'} – {end || '—'}</Text> : null}
                {deliverables ? <Text variant="small" tone="fg2">Beklenen teslimatlar: {deliverables}</Text> : null}
                {sections.map(([label, value]) => (
                    <View key={label}>
                        <Text variant="caption" tone="fg3" weight="medium">{label}</Text>
                        <Text variant="small" tone="fg2" style={{ fontSize: 14 }}>{value}</Text>
                    </View>
                ))}
                {brief.hashtags?.length ? (
                    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                        {brief.hashtags.map((tag) => <Chip key={tag} label={tag} />)}
                    </View>
                ) : null}
                {brief.example_links?.map((link) => (
                    <Text key={link} variant="small" tone="info" onPress={() => Linking.openURL(link).catch(() => null)} numberOfLines={1}>
                        {link}
                    </Text>
                ))}
                {!briefHasContent(brief) ? <Text variant="small" tone="fg3">Marka bu kampanya için ayrıntı eklemedi.</Text> : null}
            </View>
        </Card>
    );
}
