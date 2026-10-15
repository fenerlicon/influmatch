import React, { useState, useCallback, useEffect } from 'react';
import { View, Image, Alert, ActivityIndicator, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Plus, ChevronRight, Pause, Play, Trash2, Pencil, Ellipsis, ImagePlus, Inbox, Megaphone, Bookmark } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { apiRequest } from '../../lib/api';
import { COLLAB_STAGE_SHORT, loadApplicationCollabs } from '../../constants/collaborations';
import { useFocusEffect } from '@react-navigation/native';
import { formatBudget, formatCount, formatPercent, formatTRY, daysLeft } from '../../lib/format';
import {
    Screen, LargeHeader, StackHeader, Text, Button, IconButton, Card, ListGroup, ListRow, IconBox, Avatar, NameWithTick, Chip,
    Segment, SearchBar, TextField, Sheet, EmptyState, colors, ICON_STROKE,
} from '../../components/ui';

// Başvuru ve ilan durumları (lib/adverts.ts)
const STATUS_CFG = {
    pending: { label: 'Bekliyor', tone: 'warning' },
    shortlisted: { label: 'Kısa liste', tone: 'info' },
    accepted: { label: 'Kabul edildi', tone: 'success' },
    rejected: { label: 'Reddedildi', tone: 'danger' },
};

const ADV_STATUS_CFG = {
    open: { label: 'Yayında', tone: 'success' },
    paused: { label: 'Durduruldu', tone: 'warning' },
    closed: { label: 'Kapalı', tone: 'neutral' },
    draft: { label: 'Taslak', tone: 'neutral' },
};

// İlan formu web ile aynı alanları taşır (components/adverts/AdvertForm.tsx); kurallar sunucuda (lib/adverts.ts saveAdvertAs).
const MAX_QUESTIONS = 5;
const EMPTY_FORM = {
    title: '', summary: '', category: '', location: 'Uzaktan', platforms: '', deliverables: '',
    paymentType: 'cash', currency: 'TRY', budgetMin: '', budgetMax: '', deadline: '', status: 'open', questions: [],
};
const PAYMENT_OPTIONS = [{ key: 'cash', label: 'Nakit' }, { key: 'barter', label: 'Barter' }, { key: 'other', label: 'Diğer' }];
const QUESTION_TYPES = [{ key: 'text', label: 'Metin' }, { key: 'single_select', label: 'Tek seçim' }, { key: 'multiple_choice', label: 'Çoklu' }];
const STATUS_OPTIONS = [{ key: 'open', label: 'Yayında' }, { key: 'paused', label: 'Duraklat' }, { key: 'closed', label: 'Kapat' }];
const parseList = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const newQuestionId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const onlyDigits = (v) => v.replace(/[^0-9]/g, '');

export default function BrandAdvertsScreen({ navigation, route }) {
    const [activeTab, setActiveTab] = useState('İlanlarım');
    const [appFilter, setAppFilter] = useState('pending');
    const [refreshing, setRefreshing] = useState(false);
    const [currentUserId, setCurrentUserId] = useState(null);

    // İlanlarım state
    const [myProjects, setMyProjects] = useState([]);
    const [loadingMy, setLoadingMy] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectApps, setProjectApps] = useState([]);
    const [loadingApps, setLoadingApps] = useState(false);

    // Tüm İlanlar state
    const [allProjects, setAllProjects] = useState([]);
    const [loadingAll, setLoadingAll] = useState(true);
    const [searchAll, setSearchAll] = useState('');

    // Başvurular state
    const [allApps, setAllApps] = useState([]);
    const [loadingAppsAll, setLoadingAppsAll] = useState(true);
    const [pendingCount, setPendingCount] = useState(0);

    // Create / Edit modal
    const [createVisible, setCreateVisible] = useState(false);
    const [editMode, setEditMode] = useState(false);      // true = editing existing
    const [editId, setEditId] = useState(null);           // id of project being edited
    const [form, setForm] = useState(EMPTY_FORM);
    const [heroImage, setHeroImage] = useState(null);
    const [heroImageUrl, setHeroImageUrl] = useState(null);
    const [uploadingHero, setUploadingHero] = useState(false);
    const [saving, setSaving] = useState(false);

    // Action sheet (⋯ menu)
    const [actionSheetProject, setActionSheetProject] = useState(null); // project object or null

    // ── Fetch helpers ──────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        await Promise.all([
            fetchMyProjects(user.id),
            fetchAllProjects(),
            fetchAllApplications(user.id),
        ]);
    }, []);

    useFocusEffect(useCallback(() => { fetchAll(); }, [fetchAll]));

    // Ana sayfadaki "Yeni ilan" doğrudan formu açar
    useEffect(() => {
        if (route?.params?.create) {
            setCreateVisible(true);
            navigation.setParams({ create: undefined });
        }
    }, [route?.params?.create]);

    const fetchMyProjects = async (uid) => {
        setLoadingMy(true);
        try {
            // Query both brand_user_id AND brand_id — older web ads may only have brand_id set
            const { data, error } = await supabase
                .from('advert_projects')
                .select('*, advert_applications!advert_id(count)')
                .or(`brand_user_id.eq.${uid},brand_id.eq.${uid}`)
                .order('created_at', { ascending: false });
            if (error) console.error('[BrandAdverts] fetchMyProjects error:', error.message);
            setMyProjects(data || []);
        } catch (e) {
            console.error('[BrandAdverts] fetchMyProjects', e);
        } finally {
            setLoadingMy(false);
        }
    };

    const fetchAllProjects = async () => {
        setLoadingAll(true);
        try {
            // Açık ilanlar ve ilan sahibi marka kartları web sunucusundan (lib/profile-reads.ts): başka hesapların
            // satırları istemciden okunamaz.
            const result = await apiRequest('adverts?limit=40');
            if (result.error) {
                console.error('[BrandAdverts] fetchAllProjects error:', result.error);
                setAllProjects([]);
                return;
            }
            const rows = result.adverts || [];
            if (rows.length === 0) {
                setAllProjects([]);
                return;
            }

            // Step 3: merge — use brand_name field first, then company_legal_name, then full_name
            const merged = rows.map(row => {
                const brandUser = row.brand || null;
                return {
                    ...row,
                    brand: brandUser,
                    displayBrandName: row.brand_name || brandUser?.company_legal_name || brandUser?.full_name || 'Marka',
                };
            });

            setAllProjects(merged);
        } catch (e) {
            console.error('[BrandAdverts] fetchAllProjects exception:', e);
        } finally {
            setLoadingAll(false);
        }
    };


    const fetchAllApplications = async (uid) => {
        setLoadingAppsAll(true);
        try {
            const { data: myProjectIds } = await supabase
                .from('advert_projects')
                .select('id')
                .or(`brand_user_id.eq.${uid},brand_id.eq.${uid}`);

            if (!myProjectIds || myProjectIds.length === 0) {
                setAllApps([]);
                setPendingCount(0);
                setLoadingAppsAll(false);
                return;
            }

            const ids = myProjectIds.map(p => p.id);
            const { data } = await supabase
                .from('advert_applications')
                .select(`
                    id, status, created_at, cover_letter, budget_expectation, payment_type,
                    advert:advert_id(id, title),
                    influencer:influencer_id(id, full_name, username, avatar_url, verification_status,
                        social_accounts(follower_count, engagement_rate, platform))
                `)
                .in('advert_id', ids)
                .order('created_at', { ascending: false });

            const apps = data || [];
            setAllApps(apps);
            trackCollabs(apps);
            setPendingCount(apps.filter(a => a.status === 'pending').length);
        } catch (e) {
            console.error('[BrandAdverts] fetchAllApplications', e);
        } finally {
            setLoadingAppsAll(false);
        }
    };

    // ── Project detail ─────────────────────────────────────────────────────────
    const openProject = async (project) => {
        setSelectedProject(project);
        setLoadingApps(true);
        const { data } = await supabase
            .from('advert_applications')
            .select(`
                id, status, created_at, cover_letter, budget_expectation, payment_type,
                influencer:influencer_id(id, full_name, username, avatar_url, verification_status,
                    social_accounts(follower_count, engagement_rate, platform))
            `)
            .eq('advert_id', project.id)
            .order('created_at', { ascending: false });
        setProjectApps(data || []);
        trackCollabs(data || []);
        setLoadingApps(false);
    };

    // Kabul edilen başvuruların iş birliği aşaması (3.14-S1): Map<application_id, { id, status }>.
    const [appCollabs, setAppCollabs] = useState(new Map());
    const trackCollabs = async (apps) => {
        const accepted = (apps || []).filter((a) => a.status === 'accepted').map((a) => a.id);
        if (!accepted.length) return;
        const found = await loadApplicationCollabs(accepted);
        if (found.size) setAppCollabs((prev) => new Map([...prev, ...found]));
    };

    const updateAppStatus = async (appId, newStatus) => {
        // Durum değişikliği sunucudan geçer (lib/adverts.ts): yetki ve influencer bildirimi web ile aynı.
        const result = await apiRequest(`applications/${appId}`, { method: 'PATCH', body: { status: newStatus } });
        if (result.error) {
            Alert.alert('Hata', result.error);
            return;
        }
        setProjectApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
        // Update allApps too
        setAllApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
        if (newStatus !== 'pending') {
            setPendingCount(prev => Math.max(0, prev - 1));
        }
    };

    // ── Banner image picker ────────────────────────────────────────────────────
    const pickHeroImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaType.Images,
                allowsEditing: true,
                aspect: [16, 9],
                quality: 0.7,
                base64: true,
            });
            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                setHeroImage(asset.uri);
                uploadHeroImage(asset.base64);
            }
        } catch (e) {
            Alert.alert('Hata', 'Fotoğraf seçilemedi.');
        }
    };

    const uploadHeroImage = async (base64Data) => {
        if (!base64Data) return;
        setUploadingHero(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            // Web ile aynı: dosyalar kullanıcının kendi klasörüne yazılır (kova yükleme politikası bunu ister).
            const fileName = `${user.id}/${Date.now()}.jpg`;
            const { error: uploadError } = await supabase.storage
                .from('advert-hero-images')
                .upload(fileName, decode(base64Data), { contentType: 'image/jpeg', upsert: true });
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('advert-hero-images').getPublicUrl(fileName);
            setHeroImageUrl(urlData.publicUrl);
        } catch (e) {
            Alert.alert('Hata', 'Banner yüklenemedi: ' + (e.message || ''));
            setHeroImage(null);
            setHeroImageUrl(null);
        } finally {
            setUploadingHero(false);
        }
    };

    const closeModal = () => {
        setCreateVisible(false);
        setEditMode(false);
        setEditId(null);
        setForm(EMPTY_FORM);
        setHeroImage(null);
        setHeroImageUrl(null);
    };

    const openEditModal = (proj) => {
        setActionSheetProject(null);
        setEditMode(true);
        setEditId(proj.id);
        setForm({
            title: proj.title || '',
            summary: proj.summary || proj.description || '',
            category: proj.category || '',
            location: proj.location || 'Uzaktan',
            platforms: (proj.platforms || []).join(', '),
            deliverables: (proj.deliverables || []).join(', '),
            paymentType: ['barter', 'other'].includes(proj.payment_type) ? proj.payment_type : 'cash',
            currency: proj.budget_currency || 'TRY',
            budgetMin: proj.budget_min != null ? String(Math.round(Number(proj.budget_min))) : '',
            budgetMax: proj.budget_max != null ? String(Math.round(Number(proj.budget_max))) : '',
            deadline: proj.deadline ? String(proj.deadline).slice(0, 10) : '',
            status: ['open', 'paused', 'closed'].includes(proj.status) ? proj.status : 'open',
            questions: (Array.isArray(proj.custom_questions) ? proj.custom_questions : []).map((q) => ({
                id: q.id || newQuestionId(),
                type: q.type || 'text',
                question: q.question || '',
                options: (q.options || []).join('\n'),
            })),
        });
        // Show existing banner as preview (remote URL, not base64)
        if (proj.hero_image) {
            setHeroImage(proj.hero_image);
            setHeroImageUrl(proj.hero_image);
        }
        setCreateVisible(true);
    };

    const toggleProjectStatus = async (proj) => {
        setActionSheetProject(null);
        const newStatus = proj.status === 'open' ? 'closed' : 'open';
        const { error } = await apiRequest(`adverts/${proj.id}`, { method: 'PATCH', body: { status: newStatus } });
        if (error) {
            Alert.alert('Hata', error);
        } else {
            setMyProjects(prev => prev.map(p => p.id === proj.id ? { ...p, status: newStatus } : p));
        }
    };

    const deleteProject = (proj) => {
        setActionSheetProject(null);
        Alert.alert(
            'İlanı Sil',
            `"${proj.title}" adlı ilanı silmek istediğinden emin misin? Bu işlem geri alınamaz.`,
            [
                { text: 'İptal', style: 'cancel' },
                {
                    text: 'Sil', style: 'destructive',
                    onPress: async () => {
                        const { error } = await apiRequest(`adverts/${proj.id}`, { method: 'DELETE' });
                        if (error) {
                            Alert.alert('Hata', error);
                        } else {
                            setMyProjects(prev => prev.filter(p => p.id !== proj.id));
                        }
                    },
                },
            ]
        );
    };

    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const setQuestion = (index, patch) => setForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) }));
    const addQuestion = () => setForm((f) => (f.questions.length >= MAX_QUESTIONS ? f : { ...f, questions: [...f.questions, { id: newQuestionId(), type: 'text', question: '', options: '' }] }));
    const removeQuestion = (index) => setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));

    const createProject = async () => {
        if (!form.title.trim() || !form.summary.trim()) {
            return Alert.alert('Eksik bilgi', 'Başlık ve açıklama alanları zorunlu.');
        }
        if (!heroImageUrl) return Alert.alert('Eksik bilgi', 'Kapak görseli yüklemelisin.');
        if (form.deadline.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(form.deadline.trim())) {
            return Alert.alert('Tarih', 'Son başvuru tarihini YYYY-AA-GG biçiminde yaz (ör. 2026-11-30).');
        }
        setSaving(true);
        try {
            // Rol, onay, kapak görseli, bütçe, soru ve aktif ilan kuralları sunucuda (lib/adverts.ts) web ile aynı uygulanır.
            const cash = form.paymentType === 'cash';
            const body = {
                title: form.title.trim(),
                summary: form.summary.trim(),
                category: form.category.trim() || 'Genel',
                location: form.location.trim() || 'Uzaktan',
                platforms: parseList(form.platforms),
                deliverables: parseList(form.deliverables),
                payment_type: form.paymentType,
                budget_currency: form.currency,
                budget_min: cash && form.budgetMin ? Number(form.budgetMin) : null,
                budget_max: cash && form.budgetMax ? Number(form.budgetMax) : null,
                deadline: form.deadline.trim() || null,
                hero_image: heroImageUrl,
                custom_questions: form.questions
                    .filter((q) => q.question.trim())
                    .map((q) => ({
                        id: q.id,
                        type: q.type,
                        question: q.question.trim(),
                        options: q.type === 'text' ? [] : q.options.split('\n').map((o) => o.trim()).filter(Boolean),
                    })),
            };
            // Uzun açıklama yalnızca yeni ilanda yazılır; düzenlemede (web ile aynı) mevcut açıklama ezilmez.
            if (editMode && editId) {
                body.id = editId;
                body.status = form.status;
            } else {
                body.description = form.summary.trim();
            }

            const result = await apiRequest('adverts', { method: 'POST', body });
            if (result.error) throw new Error(result.error);

            if (editMode && selectedProject?.id === editId) {
                setSelectedProject((p) => (p ? { ...p, title: body.title, status: body.status || p.status } : p));
            }
            closeModal();
            fetchMyProjects(currentUserId);
            setActiveTab('İlanlarım');
        } catch (e) {
            Alert.alert('Kaydedilemedi', e.message || 'İşlem başarısız.');
        } finally {
            setSaving(false);
        }
    };


    // ── Başvuru kartı (ilan ayrıntısı ve Başvurular bölümü ortak) ──
    const renderApplication = (app, showAdvert = false) => {
        const inf = app.influencer;
        const social = inf?.social_accounts?.find((s) => s.platform === 'instagram') || inf?.social_accounts?.[0];
        const collab = app.status === 'accepted' ? appCollabs.get(app.id) : null;
        const s = (collab && COLLAB_STAGE_SHORT[collab.status]) || STATUS_CFG[app.status] || STATUS_CFG.pending;
        return (
            <Card key={app.id} style={{ gap: 10 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Pressable onPress={() => inf && navigation.navigate('InfluencerDetail', { influencer: inf })} accessibilityRole="button">
                        <Avatar name={inf?.full_name || inf?.username} uri={inf?.avatar_url} />
                    </Pressable>
                    <View className="flex-1 min-w-0">
                        <NameWithTick name={inf?.full_name || inf?.username || 'Influencer'} verified={inf?.verification_status === 'verified'} />
                        <Text variant="caption" tone="fg3" numberOfLines={1}>
                            {[social?.follower_count ? `${formatCount(social.follower_count)} takipçi` : null,
                                social?.engagement_rate ? `${formatPercent(social.engagement_rate)} etkileşim` : null,
                                showAdvert ? app.advert?.title : null].filter(Boolean).join(' · ')}
                        </Text>
                    </View>
                    {app.budget_expectation ? <Text weight="semibold">{formatTRY(app.budget_expectation)}</Text> : <Chip label={s.label} tone={s.tone} />}
                </View>
                {app.cover_letter ? <Text variant="small" tone="fg2" numberOfLines={4} style={{ fontSize: 13.5 }}>{app.cover_letter}</Text> : null}
                {app.budget_expectation ? <Chip label={s.label} tone={s.tone} /> : null}
                {app.status === 'pending' || app.status === 'shortlisted' ? (
                    <View className="flex-row" style={{ gap: 8 }}>
                        {app.status === 'pending' ? (
                            <View className="flex-1"><Button title="Kısa liste" icon={Bookmark} variant="secondary" size="md" onPress={() => updateAppStatus(app.id, 'shortlisted')} block /></View>
                        ) : (
                            <View className="flex-1"><Button title="Reddet" variant="danger" size="md" onPress={() => updateAppStatus(app.id, 'rejected')} block /></View>
                        )}
                        <View className="flex-1"><Button title="Kabul et" size="md" onPress={() => updateAppStatus(app.id, 'accepted')} block /></View>
                    </View>
                ) : null}
                {app.status === 'pending' ? (
                    <Text variant="caption" tone="fg3" onPress={() => updateAppStatus(app.id, 'rejected')} suppressHighlighting>Başvuruyu reddet</Text>
                ) : null}
                {collab ? (
                    <Button title="İş birliğine git" variant="secondary" size="md" onPress={() => navigation.navigate('CollaborationDetail', { id: collab.id })} block />
                ) : null}
            </Card>
        );
    };

    // ── İlan ayrıntısı: başvurular ──
    if (selectedProject) {
        const groups = {
            pending: projectApps.filter((a) => a.status === 'pending'),
            shortlisted: projectApps.filter((a) => a.status === 'shortlisted'),
            accepted: projectApps.filter((a) => a.status === 'accepted'),
        };
        const shown = groups[appFilter] || [];
        return (
            <Screen
                scroll
                header={<StackHeader title={selectedProject.title} onBack={() => setSelectedProject(null)} right={<IconButton icon={Ellipsis} onPress={() => setActionSheetProject(selectedProject)} accessibilityLabel="İlan işlemleri" />} />}
            >
                <Segment
                    options={[
                        { key: 'pending', label: 'Yeni', count: groups.pending.length || undefined },
                        { key: 'shortlisted', label: 'Kısa liste', count: groups.shortlisted.length || undefined },
                        { key: 'accepted', label: 'Kabul', count: groups.accepted.length || undefined },
                    ]}
                    value={appFilter}
                    onChange={setAppFilter}
                />
                {loadingApps ? <View className="py-12"><ActivityIndicator color={colors.gold} /></View>
                    : shown.length ? shown.map((app) => renderApplication(app))
                        : (
                            <Card padded={false}>
                                <EmptyState icon={Inbox} title="Başvuru yok" text={projectApps.length ? 'Bu bölümde başvuru yok.' : 'İlanınız yayında; başvurular burada görünecek.'} />
                            </Card>
                        )}
                {renderSheets()}
            </Screen>
        );
    }

    // ── Oluştur/düzenle formu ve ilan işlemleri (alttan açılan sayfalar) ──
    function renderSheets() {
        const proj = actionSheetProject;
        return (
            <>
                <Sheet visible={createVisible} onClose={closeModal} title={editMode ? 'İlanı düzenle' : 'Yeni ilan'} scroll>
                    <Pressable onPress={pickHeroImage} accessibilityRole="button" accessibilityLabel="Kapak görseli seç"
                        className="h-[120px] rounded-[14px] border border-dashed border-line-strong bg-s2 items-center justify-center overflow-hidden">
                        {heroImage ? (
                            <Image source={{ uri: heroImage }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                            <View className="items-center" style={{ gap: 4 }}>
                                <ImagePlus size={22} color={colors.fg3} strokeWidth={ICON_STROKE} />
                                <Text variant="small" tone="fg3">Kapak görseli ekle</Text>
                                <Text variant="caption" tone="fg3">16:9 önerilir</Text>
                            </View>
                        )}
                        {uploadingHero ? <View className="absolute inset-0 bg-black/50 items-center justify-center"><ActivityIndicator color={colors.gold} /></View> : null}
                    </Pressable>
                    <TextField label="İlan başlığı" value={form.title} maxLength={120} onChangeText={(v) => setField('title', v)} placeholder="ör. Kış içecekleri tanıtımı" />
                    <TextField label="Açıklama" multiline value={form.summary} onChangeText={(v) => setField('summary', v)} placeholder="Ne istiyorsun, kimden, hangi tonda?" />
                    <View className="flex-row" style={{ gap: 10 }}>
                        <View className="flex-1"><TextField label="Kategori" maxLength={60} value={form.category} onChangeText={(v) => setField('category', v)} placeholder="ör. Yeme & İçme" /></View>
                        <View className="flex-1"><TextField label="Konum" maxLength={80} value={form.location} onChangeText={(v) => setField('location', v)} placeholder="Uzaktan" /></View>
                    </View>
                    <TextField label="Platformlar" hint="Virgülle ayır" value={form.platforms} onChangeText={(v) => setField('platforms', v)} placeholder="Instagram, TikTok" />
                    <TextField label="Teslimatlar" hint="Virgülle ayır" value={form.deliverables} onChangeText={(v) => setField('deliverables', v)} placeholder="1 Reels, 3 Story" />
                    <View style={{ gap: 7 }}>
                        <Text variant="small" weight="medium" tone="fg2">Ödeme</Text>
                        <Segment options={PAYMENT_OPTIONS} value={form.paymentType} onChange={(v) => setField('paymentType', v)} />
                    </View>
                    {form.paymentType === 'cash' ? (
                        <>
                            <View style={{ gap: 7 }}>
                                <Text variant="small" weight="medium" tone="fg2">Para birimi</Text>
                                <Segment
                                    options={Array.from(new Set(['TRY', 'USD', 'EUR', form.currency])).map((c) => ({ key: c, label: c }))}
                                    value={form.currency}
                                    onChange={(v) => setField('currency', v)}
                                />
                            </View>
                            <View className="flex-row" style={{ gap: 10 }}>
                                <View className="flex-1"><TextField label="En az" keyboardType="number-pad" value={form.budgetMin} onChangeText={(v) => setField('budgetMin', onlyDigits(v))} placeholder="0" /></View>
                                <View className="flex-1"><TextField label="En çok" keyboardType="number-pad" value={form.budgetMax} onChangeText={(v) => setField('budgetMax', onlyDigits(v))} placeholder="0" /></View>
                            </View>
                        </>
                    ) : null}
                    <TextField
                        label="Son başvuru (isteğe bağlı)"
                        hint="YYYY-AA-GG, ör. 2026-11-30"
                        keyboardType="numbers-and-punctuation"
                        maxLength={10}
                        value={form.deadline}
                        onChangeText={(v) => setField('deadline', v.replace(/[^0-9-]/g, ''))}
                        placeholder="2026-11-30"
                    />
                    {editMode ? (
                        <View style={{ gap: 7 }}>
                            <Text variant="small" weight="medium" tone="fg2">Durum</Text>
                            <Segment options={STATUS_OPTIONS} value={form.status} onChange={(v) => setField('status', v)} />
                        </View>
                    ) : null}
                    <View style={{ gap: 10 }}>
                        <View className="flex-row items-center justify-between">
                            <Text variant="small" weight="medium" tone="fg2">Başvuranlara sorular ({form.questions.length}/{MAX_QUESTIONS})</Text>
                            <Button title="Soru ekle" icon={Plus} variant="ghost" size="md" onPress={addQuestion} disabled={form.questions.length >= MAX_QUESTIONS} />
                        </View>
                        {form.questions.map((q, i) => (
                            <Card key={q.id} style={{ gap: 10 }}>
                                <View className="flex-row items-end" style={{ gap: 8 }}>
                                    <View className="flex-1"><TextField label={`${i + 1}. soru`} maxLength={300} value={q.question} onChangeText={(v) => setQuestion(i, { question: v })} placeholder="ör. Daha önce hangi markalarla çalıştın?" /></View>
                                    <IconButton icon={Trash2} onPress={() => removeQuestion(i)} accessibilityLabel="Soruyu sil" />
                                </View>
                                <Segment options={QUESTION_TYPES} value={q.type} onChange={(v) => setQuestion(i, { type: v })} />
                                {q.type !== 'text' ? (
                                    <TextField label="Seçenekler" hint="Her satıra bir seçenek (en az 2)" multiline value={q.options} onChangeText={(v) => setQuestion(i, { options: v })} placeholder={'Evet\nHayır'} />
                                ) : null}
                            </Card>
                        ))}
                    </View>
                    <Button title={editMode ? 'Kaydet' : 'İlanı yayınla'} onPress={createProject} loading={saving} disabled={uploadingHero} block />
                </Sheet>

                <Sheet visible={!!proj} onClose={() => setActionSheetProject(null)} title={proj?.title}>
                    {proj ? (
                        <ListGroup>
                            <ListRow onPress={() => openEditModal(proj)} left={<IconBox icon={Pencil} />} title="Düzenle" chevron />
                            <ListRow
                                onPress={() => { toggleProjectStatus(proj); if (selectedProject?.id === proj.id) setSelectedProject((p) => ({ ...p, status: p.status === 'open' ? 'closed' : 'open' })); }}
                                left={<IconBox icon={proj.status === 'open' ? Pause : Play} />}
                                title={proj.status === 'open' ? 'Yayından kaldır' : 'Yeniden yayınla'}
                            />
                            <ListRow onPress={() => { deleteProject(proj); setSelectedProject(null); }} left={<IconBox icon={Trash2} tone="danger" />} title="Sil" titleTone="danger" />
                        </ListGroup>
                    ) : null}
                </Sheet>
            </>
        );
    }

    const appCount = (proj) => proj.advert_applications?.[0]?.count ?? 0;

    return (
        <Screen
            scroll
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await fetchAll(); setRefreshing(false); }}
            header={<LargeHeader title="İlanlar" right={<Button title="Yeni ilan" icon={Plus} size="md" onPress={() => setCreateVisible(true)} />} />}
        >
            <Segment
                options={[
                    { key: 'İlanlarım', label: 'İlanlarım' },
                    { key: 'Başvurular', label: 'Başvurular', count: pendingCount || undefined },
                    { key: 'Tüm İlanlar', label: 'Topluluk' },
                ]}
                value={activeTab}
                onChange={setActiveTab}
            />

            {activeTab === 'İlanlarım' ? (
                loadingMy ? <View className="py-12"><ActivityIndicator color={colors.gold} /></View>
                    : myProjects.length ? myProjects.map((proj) => {
                        const st = ADV_STATUS_CFG[proj.status] || ADV_STATUS_CFG.draft;
                        const count = appCount(proj);
                        return (
                            <Card key={proj.id} onPress={() => { setAppFilter('pending'); openProject(proj); }} style={{ gap: 10 }}>
                                <View className="flex-row items-start" style={{ gap: 10 }}>
                                    <Text weight="semibold" style={{ fontSize: 16, flex: 1 }} numberOfLines={2}>{proj.title}</Text>
                                    <Chip label={st.label} tone={st.tone} dot />
                                    <IconButton icon={Ellipsis} size={20} onPress={() => setActionSheetProject(proj)} accessibilityLabel="İlan işlemleri" />
                                </View>
                                <View className="flex-row flex-wrap" style={{ gap: 12 }}>
                                    <Text variant="small" tone="fg2">{formatBudget(proj.budget_min, proj.budget_max)}</Text>
                                    {proj.deadline ? <Text variant="small" tone="fg2">{daysLeft(proj.deadline)}</Text> : null}
                                    {proj.category ? <Text variant="small" tone="fg2">{proj.category}</Text> : null}
                                </View>
                                <View className="flex-row items-center justify-between pt-2.5 border-t border-line">
                                    <Text variant="small" tone={count ? 'fg' : 'fg3'}>{count ? `${count} başvuru` : 'Henüz başvuru yok'}</Text>
                                    <ChevronRight size={18} color={colors.fg3} strokeWidth={ICON_STROKE} />
                                </View>
                            </Card>
                        );
                    }) : (
                        <Card padded={false}>
                            <EmptyState icon={Megaphone} title="Henüz ilan yok" text="İlk ilanını oluştur, influencer başvurularını buradan yönet." action={<Button title="Yeni ilan" icon={Plus} size="md" onPress={() => setCreateVisible(true)} />} />
                        </Card>
                    )
            ) : null}

            {activeTab === 'Başvurular' ? (
                loadingAppsAll ? <View className="py-12"><ActivityIndicator color={colors.gold} /></View>
                    : allApps.length ? allApps.map((app) => renderApplication(app, true))
                        : <Card padded={false}><EmptyState icon={Inbox} title="Henüz başvuru yok" text="İlanlarına gelen başvurular burada görünecek." /></Card>
            ) : null}

            {activeTab === 'Tüm İlanlar' ? (
                <>
                    <SearchBar value={searchAll} onChangeText={setSearchAll} placeholder="İlan veya marka ara" />
                    {loadingAll ? <View className="py-12"><ActivityIndicator color={colors.gold} /></View> : (() => {
                        const q = searchAll.trim().toLocaleLowerCase('tr-TR');
                        const rows = q ? allProjects.filter((p) => [p.title, p.displayBrandName].some((v) => (v || '').toLocaleLowerCase('tr-TR').includes(q))) : allProjects;
                        return rows.length ? (
                            <ListGroup>
                                {rows.map((p) => (
                                    <ListRow
                                        key={p.id}
                                        left={<Avatar name={p.displayBrandName} uri={p.brand_logo || p.brand?.avatar_url} square />}
                                        title={p.title}
                                        subtitle={`${p.displayBrandName}${p.currentUserOwns || p.brand_user_id === currentUserId ? ' · senin ilanın' : ''}`}
                                        right={<Text variant="small" weight="semibold">{formatBudget(p.budget_min, p.budget_max)}</Text>}
                                    />
                                ))}
                            </ListGroup>
                        ) : <Card padded={false}><EmptyState icon={Megaphone} title="İlan bulunamadı" /></Card>;
                    })()}
                </>
            ) : null}

            {renderSheets()}
        </Screen>
    );
}
