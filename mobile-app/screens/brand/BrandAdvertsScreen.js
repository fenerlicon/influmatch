import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, ActivityIndicator, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import {
    Plus, Briefcase, ChevronRight, Clock, CheckCircle2, XCircle,
    ArrowLeft, Users, Calendar, DollarSign, FileText, X, Sparkles
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

const APP_STATUS_CFG = {
    open: { label: 'Aktif', color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
    closed: { label: 'Kapalı', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    draft: { label: 'Taslak', color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function BrandAdvertsScreen({ navigation }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectApps, setProjectApps] = useState([]);
    const [loadingApps, setLoadingApps] = useState(false);

    // New project sheet state
    const [createVisible, setCreateVisible] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', budget: '', category: '', deadline: '' });
    const [saving, setSaving] = useState(false);

    const fetchProjects = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('advert_projects')
                .select('*, advert_applications(count)')
                .eq('brand_user_id', user.id)
                .order('created_at', { ascending: false });

            setProjects(data || []);
        } catch (e) {
            console.error('[BrandAdverts]', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { fetchProjects(); }, [fetchProjects]));

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
    };

    const createProject = async () => {
        if (!form.title.trim() || !form.description.trim()) {
            return Alert.alert('Hata', 'Başlık ve açıklama alanları zorunlu.');
        }
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const { error } = await supabase.from('advert_projects').insert({
                brand_user_id: user.id,
                title: form.title.trim(),
                description: form.description.trim(),
                budget: form.budget ? parseFloat(form.budget) : null,
                category: form.category.trim() || null,
                deadline: form.deadline.trim() || null,
                status: 'open',
            });
            if (error) throw error;
            setCreateVisible(false);
            setForm({ title: '', description: '', budget: '', category: '', deadline: '' });
            fetchProjects();
        } catch (e) {
            Alert.alert('Hata', e.message || 'İlan oluşturulamadı.');
        } finally {
            setSaving(false);
        }
    };

    const InputField = ({ label, value, onChange, placeholder, multiline = false }) => (
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
                    textAlignVertical={multiline ? 'top' : 'center'}
                />
            </View>
        </View>
    );

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    // ── Project Detail Modal ──────────────────────────────────────────────────
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
                                        {/* Applicant */}
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

                                        {/* Stats row */}
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

                                        {/* Cover letter */}
                                        {app.cover_letter && (
                                            <View className="bg-black/20 rounded-xl p-3 mb-3 border border-white/5">
                                                <Text className="text-gray-400 text-xs leading-4" numberOfLines={3}>{app.cover_letter}</Text>
                                            </View>
                                        )}

                                        {/* Budget proposed */}
                                        {app.budget_expectation && (
                                            <View className="flex-row items-center gap-2 mb-3">
                                                <DollarSign color="#D4AF37" size={13} />
                                                <Text className="text-soft-gold text-xs font-medium">
                                                    {app.payment_type === 'barter' ? 'Barter' : app.budget_expectation + ' ₺'}
                                                </Text>
                                            </View>
                                        )}

                                        {/* Action buttons */}
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

    // ── Project List ──────────────────────────────────────────────────────────
    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <View className="absolute top-0 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[100px]" />

            <SafeAreaView className="flex-1">
                <View className="px-6 pt-4 pb-2 flex-row items-start justify-between">
                    <View>
                        <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest mb-1">MARKA PANELİ</Text>
                        <Text className="text-white text-3xl font-bold tracking-tight">İlanlarım</Text>
                    </View>
                    <TouchableOpacity onPress={() => setCreateVisible(true)}
                        className="mt-2 flex-row items-center gap-2 bg-soft-gold/10 border border-soft-gold/30 px-4 py-2.5 rounded-2xl">
                        <Plus color="#D4AF37" size={16} />
                        <Text className="text-soft-gold font-bold text-sm">Yeni İlan</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {projects.length === 0 ? (
                        <GlassCard className="p-8 items-center mt-2">
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
                    ) : (
                        projects.map((proj) => {
                            const st = APP_STATUS_CFG[proj.status] || APP_STATUS_CFG.open;
                            const appCount = proj.advert_applications?.[0]?.count || 0;
                            return (
                                <GlassCard key={proj.id} className="p-5 mb-4" onPress={() => openProject(proj)}>
                                    <View className="flex-row items-start justify-between mb-3">
                                        <View className="flex-1 mr-3">
                                            <Text className="text-white font-bold text-base mb-1" numberOfLines={2}>{proj.title}</Text>
                                            {proj.category && (
                                                <View className="bg-white/5 self-start px-2 py-0.5 rounded-lg border border-white/10">
                                                    <Text className="text-gray-400 text-[10px] font-bold uppercase">{proj.category}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <View className="px-3 py-1.5 rounded-xl" style={{ backgroundColor: st.bg }}>
                                            <Text className="text-xs font-bold" style={{ color: st.color }}>{st.label}</Text>
                                        </View>
                                    </View>

                                    {proj.description && (
                                        <Text className="text-gray-400 text-xs leading-4 mb-3" numberOfLines={2}>{proj.description}</Text>
                                    )}

                                    <View className="flex-row items-center justify-between pt-3 border-t border-white/5">
                                        <View className="flex-row items-center gap-4">
                                            {proj.budget && (
                                                <View className="flex-row items-center gap-1.5">
                                                    <DollarSign color="#D4AF37" size={12} />
                                                    <Text className="text-soft-gold text-xs font-bold">{proj.budget} ₺</Text>
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
                        })
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* ── Create Project Modal ─────────────────────────────────────── */}
            <Modal animationType="slide" transparent visible={createVisible} onRequestClose={() => setCreateVisible(false)}>
                <View className="flex-1 bg-black/80 justify-end">
                    <TouchableOpacity className="flex-1" onPress={() => setCreateVisible(false)} />
                    <View className="bg-[#0B0F19] rounded-t-[32px] border-t border-white/10 px-6 pt-6 pb-12">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-white font-bold text-xl">Yeni İlan Oluştur</Text>
                            <TouchableOpacity onPress={() => setCreateVisible(false)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                <X color="white" size={18} />
                            </TouchableOpacity>
                        </View>

                        <InputField label="İlan Başlığı *" value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Ör: Instagram Reel için Ortak" />
                        <InputField label="Açıklama *" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Marka ve kampanya hakkında bilgi ver..." multiline />
                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <InputField label="Bütçe (₺)" value={form.budget} onChange={v => setForm(f => ({ ...f, budget: v }))} placeholder="0" />
                            </View>
                            <View className="flex-1">
                                <InputField label="Kategori" value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Moda, Teknoloji..." />
                            </View>
                        </View>

                        <TouchableOpacity onPress={createProject} disabled={saving}
                            className="bg-soft-gold h-14 rounded-2xl items-center justify-center shadow-lg shadow-soft-gold/20">
                            {saving ? <ActivityIndicator color="black" /> : <Text className="text-midnight font-bold text-base">İlanı Yayınla</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
