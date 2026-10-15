import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { X } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '../constants/categories';
import { TURKISH_CITIES } from '../constants/cities';
import { DELIVERABLE_KINDS } from '../constants/collaborationWorkspace';
import { CAMPAIGN_LIMITS, CAMPAIGN_PLATFORMS } from '../constants/campaigns';
import { Sheet, Text, TextField, Button, Segment, FilterChip, ChipRow, SelectField, OptionSheet, DateField, colors, ICON_STROKE } from './ui';

function stateFrom(c) {
    return {
        name: c?.name || '',
        goal: c?.goal || '',
        keyMessages: c?.key_messages || '',
        dos: c?.dos || '',
        donts: c?.donts || '',
        exampleLinks: (c?.example_links || []).join('\n'),
        hashtags: (c?.hashtags || []).join(' '),
        notes: c?.notes || '',
        startDate: c?.start_date || '',
        endDate: c?.end_date || '',
        totalBudget: c?.total_budget != null ? String(c.total_budget) : '',
        perCreatorBudget: c?.per_creator_budget != null ? String(c.per_creator_budget) : '',
        plannedCreators: c?.planned_creators != null ? String(c.planned_creators) : '',
        deliverables: (c?.default_deliverables || []).map((d) => ({ kind: d.kind, quantity: String(d.quantity) })),
        categories: c?.target_categories || [],
        cities: c?.target_cities || [],
        platforms: c?.target_platforms || [],
        creatorType: c?.target_creator_type || '',
        minFollowers: c?.min_followers != null ? String(c.min_followers) : '',
        maxFollowers: c?.max_followers != null ? String(c.max_followers) : '',
    };
}

const digits = (v, max = 10) => v.replace(/[^0-9]/g, '').slice(0, max);
const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * Kampanya oluşturma / düzenleme (3.19). Web sihirbazının brief + hedef adımlarıyla aynı alanlar; doğrulama sunucuda
 * (lib/campaigns.ts validateCampaignInput). campaign verilirse düzenler.
 */
export default function CampaignFormSheet({ visible, onClose, campaign, onSaved }) {
    const [form, setForm] = useState(() => stateFrom(campaign));
    const [step, setStep] = useState('brief');
    const [saving, setSaving] = useState(false);
    const [cityOpen, setCityOpen] = useState(false);
    const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

    const save = async () => {
        if (!form.name.trim()) return Alert.alert('Eksik bilgi', 'Kampanya adını yazın.');
        setSaving(true);
        const body = {
            name: form.name,
            goal: form.goal,
            keyMessages: form.keyMessages,
            dos: form.dos,
            donts: form.donts,
            exampleLinks: form.exampleLinks,
            hashtags: form.hashtags,
            notes: form.notes,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            totalBudget: form.totalBudget || null,
            perCreatorBudget: form.perCreatorBudget || null,
            plannedCreators: form.plannedCreators || null,
            defaultDeliverables: form.deliverables.map((d) => ({ kind: d.kind, quantity: Number(d.quantity) })),
            targetCategories: form.categories,
            targetCities: form.cities,
            targetPlatforms: form.platforms,
            targetCreatorType: form.creatorType || null,
            minFollowers: form.minFollowers || null,
            maxFollowers: form.maxFollowers || null,
        };
        const result = campaign
            ? await apiRequest(`campaigns/${encodeURIComponent(campaign.id)}`, { method: 'PATCH', body })
            : await apiRequest('campaigns', { method: 'POST', body });
        setSaving(false);
        if (result.error) return Alert.alert('Kaydedilemedi', result.error);
        onSaved?.(result.campaign);
    };

    return (
        <Sheet visible={visible} onClose={onClose} title={campaign ? 'Kampanyayı düzenle' : 'Yeni kampanya'} scroll>
            <Segment options={[{ key: 'brief', label: 'Brief' }, { key: 'target', label: 'Hedef' }]} value={step} onChange={setStep} />
            {step === 'brief' ? (
                <>
                    <TextField label="Kampanya adı" value={form.name} maxLength={CAMPAIGN_LIMITS.nameMax} onChangeText={(v) => set('name', v)} placeholder="ör. Yaz koleksiyonu lansmanı" />
                    <TextField label="Hedef" multiline value={form.goal} maxLength={CAMPAIGN_LIMITS.goalMax} onChangeText={(v) => set('goal', v)} />
                    <TextField label="Ana mesajlar" multiline value={form.keyMessages} maxLength={CAMPAIGN_LIMITS.textMax} onChangeText={(v) => set('keyMessages', v)} />
                    <TextField label="Yapılacaklar" multiline value={form.dos} maxLength={CAMPAIGN_LIMITS.textMax} onChangeText={(v) => set('dos', v)} />
                    <TextField label="Yapılmayacaklar" multiline value={form.donts} maxLength={CAMPAIGN_LIMITS.textMax} onChangeText={(v) => set('donts', v)} />
                    <TextField label="Örnek linkler" hint="Her satıra bir link (https://...)" multiline autoCapitalize="none" value={form.exampleLinks} onChangeText={(v) => set('exampleLinks', v)} />
                    <TextField label="Etiketler ve bahsetmeler" hint="Boşlukla ayır: #yaz @marka" autoCapitalize="none" value={form.hashtags} onChangeText={(v) => set('hashtags', v)} />
                    <TextField label="Notlar (isteğe bağlı)" multiline value={form.notes} maxLength={CAMPAIGN_LIMITS.textMax} onChangeText={(v) => set('notes', v)} />
                    <View className="flex-row" style={{ gap: 8 }}>
                        <View className="flex-1"><DateField label="Başlangıç" value={form.startDate} max={form.endDate || undefined} onChange={(v) => set('startDate', v)} /></View>
                        <View className="flex-1"><DateField label="Bitiş" value={form.endDate} min={form.startDate || undefined} onChange={(v) => set('endDate', v)} /></View>
                    </View>
                    <TextField label="Toplam bütçe (isteğe bağlı)" prefix="₺" keyboardType="number-pad" value={form.totalBudget} onChangeText={(v) => set('totalBudget', digits(v, 9))} />
                    <View className="flex-row" style={{ gap: 8 }}>
                        <View className="flex-1"><TextField label="Kişi başı bütçe" hint="İsteğe bağlı; önerilerde fiyat kartı bununla kıyaslanır." prefix="₺" keyboardType="number-pad" value={form.perCreatorBudget} onChangeText={(v) => set('perCreatorBudget', digits(v, 9))} /></View>
                        <View className="flex-1"><TextField label="Planlanan profil" hint="Kişi başı boşsa toplam bütçe buna bölünür." keyboardType="number-pad" value={form.plannedCreators} onChangeText={(v) => set('plannedCreators', digits(v, 4))} /></View>
                    </View>
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Varsayılan teslimatlar</Text>
                        {form.deliverables.map((d, i) => (
                            <View key={i} className="flex-row items-center" style={{ gap: 8 }}>
                                <Text style={{ flex: 1 }}>{DELIVERABLE_KINDS.find((k) => k.value === d.kind)?.label || d.kind}</Text>
                                <View style={{ width: 80 }}>
                                    <TextField height={40} keyboardType="number-pad" value={d.quantity} onChangeText={(v) => set('deliverables', form.deliverables.map((row, j) => (j === i ? { ...row, quantity: digits(v, 2) } : row)))} />
                                </View>
                                <Pressable onPress={() => set('deliverables', form.deliverables.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="Satırı sil">
                                    <X size={18} color={colors.fg3} strokeWidth={ICON_STROKE} />
                                </Pressable>
                            </View>
                        ))}
                        {form.deliverables.length < CAMPAIGN_LIMITS.deliverables ? (
                            <ChipRow>
                                {DELIVERABLE_KINDS.map((k) => (
                                    <FilterChip key={k.value} label={`+ ${k.label}`} onPress={() => set('deliverables', [...form.deliverables, { kind: k.value, quantity: '1' }])} />
                                ))}
                            </ChipRow>
                        ) : null}
                    </View>
                </>
            ) : (
                <>
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Kategoriler</Text>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            {INFLUENCER_CATEGORY_KEYS.map((key) => (
                                <FilterChip key={key} label={INFLUENCER_CATEGORIES[key]} selected={form.categories.includes(key)} onPress={() => set('categories', toggle(form.categories, key))} />
                            ))}
                        </View>
                    </View>
                    <SelectField label="Şehirler" placeholder="Şehir ekle" value={form.cities.join(', ')} onPress={() => setCityOpen(true)} />
                    {form.cities.length ? (
                        <ChipRow>
                            {form.cities.map((c) => <FilterChip key={c} label={`${c} ✕`} selected onPress={() => set('cities', form.cities.filter((x) => x !== c))} />)}
                        </ChipRow>
                    ) : null}
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Platformlar</Text>
                        <ChipRow>
                            {CAMPAIGN_PLATFORMS.map((p) => (
                                <FilterChip key={p.value} label={p.label} selected={form.platforms.includes(p.value)} onPress={() => set('platforms', toggle(form.platforms, p.value))} />
                            ))}
                        </ChipRow>
                    </View>
                    <View style={{ gap: 6 }}>
                        <Text variant="small" weight="medium" tone="fg2">Üretici türü</Text>
                        <Segment options={[{ key: '', label: 'Fark etmez' }, { key: 'influencer', label: 'Influencer' }, { key: 'ugc', label: 'UGC' }]} value={form.creatorType} onChange={(v) => set('creatorType', v)} />
                    </View>
                    <View className="flex-row" style={{ gap: 8 }}>
                        <View className="flex-1"><TextField label="En az takipçi" keyboardType="number-pad" value={form.minFollowers} onChangeText={(v) => set('minFollowers', digits(v))} /></View>
                        <View className="flex-1"><TextField label="En çok takipçi" keyboardType="number-pad" value={form.maxFollowers} onChangeText={(v) => set('maxFollowers', digits(v))} /></View>
                    </View>
                </>
            )}
            <Button title={campaign ? 'Kaydet' : 'Kampanyayı oluştur'} onPress={save} loading={saving} block />
            <OptionSheet
                visible={cityOpen}
                onClose={() => setCityOpen(false)}
                title="Şehir ekle"
                options={TURKISH_CITIES.filter((c) => !form.cities.includes(c))}
                value=""
                onSelect={(c) => {
                    if (c && form.cities.length < 20) set('cities', [...form.cities, c]);
                    setCityOpen(false);
                }}
                searchPlaceholder="Şehir ara"
            />
        </Sheet>
    );
}
