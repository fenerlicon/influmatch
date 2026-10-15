import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Alert, ActivityIndicator, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Bookmark, BellRing, Trash2, Megaphone, Inbox, MapPin } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';
import { COLLAB_STAGE_SHORT, loadApplicationCollabs } from '../../constants/collaborations';
import { ADVERT_ALERT_LIMIT, ADVERT_ALERT_PLATFORMS, describeAlert } from '../../constants/advertAlerts';
import { formatBudget, formatTRY, formatDate, daysLeft } from '../../lib/format';
import {
    Screen, LargeHeader, Text, Button, Card, ListGroup, ListRow, Avatar, Chip, FilterChip, ChipRow, Segment, SearchBar,
    EmptyState, Sheet, TextField, KeyValue, Notice, colors, ICON_STROKE,
} from '../../components/ui';

// İlanlar: açık ilanlar, kayıtlılar, başvurularım ve ilan alarmları (design/mobile/influencer.html "İlanlar").
// Başvuru lib/adverts.ts (/api/mobile/applications), kayıt ve alarm /api/mobile/saved-adverts, /api/mobile/advert-alerts.

const APP_STATUS = {
    pending: { label: 'Bekliyor', tone: 'warning' },
    shortlisted: { label: 'Değerlendiriliyor', tone: 'info' },
    accepted: { label: 'Kabul edildi', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

const SEGMENTS = [
    { key: 'projects', label: 'Açık' },
    { key: 'saved', label: 'Kayıtlı' },
    { key: 'applications', label: 'Başvurular' },
    { key: 'alerts', label: 'Alarmlar' },
];

function SaveButton({ saved, onPress }) {
    return (
        <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={saved ? 'Kaydı kaldır' : 'Kaydet'}
            className={`w-9 h-9 rounded-[10px] items-center justify-center border ${saved ? 'border-gold-line bg-gold-soft' : 'border-line'}`}>
            <Bookmark size={17} color={saved ? colors.gold : colors.fg3} fill={saved ? colors.gold : 'transparent'} strokeWidth={ICON_STROKE} />
        </Pressable>
    );
}

export default function ProposalsScreen({ route, navigation }) {
    const [activeTab, setActiveTab] = useState('projects');
    const [query, setQuery] = useState('');
    const [platform, setPlatform] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [applyStep, setApplyStep] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [isApplying, setIsApplying] = useState(false);

    // Başvuru formu
    const [coverLetter, setCoverLetter] = useState('');
    const [deliveryItem, setDeliveryItem] = useState('');
    const [paymentType, setPaymentType] = useState('cash'); // 'cash' | 'barter'
    const [budgetExpectation, setBudgetExpectation] = useState('');

    const [projects, setProjects] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // Kaydedilen ilanlar ve ilan alarmları (web ile aynı uçlar: /api/mobile/saved-adverts, /api/mobile/advert-alerts)
    const [savedIds, setSavedIds] = useState(new Set());
    const [alerts, setAlerts] = useState([]);
    const [alertForm, setAlertForm] = useState({ category: '', platform: '', minBudget: '' });
    const [alertBusy, setAlertBusy] = useState(false);

    // Ana sayfadan bir ilanla açıldıysa ayrıntıyı göster
    const incomingProject = route.params?.project;
    useEffect(() => {
        if (incomingProject) {
            setSelectedProject(incomingProject);
            setApplyStep(false);
            navigation.setParams({ project: null });
        }
    }, [incomingProject]);

    const fetchData = async () => {
        try {
            const { data: projectsData, error: projectsError } = await supabase
                .from('advert_projects')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false });
            if (projectsError) throw projectsError;
            setProjects(projectsData || []);

            const [savedResult, alertsResult] = await Promise.all([apiRequest('saved-adverts'), apiRequest('advert-alerts')]);
            if (!savedResult.error) setSavedIds(new Set(savedResult.advertIds || []));
            if (!alertsResult.error) setAlerts(alertsResult.alerts || []);

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: appsData, error: appsError } = await supabase
                    .from('advert_applications')
                    .select('*, advert_projects!advert_applications_advert_id_fkey(*)') // Use explicit FK avoid ambiguity
                    .eq('influencer_id', user.id)  // DB column is influencer_id (not influencer_user_id)
                    .order('created_at', { ascending: false });
                if (appsError) throw appsError;
                // Kabul edilen başvurunun iş birliği aşaması (3.14-S1).
                const collabs = await loadApplicationCollabs((appsData || []).filter((x) => x.status === 'accepted').map((x) => x.id));
                setApplications((appsData || []).map((x) => ({ ...x, collaboration: collabs.get(x.id) || null })));
            }
        } catch (error) {
            console.error('Error fetching proposals:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));

    const toggleSave = async (advertId) => {
        const nextSaved = !savedIds.has(advertId);
        const apply = (saved) => setSavedIds((prev) => {
            const next = new Set(prev);
            if (saved) next.add(advertId); else next.delete(advertId);
            return next;
        });
        apply(nextSaved);
        const result = await apiRequest('saved-adverts', { method: 'POST', body: { advertId, saved: nextSaved } });
        if (result.error) {
            apply(!nextSaved);
            Alert.alert('İşlem yapılamadı', result.error);
        }
    };

    const createAlert = async () => {
        setAlertBusy(true);
        const result = await apiRequest('advert-alerts', { method: 'POST', body: alertForm });
        setAlertBusy(false);
        if (result.error) {
            Alert.alert('Alarm kurulamadı', result.error);
            return;
        }
        setAlerts((prev) => [...prev, result.alert]);
        setAlertForm({ category: '', platform: '', minBudget: '' });
    };

    const deleteAlert = async (alertId) => {
        const result = await apiRequest(`advert-alerts?id=${encodeURIComponent(alertId)}`, { method: 'DELETE' });
        if (result.error) {
            Alert.alert('Alarm silinemedi', result.error);
            return;
        }
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    };

    const cancelApplication = async (application) => {
        const result = await apiRequest(`applications/${application.id}`, { method: 'DELETE' });
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        setSelectedApplication(null);
        fetchData();
    };

    const closeProject = () => {
        setSelectedProject(null);
        setApplyStep(false);
    };

    const executeApply = async () => {
        if (!selectedProject) return;
        if (!coverLetter.trim()) {
            Alert.alert('Eksik Bilgi', 'Lütfen bir niyet mesajı yazın.');
            return;
        }
        setIsApplying(true);
        try {
            // Başvuru web'in sunucu kodundan geçer (lib/adverts.ts): ilan açık mı, mükerrer mi, bildirim.
            const result = await apiRequest('applications', {
                method: 'POST',
                body: {
                    advertId: selectedProject.id,
                    coverLetter: coverLetter.trim(),
                    deliverableIdea: deliveryItem.trim() || null,
                    budgetExpectation: budgetExpectation || null,
                },
            });
            if (result.error) throw new Error(result.error);

            closeProject();
            setCoverLetter('');
            setDeliveryItem('');
            setBudgetExpectation('');
            Alert.alert('Başarılı', 'Başvurunuz markaya iletildi!');
            fetchData();
            setActiveTab('applications');
        } catch (error) {
            Alert.alert('Hata', error.message);
        } finally {
            setIsApplying(false);
        }
    };

    const appliedIds = useMemo(() => new Set(applications.map((a) => a.advert_id || a.advert_projects?.id)), [applications]);

    const listed = useMemo(() => {
        const base = activeTab === 'saved' ? projects.filter((p) => savedIds.has(p.id)) : projects;
        const q = query.trim().toLocaleLowerCase('tr-TR');
        return base.filter((p) => {
            if (platform && (p.platform || '').toLowerCase() !== platform) return false;
            if (!q) return true;
            return [p.title, p.brand_name, p.summary].some((v) => (v || '').toLocaleLowerCase('tr-TR').includes(q));
        });
    }, [projects, savedIds, activeTab, query, platform]);

    const renderProject = (item) => (
        <Card key={item.id} onPress={() => { setSelectedProject(item); setApplyStep(false); }} style={{ gap: 10 }}>
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <Avatar name={item.brand_name || item.title} uri={item.brand_logo} square />
                <View className="flex-1">
                    <Text weight="semibold" style={{ fontSize: 15.5 }} numberOfLines={2}>{item.title}</Text>
                    {item.brand_name ? <Text variant="caption" tone="fg3">{item.brand_name}</Text> : null}
                </View>
                <SaveButton saved={savedIds.has(item.id)} onPress={() => toggleSave(item.id)} />
            </View>
            {item.summary || item.description ? (
                <Text variant="small" tone="fg2" numberOfLines={2} style={{ fontSize: 14 }}>{item.summary || item.description}</Text>
            ) : null}
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {item.platform ? <Chip label={item.platform} /> : null}
                {item.location ? <Chip label={item.location} /> : null}
                {appliedIds.has(item.id) ? <Chip label="Başvurdun" tone="success" /> : null}
                {item.is_new ? <Chip label="Yeni" tone="gold" /> : null}
            </View>
            <View className="flex-row items-center justify-between pt-2.5 border-t border-line">
                <Text weight="semibold" style={{ fontVariant: ['tabular-nums'] }}>{formatBudget(item.budget_min, item.budget_max)}</Text>
                {item.deadline ? <Text variant="caption" tone="fg3">{daysLeft(item.deadline)}</Text> : null}
            </View>
        </Card>
    );

    const renderProjects = () => (
        <>
            <SearchBar value={query} onChangeText={setQuery} placeholder="İlan veya marka ara" />
            <ChipRow>
                <FilterChip label="Tümü" selected={!platform} onPress={() => setPlatform('')} />
                {ADVERT_ALERT_PLATFORMS.map((p) => (
                    <FilterChip key={p.key} label={p.label} selected={platform === p.key} onPress={() => setPlatform(platform === p.key ? '' : p.key)} />
                ))}
            </ChipRow>
            {listed.length ? listed.map(renderProject) : (
                <Card padded={false}>
                    {activeTab === 'saved' && !query && !platform ? (
                        <EmptyState icon={Bookmark} title="Kayıtlı ilan yok" text="İlan kartındaki kaydet düğmesiyle ekleyebilirsin." />
                    ) : (
                        <EmptyState icon={Megaphone} title={projects.length ? 'Sonuç yok' : 'Şu an açık ilan yok'} text={projects.length ? 'Aramayı veya filtreyi değiştir.' : 'Yeni ilanlar için alarm kurabilirsin.'} />
                    )}
                </Card>
            )}
        </>
    );

    const renderApplications = () => (
        applications.length ? (
            <ListGroup>
                {applications.map((app) => {
                    const s = (app.collaboration && COLLAB_STAGE_SHORT[app.collaboration.status]) || APP_STATUS[app.status] || { label: app.status, tone: 'neutral' };
                    return (
                        <ListRow
                            key={app.id}
                            onPress={() => setSelectedApplication(app)}
                            left={<Avatar name={app.advert_projects?.brand_name || 'İlan'} uri={app.advert_projects?.brand_logo} square />}
                            title={app.advert_projects?.title || 'İlan'}
                            subtitle={`${app.advert_projects?.brand_name || ''}${app.budget_expectation ? ` · ${formatTRY(app.budget_expectation)}` : ''}`}
                            right={<Chip label={s.label} tone={s.tone} />}
                        />
                    );
                })}
            </ListGroup>
        ) : (
            <Card padded={false}><EmptyState icon={Inbox} title="Henüz başvurun yok" text="Açık ilanlardan sana uyanlara başvurabilirsin." action={<Button title="İlanlara bak" variant="secondary" size="md" onPress={() => setActiveTab('projects')} />} /></Card>
        )
    );

    const renderAlerts = () => (
        <>
            <Notice
                tone="gold"
                icon={BellRing}
                title={`İlan alarmları (${alerts.length}/${ADVERT_ALERT_LIMIT})`}
                text={'Koşullara uyan yeni ilan yayınlanınca bildirim alırsın; e-posta, ayarlardaki ilan başvuruları tercihine göre gider. Boş alan "fark etmez" demektir.'}
            />
            {alerts.length < ADVERT_ALERT_LIMIT ? (
                <Card style={{ gap: 12 }}>
                    <TextField label="Kategori / kelime" value={alertForm.category} onChangeText={(v) => setAlertForm((f) => ({ ...f, category: v }))} maxLength={60} placeholder="ör. kozmetik" />
                    <View style={{ gap: 7 }}>
                        <Text variant="small" weight="medium" tone="fg2">Platform</Text>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                            {[{ key: '', label: 'Hepsi' }, ...ADVERT_ALERT_PLATFORMS].map((p) => (
                                <FilterChip key={p.key || 'all'} label={p.label} selected={alertForm.platform === p.key} onPress={() => setAlertForm((f) => ({ ...f, platform: p.key }))} />
                            ))}
                        </View>
                    </View>
                    <TextField label="En az bütçe" prefix="₺" value={alertForm.minBudget} onChangeText={(v) => setAlertForm((f) => ({ ...f, minBudget: v.replace(/[^0-9]/g, '') }))} keyboardType="number-pad" placeholder="0" />
                    <Button title="Alarm kur" icon={BellRing} onPress={createAlert} loading={alertBusy} block />
                </Card>
            ) : null}
            {alerts.length ? (
                <ListGroup>
                    {alerts.map((alert) => (
                        <ListRow
                            key={alert.id}
                            title={describeAlert(alert)}
                            numberOfLines={2}
                            right={
                                <Pressable onPress={() => deleteAlert(alert.id)} hitSlop={8} accessibilityLabel="Alarmı sil" className="w-9 h-9 rounded-[10px] items-center justify-center border border-line">
                                    <Trash2 size={16} color={colors.danger} strokeWidth={ICON_STROKE} />
                                </Pressable>
                            }
                        />
                    ))}
                </ListGroup>
            ) : <Text variant="small" tone="fg3" style={{ textAlign: 'center' }}>Henüz alarm kurmadın.</Text>}
        </>
    );

    const p = selectedProject;
    const a = selectedApplication;
    const aStatus = a ? (a.collaboration && COLLAB_STAGE_SHORT[a.collaboration.status]) || APP_STATUS[a.status] || { label: a.status, tone: 'neutral' } : null;

    return (
        <Screen
            scroll
            keyboard
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(); }}
            header={<LargeHeader title="İlanlar" subtitle="Açık iş birliklerini incele ve başvur." />}
        >
            <Segment options={SEGMENTS} value={activeTab} onChange={setActiveTab} />

            {loading ? <View className="py-16"><ActivityIndicator color={colors.gold} /></View> : (
                <>
                    {(activeTab === 'projects' || activeTab === 'saved') ? renderProjects() : null}
                    {activeTab === 'applications' ? renderApplications() : null}
                    {activeTab === 'alerts' ? renderAlerts() : null}
                </>
            )}

            {/* İlan ayrıntısı → başvuru (aynı sayfa içinde iki adım) */}
            <Sheet visible={!!p} onClose={closeProject} title={applyStep ? 'Başvur' : undefined} scroll>
                {p && !applyStep ? (
                    <>
                        <View className="flex-row items-center" style={{ gap: 12 }}>
                            <Avatar name={p.brand_name || p.title} uri={p.brand_logo} square size="lg" />
                            <View className="flex-1">
                                <Text variant="eyebrow">İlan</Text>
                                <Text weight="semibold" style={{ fontSize: 20, lineHeight: 25 }}>{p.title}</Text>
                                {p.brand_name ? <Text variant="small" tone="fg2">{p.brand_name}</Text> : null}
                            </View>
                            <SaveButton saved={savedIds.has(p.id)} onPress={() => toggleSave(p.id)} />
                        </View>
                        <Card padded={false} className="px-4">
                            <KeyValue label="Bütçe" value={formatBudget(p.budget_min, p.budget_max)} />
                            {p.platform ? <KeyValue label="Platform" value={p.platform} /> : null}
                            {p.deliverables?.length ? <KeyValue label="Teslimatlar" value={p.deliverables.join(', ')} /> : null}
                            <KeyValue label="Son başvuru" value={p.deadline ? `${formatDate(p.deadline)} · ${daysLeft(p.deadline)}` : 'Belirtilmedi'} last />
                        </Card>
                        {p.location ? (
                            <View className="flex-row items-center" style={{ gap: 6 }}>
                                <MapPin size={15} color={colors.fg3} strokeWidth={ICON_STROKE} />
                                <Text variant="small" tone="fg2">{p.location}</Text>
                            </View>
                        ) : null}
                        {p.summary || p.description ? <Text tone="fg2" style={{ fontSize: 14.5, lineHeight: 22 }}>{p.description || p.summary}</Text> : null}
                        {appliedIds.has(p.id) ? (
                            <Chip label="Bu ilana başvurdun" tone="success" />
                        ) : (
                            <Button title="Başvur" onPress={() => setApplyStep(true)} block />
                        )}
                    </>
                ) : null}

                {p && applyStep ? (
                    <>
                        <Text variant="small" tone="fg2">{p.title}{p.brand_name ? ` · ${p.brand_name}` : ''}</Text>
                        <TextField label="Markaya notun" multiline value={coverLetter} onChangeText={setCoverLetter} placeholder="Kısaca neden uygun olduğundan bahset." />
                        <TextField label="Önerdiğin teslim" value={deliveryItem} onChangeText={setDeliveryItem} placeholder="ör. 1 Reels + 3 Hikâye" />
                        <View style={{ gap: 7 }}>
                            <Text variant="small" weight="medium" tone="fg2">Ödeme tercihi</Text>
                            <Segment
                                options={[{ key: 'cash', label: 'Nakit' }, { key: 'barter', label: 'Barter' }]}
                                value={paymentType}
                                onChange={(v) => { setPaymentType(v); if (v === 'barter') setBudgetExpectation(''); }}
                            />
                        </View>
                        <TextField
                            label="Bütçe beklentin"
                            prefix="₺"
                            keyboardType="numeric"
                            value={budgetExpectation}
                            onChangeText={(v) => setBudgetExpectation(v.replace(/[^0-9]/g, ''))}
                            editable={paymentType === 'cash'}
                            placeholder={paymentType === 'barter' ? 'Barterda bütçe girilmez' : 'ör. 25000'}
                        />
                        <Text variant="caption" tone="fg3">Profilin ve fiyat kartın markaya görünür.</Text>
                        <Button title="Başvuruyu gönder" onPress={executeApply} loading={isApplying} block />
                        <Button title="Geri" variant="ghost" size="md" onPress={() => setApplyStep(false)} block />
                    </>
                ) : null}
            </Sheet>

            {/* Başvuru ayrıntısı */}
            <Sheet visible={!!a} onClose={() => setSelectedApplication(null)} title={a?.advert_projects?.title || 'Başvuru'} headerRight={aStatus ? <Chip label={aStatus.label} tone={aStatus.tone} /> : null}>
                {a ? (
                    <>
                        <Card padded={false} className="px-4">
                            <KeyValue label="Marka" value={a.advert_projects?.brand_name || '—'} />
                            <KeyValue label="Tarih" value={formatDate(a.created_at)} />
                            <KeyValue label="Bütçe beklentin" value={a.budget_expectation ? formatTRY(a.budget_expectation) : 'Belirtilmedi'} last />
                        </Card>
                        {a.collaboration ? (
                            <Button
                                title="İş birliğine git"
                                onPress={() => { setSelectedApplication(null); navigation.navigate('CollaborationDetail', { id: a.collaboration.id }); }}
                                block
                            />
                        ) : null}
                        {a.status === 'pending' || a.status === 'shortlisted' ? (
                            <Text variant="small" tone="fg2">Başvurun marka tarafından inceleniyor. Durum değişince bildirim alacaksın.</Text>
                        ) : null}
                        {a.status === 'pending' ? (
                            <Button
                                title="Başvuruyu geri çek"
                                variant="danger"
                                onPress={() => Alert.alert('Başvuruyu Geri Çek', 'Bu başvuruyu geri çekmek istediğinize emin misiniz?', [
                                    { text: 'Vazgeç', style: 'cancel' },
                                    { text: 'Geri Çek', style: 'destructive', onPress: () => cancelApplication(a) },
                                ])}
                                block
                            />
                        ) : null}
                    </>
                ) : null}
            </Sheet>
        </Screen>
    );
}
