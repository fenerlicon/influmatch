import React, { useState, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, ActivityIndicator, TextInput, FlatList, Animated, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Plus, Briefcase, ChevronRight, Clock, CheckCircle2, XCircle,
    ArrowLeft, Users, Calendar, FileText, X, Sparkles,
    Search, Filter, Bell, Camera, ImageIcon, MoreVertical, Pause, Play, Trash2, Edit2
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

// ─── Design ───────────────────────────────────────────────────────────────────
const GlassCard = ({ children, className, style, onPress }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.85 : 1} onPress={onPress}
        className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`} style={style}>
        <LinearGradient colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="absolute inset-0" />
        {children}
    </TouchableOpacity>
);

const STATUS_CFG = {
    pending: { label: 'Bekliyor', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    shortlisted: { label: 'Kısa Liste', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
    accepted: { label: 'Kabul', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    rejected: { label: 'Reddedildi', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
};

const ADV_STATUS_CFG = {
    open: { label: 'Aktif', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    closed: { label: 'Kapalı', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    draft: { label: 'Taslak', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

const TABS = ['Tüm İlanlar', 'İlanlarım', 'Başvurular'];

// ─── Tab Bar ─────────────────────────────────────────────────────────────────
function TabBar({ activeTab, setActiveTab, pendingCount }) {
    return (
        <View className="flex-row px-5 pb-3 pt-1 gap-2">
            {TABS.map((tab) => {
                const isActive = activeTab === tab;
                const hasBadge = tab === 'Başvurular' && pendingCount > 0;
                return (
                    <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 rounded-2xl items-center justify-center border relative ${isActive
                            ? 'bg-soft-gold/15 border-soft-gold/40'
                            : 'bg-white/[0.04] border-white/10'
                            }`}
                    >
                        <Text className={`text-[11px] font-bold ${isActive ? 'text-soft-gold' : 'text-gray-500'}`} numberOfLines={1}>
                            {tab}
                        </Text>
                        {hasBadge && (
                            <View className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full items-center justify-center border border-[#020617]">
                                <Text className="text-white text-[8px] font-black">{pendingCount > 9 ? '9+' : pendingCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

// ─── InputField ───────────────────────────────────────────────────────────────
const InputField = ({ label, value, onChange, placeholder, multiline = false, keyboardType = 'default' }) => (
    <View className="mb-4">
        <Text className="text-gray-500 text-[10px] font-bold tracking-widest uppercase mb-2">{label}</Text>
        <View className={`bg-black/30 border border-white/10 rounded-xl px-4 ${multiline ? 'py-3 min-h-[80px]' : 'h-12 justify-center'}`}>
            <TextInput
                className="text-white text-sm"
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor="#4b5563"
                multiline={multiline}
                keyboardType={keyboardType}
                textAlignVertical={multiline ? 'top' : 'center'}
            />
        </View>
    </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandAdvertsScreen({ navigation }) {
    const [activeTab, setActiveTab] = useState('Tüm İlanlar');
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
    const [form, setForm] = useState({ title: '', description: '', budget: '', category: '', deadline: '' });
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
            // Step 1: fetch open ads with same columns as web
            const { data: rows, error } = await supabase
                .from('advert_projects')
                .select('id, title, summary, category, brand_name, budget_currency, budget_min, budget_max, platforms, deliverables, location, hero_image, deadline, status, created_at, brand_user_id')
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(40);

            if (error) {
                console.error('[BrandAdverts] fetchAllProjects error:', error.message);
                setAllProjects([]);
                return;
            }

            if (!rows || rows.length === 0) {
                setAllProjects([]);
                return;
            }

            // Step 2: fetch brand user info separately (same pattern as web)
            const brandUserIds = [...new Set(rows.map(r => r.brand_user_id).filter(Boolean))];
            let brandMap = {};
            if (brandUserIds.length > 0) {
                const { data: brandUsers } = await supabase
                    .from('users')
                    .select('id, full_name, company_legal_name, avatar_url, verification_status')
                    .in('id', brandUserIds);
                brandUsers?.forEach(u => { brandMap[u.id] = u; });
            }

            // Step 3: merge — use brand_name field first, then company_legal_name, then full_name
            const merged = rows.map(row => {
                const brandUser = row.brand_user_id ? brandMap[row.brand_user_id] : null;
                return {
                    ...row,
                    brand: brandUser || null,
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
        setLoadingApps(false);
    };

    const updateAppStatus = async (appId, newStatus) => {
        await supabase.from('advert_applications').update({ status: newStatus }).eq('id', appId);
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
            const fileName = `${user.id}_${Date.now()}.jpg`;
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
        setForm({ title: '', description: '', budget: '', category: '', deadline: '' });
        setHeroImage(null);
        setHeroImageUrl(null);
    };

    const openEditModal = (proj) => {
        setActionSheetProject(null);
        setEditMode(true);
        setEditId(proj.id);
        setForm({
            title: proj.title || '',
            description: proj.summary || proj.description || '',
            budget: proj.budget_min ? String(proj.budget_min) : '',
            category: proj.category || '',
            deadline: proj.deadline || '',
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
        const { error } = await supabase
            .from('advert_projects')
            .update({ status: newStatus })
            .eq('id', proj.id);
        if (error) {
            Alert.alert('Hata', error.message);
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
                        const { error } = await supabase
                            .from('advert_projects')
                            .delete()
                            .eq('id', proj.id);
                        if (error) {
                            Alert.alert('Hata', error.message);
                        } else {
                            setMyProjects(prev => prev.filter(p => p.id !== proj.id));
                        }
                    },
                },
            ]
        );
    };

    const createProject = async () => {
        if (!form.title.trim() || !form.description.trim()) {
            return Alert.alert('Hata', 'Başlık ve açıklama alanları zorunlu.');
        }
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();

            // Profil onay durumu ve rol bilgisi alınıyor
            const { data: userProfile, error: profileError } = await supabase
                .from('users')
                .select('role, verification_status')
                .eq('id', user.id)
                .single();

            if (profileError || !userProfile) {
                throw new Error('Kullanıcı bilgileri alınamadı.');
            }

            if (userProfile.role !== 'brand') {
                throw new Error('Sadece MARKALAR ilan oluşturabilir.');
            }

            if (userProfile.verification_status !== 'verified') {
                throw new Error('Hesabınız henüz onaylanmadı. İlan oluşturabilmek için hesabınızın onaylanması gerekmektedir.');
            }

            const payload = {
                title: form.title.trim(),
                summary: form.description.trim(),
                description: form.description.trim(),
                budget_min: form.budget ? parseFloat(form.budget) : null,
                category: form.category.trim() || null,
                deadline: form.deadline.trim() || null,
                hero_image: heroImageUrl || null,
            };

            if (editMode && editId) {
                // UPDATE existing
                const { error } = await supabase
                    .from('advert_projects')
                    .update(payload)
                    .eq('id', editId);
                if (error) throw error;
            } else {
                // INSERT new
                const { error } = await supabase.from('advert_projects').insert({
                    ...payload,
                    brand_user_id: user.id,
                    brand_id: user.id,
                    status: 'open',
                });
                if (error) throw error;
            }

            closeModal();
            fetchMyProjects(currentUserId);
            setActiveTab('İlanlarım');
        } catch (e) {
            Alert.alert('Hata', e.message || 'İşlem başarısız.');
        } finally {
            setSaving(false);
        }
    };

    // ── Project detail view (shared by İlanlarım tab) ─────────────────────────
    if (selectedProject) {
        return (
            <View className="flex-1 bg-[#020617]">
                <StatusBar style="light" />
                <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
                <SafeAreaView className="flex-1">
                    <View className="px-6 py-4 flex-row items-center gap-3 border-b border-white/5">
                        <TouchableOpacity onPress={() => setSelectedProject(null)} className="w-10 h-10 bg-white/5 rounded-2xl items-center justify-center border border-white/10">
                            <ArrowLeft color="white" size={20} />
                        </TouchableOpacity>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-base" numberOfLines={1}>{selectedProject.title}</Text>
                            <Text className="text-gray-500 text-xs">{projectApps.length} başvuru</Text>
                        </View>
                    </View>

                    {loadingApps ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color="#D4AF37" />
                        </View>
                    ) : projectApps.length === 0 ? (
                        <View className="flex-1 items-center justify-center px-8">
                            <View className="w-14 h-14 bg-white/5 rounded-full items-center justify-center mb-4">
                                <Users color="#4b5563" size={24} />
                            </View>
                            <Text className="text-white font-bold text-base mb-1">Henüz başvuru yok</Text>
                            <Text className="text-gray-500 text-sm text-center">İlanınız yayında — başvurular burada görünecek.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={projectApps}
                            keyExtractor={a => a.id}
                            contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                            renderItem={({ item: app }) => {
                                const inf = app.influencer;
                                const ig = inf?.social_accounts?.find(s => s.platform === 'instagram');
                                const st = STATUS_CFG[app.status] || STATUS_CFG.pending;
                                return (
                                    <GlassCard className="p-4 mb-4">
                                        <View className="flex-row items-center gap-3 mb-3">
                                            <View className="w-12 h-12 rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden items-center justify-center">
                                                {inf?.avatar_url
                                                    ? <Image source={{ uri: inf.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                                    : <Text className="text-white font-bold text-lg">{(inf?.full_name || '?').charAt(0)}</Text>}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white font-bold text-sm">{inf?.full_name || inf?.username}</Text>
                                                <Text className="text-gray-500 text-xs">@{inf?.username}</Text>
                                            </View>
                                            <View className="px-3 py-1.5 rounded-xl" style={{ backgroundColor: st.bg }}>
                                                <Text className="text-xs font-bold" style={{ color: st.color }}>{st.label}</Text>
                                            </View>
                                        </View>

                                        {ig && (
                                            <View className="flex-row gap-3 mb-3">
                                                <View className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5">
                                                    <Text className="text-gray-500 text-[10px] uppercase font-bold">Takipçi</Text>
                                                    <Text className="text-white font-bold text-base">
                                                        {ig.follower_count > 1000 ? (ig.follower_count / 1000).toFixed(1) + 'K' : ig.follower_count}
                                                    </Text>
                                                </View>
                                                <View className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5">
                                                    <Text className="text-soft-gold text-[10px] uppercase font-bold">Etkileşim</Text>
                                                    <Text className="text-white font-bold text-base">%{ig.engagement_rate}</Text>
                                                </View>
                                            </View>
                                        )}

                                        {app.cover_letter && (
                                            <View className="bg-black/20 rounded-xl p-3 mb-3 border border-white/5">
                                                <Text className="text-gray-400 text-xs leading-4" numberOfLines={3}>{app.cover_letter}</Text>
                                            </View>
                                        )}

                                        {app.budget_expectation && (
                                            <View className="flex-row items-center gap-2 mb-3">
                                                <Text className="text-soft-gold text-xs font-medium">
                                                    {app.payment_type === 'barter' ? 'Barter' : app.budget_expectation + ' ₺'}
                                                </Text>
                                            </View>
                                        )}

                                        {app.status === 'pending' && (
                                            <View className="flex-row gap-2">
                                                <TouchableOpacity onPress={() => updateAppStatus(app.id, 'accepted')}
                                                    className="flex-1 h-10 bg-green-500/10 border border-green-500/25 rounded-xl items-center justify-center">
                                                    <Text className="text-green-400 font-bold text-sm">Kabul Et</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => updateAppStatus(app.id, 'shortlisted')}
                                                    className="flex-1 h-10 bg-purple-500/10 border border-purple-500/25 rounded-xl items-center justify-center">
                                                    <Text className="text-purple-300 font-bold text-sm">Kısa Liste</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => updateAppStatus(app.id, 'rejected')}
                                                    className="w-10 h-10 bg-red-500/10 border border-red-500/25 rounded-xl items-center justify-center">
                                                    <X color="#f87171" size={16} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </GlassCard>
                                );
                            }}
                        />
                    )}
                </SafeAreaView>
            </View>
        );
    }

    // ── Main tabs view ────────────────────────────────────────────────────────
    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />

            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 pt-4 pb-2 flex-row items-start justify-between">
                    <View>
                        <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mb-1">MARKA PANELİ</Text>
                        <Text className="text-white text-3xl font-bold tracking-tight">İlanlar</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCreateVisible(true)}
                        className="flex-row items-center gap-1 bg-soft-gold/10 border border-soft-gold/30 px-2.5 py-1 rounded-lg">
                        <Plus color="#D4AF37" size={14} />
                        <Text className="text-soft-gold font-bold text-base">Yeni İlan</Text>
                    </TouchableOpacity>
                </View>

                {/* Tab Bar */}
                <TabBar activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={pendingCount} />

                {/* ── Tab: Başvurular ────────────────────────────────────────── */}
                {activeTab === 'Başvurular' && (
                    loadingAppsAll ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color="#D4AF37" />
                        </View>
                    ) : allApps.length === 0 ? (
                        <View className="flex-1 items-center justify-center px-8">
                            <View className="w-16 h-16 bg-white/5 rounded-full items-center justify-center mb-4">
                                <Bell color="#4b5563" size={28} />
                            </View>
                            <Text className="text-white font-bold text-lg mb-2">Başvuru Yok</Text>
                            <Text className="text-gray-500 text-sm text-center leading-5">İlanlarınıza gelen başvurular burada görünecek.</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={allApps}
                            keyExtractor={a => a.id}
                            contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item: app }) => {
                                const inf = app.influencer;
                                const ig = inf?.social_accounts?.find(s => s.platform === 'instagram');
                                const st = STATUS_CFG[app.status] || STATUS_CFG.pending;
                                return (
                                    <GlassCard className="p-4 mb-3">
                                        {/* İlan başlığı */}
                                        {app.advert?.title && (
                                            <View className="bg-soft-gold/8 border border-soft-gold/20 rounded-xl px-3 py-1.5 mb-3 self-start">
                                                <Text className="text-soft-gold text-[10px] font-bold" numberOfLines={1}>{app.advert.title}</Text>
                                            </View>
                                        )}
                                        <View className="flex-row items-center gap-3 mb-3">
                                            <View className="w-11 h-11 rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden items-center justify-center">
                                                {inf?.avatar_url
                                                    ? <Image source={{ uri: inf.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                                    : <Text className="text-white font-bold">{(inf?.full_name || '?').charAt(0)}</Text>}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white font-bold text-sm">{inf?.full_name || inf?.username}</Text>
                                                <Text className="text-gray-500 text-xs">@{inf?.username} · {ig ? (ig.follower_count > 1000 ? (ig.follower_count / 1000).toFixed(1) + 'K' : ig.follower_count) + ' takipçi' : 'IG yok'}</Text>
                                            </View>
                                            <View className="px-2.5 py-1.5 rounded-xl" style={{ backgroundColor: st.bg }}>
                                                <Text className="text-[10px] font-bold" style={{ color: st.color }}>{st.label}</Text>
                                            </View>
                                        </View>
                                        {app.cover_letter && (
                                            <Text className="text-gray-400 text-xs leading-4 mb-3" numberOfLines={2}>{app.cover_letter}</Text>
                                        )}
                                        {app.status === 'pending' && (
                                            <View className="flex-row gap-2">
                                                <TouchableOpacity onPress={() => updateAppStatus(app.id, 'accepted')}
                                                    className="flex-1 h-9 bg-green-500/10 border border-green-500/25 rounded-xl items-center justify-center">
                                                    <Text className="text-green-400 font-bold text-xs">Kabul Et</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => updateAppStatus(app.id, 'shortlisted')}
                                                    className="flex-1 h-9 bg-purple-500/10 border border-purple-500/25 rounded-xl items-center justify-center">
                                                    <Text className="text-purple-300 font-bold text-xs">Kısa Liste</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => updateAppStatus(app.id, 'rejected')}
                                                    className="w-9 h-9 bg-red-500/10 border border-red-500/25 rounded-xl items-center justify-center">
                                                    <X color="#f87171" size={14} />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </GlassCard>
                                );
                            }}
                        />
                    )
                )}

                {/* ── Tab: Tüm İlanlar ───────────────────────────────────────── */}
                {activeTab === 'Tüm İlanlar' && (
                    <View className="flex-1">
                        <View className="px-5 pb-3">
                            <View className="bg-white/5 border border-white/10 rounded-2xl flex-row items-center px-4 h-11">
                                <Search color="#6b7280" size={16} />
                                <TextInput
                                    className="flex-1 ml-3 text-white text-sm"
                                    placeholder="İlan ara..."
                                    placeholderTextColor="#6b7280"
                                    value={searchAll}
                                    onChangeText={setSearchAll}
                                />
                            </View>
                        </View>
                        {loadingAll ? (
                            <View className="flex-1 items-center justify-center">
                                <ActivityIndicator color="#D4AF37" />
                            </View>
                        ) : (
                            <FlatList
                                data={allProjects.filter(p =>
                                    !searchAll || p.title?.toLowerCase().includes(searchAll.toLowerCase()) ||
                                    p.displayBrandName?.toLowerCase().includes(searchAll.toLowerCase())
                                )}
                                keyExtractor={p => p.id}
                                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                                showsVerticalScrollIndicator={false}
                                ListEmptyComponent={
                                    <View className="items-center py-16">
                                        <Briefcase color="#374151" size={40} />
                                        <Text className="text-gray-500 mt-4 text-sm">İlan bulunamadı.</Text>
                                    </View>
                                }
                                renderItem={({ item: proj }) => {
                                    const brandName = proj.displayBrandName || 'Marka';
                                    const desc = proj.summary || proj.description || '';
                                    return (
                                        <GlassCard className="p-5 mb-3">
                                            <View className="flex-row items-start justify-between mb-2">
                                                <View className="flex-1 mr-3">
                                                    <Text className="text-white font-bold text-base mb-1" numberOfLines={2}>{proj.title}</Text>
                                                    <Text className="text-gray-500 text-xs font-medium">{brandName}</Text>
                                                </View>
                                                {proj.category && (
                                                    <View className="bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                                                        <Text className="text-gray-400 text-[10px] font-bold uppercase">{proj.category}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            {desc ? (
                                                <Text className="text-gray-400 text-xs leading-4 mb-3" numberOfLines={2}>{desc}</Text>
                                            ) : null}
                                            <View className="flex-row items-center justify-between pt-3 border-t border-white/5">
                                                {proj.budget_min != null && (
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Text className="text-soft-gold text-xs font-bold">{(proj.budget_min).toLocaleString('tr-TR')} ₺'den başlayan</Text>
                                                    </View>
                                                )}
                                                <Text className="text-gray-600 text-[10px]">
                                                    {new Date(proj.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                                </Text>
                                            </View>
                                        </GlassCard>
                                    );
                                }}
                            />
                        )}
                    </View>
                )}

                {/* ── Tab: İlanlarım ────────────────────────────────────────── */}
                {activeTab === 'İlanlarım' && (
                    loadingMy ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color="#D4AF37" />
                        </View>
                    ) : myProjects.length === 0 ? (
                        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32 }}>
                            <GlassCard className="p-8 items-center">
                                <View className="w-16 h-16 bg-white/5 rounded-full items-center justify-center mb-4">
                                    <Briefcase color="#4b5563" size={28} />
                                </View>
                                <Text className="text-white font-bold text-lg mb-2">İlan Yok</Text>
                                <Text className="text-gray-500 text-sm text-center mb-5">İlk ilanını oluştur, influencer başvurularını yönet.</Text>
                                <TouchableOpacity onPress={() => setCreateVisible(true)}
                                    className="bg-soft-gold px-6 py-3 rounded-2xl flex-row items-center gap-2">
                                    <Plus color="black" size={16} />
                                    <Text className="text-midnight font-bold">İlan Oluştur</Text>
                                </TouchableOpacity>
                            </GlassCard>
                        </ScrollView>
                    ) : (
                        <FlatList
                            data={myProjects}
                            keyExtractor={p => p.id}
                            contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
                            showsVerticalScrollIndicator={false}
                            renderItem={({ item: proj }) => {
                                const st = ADV_STATUS_CFG[proj.status] || ADV_STATUS_CFG.open;
                                const appCount = proj.advert_applications?.[0]?.count || 0;
                                return (
                                    <GlassCard className="p-5 mb-4" onPress={() => openProject(proj)}>
                                        <View className="flex-row items-start justify-between mb-3">
                                            <View className="flex-1 mr-3">
                                                <Text className="text-white font-bold text-base mb-1" numberOfLines={2}>{proj.title}</Text>
                                                {proj.category && (
                                                    <View className="bg-white/5 self-start px-2 py-0.5 rounded-lg border border-white/10">
                                                        <Text className="text-gray-400 text-[10px] font-bold uppercase">{proj.category}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View className="flex-row items-center gap-2">
                                                <View className="px-2.5 py-1.5 rounded-xl" style={{ backgroundColor: st.bg }}>
                                                    <Text className="text-xs font-bold" style={{ color: st.color }}>{st.label}</Text>
                                                </View>
                                                <TouchableOpacity
                                                    onPress={(e) => { e.stopPropagation?.(); setActionSheetProject(proj); }}
                                                    className="w-8 h-8 bg-white/5 rounded-xl items-center justify-center border border-white/10"
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <MoreVertical color="#9ca3af" size={16} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {(proj.summary || proj.description) ? (
                                            <Text className="text-gray-400 text-xs leading-4 mb-3" numberOfLines={2}>{proj.summary || proj.description}</Text>
                                        ) : null}

                                        <View className="flex-row items-center justify-between pt-3 border-t border-white/5">
                                            <View className="flex-row items-center gap-4">
                                                {proj.budget_min && (
                                                    <View className="flex-row items-center gap-1.5">
                                                        <Text className="text-soft-gold text-xs font-bold">{proj.budget_min} ₺</Text>
                                                    </View>
                                                )}
                                                <View className="flex-row items-center gap-1.5">
                                                    <Users color="#a855f7" size={12} />
                                                    <Text className="text-purple-300 text-xs font-bold">{appCount} başvuru</Text>
                                                </View>
                                            </View>
                                            <ChevronRight color="#4b5563" size={16} />
                                        </View>
                                    </GlassCard>
                                );
                            }}
                        />
                    )
                )}
            </SafeAreaView>

            {/* ── Action Sheet Modal ──────────────────────────────────────── */}
            <Modal animationType="slide" transparent visible={!!actionSheetProject} onRequestClose={() => setActionSheetProject(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setActionSheetProject(null)} />
                    <View style={{ backgroundColor: '#0B0F19', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', paddingBottom: 36 }}>
                        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                        </View>
                        <View style={{ paddingHorizontal: 16 }}>
                            <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', paddingHorizontal: 8, marginBottom: 8 }}>
                                {actionSheetProject?.title}
                            </Text>

                            {/* Edit */}
                            <TouchableOpacity onPress={() => openEditModal(actionSheetProject)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, marginBottom: 4 }}>
                                <View style={{ width: 38, height: 38, backgroundColor: 'rgba(212,175,55,0.12)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                    <Edit2 color="#D4AF37" size={17} />
                                </View>
                                <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Düzenle</Text>
                            </TouchableOpacity>

                            {/* Change Status */}
                            <TouchableOpacity onPress={() => toggleProjectStatus(actionSheetProject)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, marginBottom: 4 }}>
                                <View style={{ width: 38, height: 38, backgroundColor: actionSheetProject?.status === 'open' ? 'rgba(248,113,113,0.12)' : 'rgba(74,222,128,0.12)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                    {actionSheetProject?.status === 'open'
                                        ? <Pause color="#f87171" size={17} />
                                        : <Play color="#4ade80" size={17} />}
                                </View>
                                <Text style={{ color: actionSheetProject?.status === 'open' ? '#f87171' : '#4ade80', fontWeight: '600', fontSize: 15 }}>
                                    {actionSheetProject?.status === 'open' ? 'İlanı Kapat' : 'İlanı Aktifleştir'}
                                </Text>
                            </TouchableOpacity>

                            {/* Delete */}
                            <TouchableOpacity onPress={() => deleteProject(actionSheetProject)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, marginBottom: 4 }}>
                                <View style={{ width: 38, height: 38, backgroundColor: 'rgba(248,113,113,0.12)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                    <Trash2 color="#f87171" size={17} />
                                </View>
                                <Text style={{ color: '#f87171', fontWeight: '600', fontSize: 15 }}>Sil</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ── Create / Edit Modal ─────────────────────────────────────── */}
            <Modal animationType="slide" transparent visible={createVisible} onRequestClose={closeModal}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
                        <TouchableOpacity style={{ flex: 1 }} onPress={() => { setCreateVisible(false); setHeroImage(null); setHeroImageUrl(null); }} />
                        <View style={{ backgroundColor: '#0B0F19', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)', maxHeight: '92%' }}>
                            {/* Drag handle */}
                            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
                                <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                keyboardShouldPersistTaps="handled"
                                contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 }}
                            >
                                <View className="flex-row items-center justify-between mb-5">
                                    <Text className="text-white font-bold text-xl">{editMode ? 'İlanı Düzenle' : 'Yeni İlan Oluştur'}</Text>
                                    <TouchableOpacity onPress={closeModal} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                        <X color="white" size={18} />
                                    </TouchableOpacity>
                                </View>

                                {/* Banner Image Picker */}
                                <TouchableOpacity
                                    onPress={pickHeroImage}
                                    disabled={uploadingHero}
                                    className="rounded-2xl overflow-hidden border-2 border-dashed border-white/20 mb-5"
                                    style={{ height: 140 }}
                                >
                                    {heroImage ? (
                                        <View className="flex-1">
                                            <Image source={{ uri: heroImage }} className="w-full h-full" resizeMode="cover" />
                                            {uploadingHero && (
                                                <View className="absolute inset-0 bg-black/60 items-center justify-center">
                                                    <ActivityIndicator color="#D4AF37" size="small" />
                                                    <Text className="text-white text-xs mt-2">Yükleniyor...</Text>
                                                </View>
                                            )}
                                            {!uploadingHero && heroImageUrl && (
                                                <View className="absolute bottom-2 right-2 bg-green-500/90 px-2 py-1 rounded-lg">
                                                    <Text className="text-white text-[10px] font-bold">✓ Yüklendi</Text>
                                                </View>
                                            )}
                                        </View>
                                    ) : (
                                        <View className="flex-1 items-center justify-center gap-2">
                                            <View className="w-10 h-10 bg-white/5 rounded-full items-center justify-center">
                                                <ImageIcon color="#6b7280" size={20} />
                                            </View>
                                            <Text className="text-gray-500 text-xs font-medium">İlan Banneri Ekle</Text>
                                            <Text className="text-gray-600 text-[10px]">16:9 oranı önerilir</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                <InputField label="İlan Başlığı *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Ör: Instagram Reel için Ortak" />
                                <InputField label="Açıklama *" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Marka ve kampanya hakkında bilgi ver..." multiline />
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <InputField label="Bütçe (₺)" value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} placeholder="0" keyboardType="numeric" />
                                    </View>
                                    <View className="flex-1">
                                        <InputField label="Kategori" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Moda, Teknoloji..." />
                                    </View>
                                </View>

                                <TouchableOpacity onPress={createProject} disabled={saving || uploadingHero}
                                    className={`h-14 rounded-2xl items-center justify-center shadow-lg shadow-soft-gold/20 mt-2 ${(saving || uploadingHero) ? 'bg-soft-gold/50' : 'bg-soft-gold'}`}>
                                    {saving ? <ActivityIndicator color="black" /> : <Text className="text-midnight font-bold text-base">{uploadingHero ? 'Banner yükleniyor...' : (editMode ? 'Değişiklikleri Kaydet' : 'İlanı Yayınla')}</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
