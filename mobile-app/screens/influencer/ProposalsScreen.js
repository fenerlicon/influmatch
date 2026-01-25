import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert, ActivityIndicator, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Clock, CheckCircle2, ChevronRight, Briefcase, Building2, Calendar, DollarSign, X, CheckCircle, BarChart3, TrendingUp, Info } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';

const { width } = Dimensions.get('window');

// --- REUSABLE GLASS COMPONENTS ---
const GlassCard = ({ children, className, style, onPress, activeOpacity = 0.9 }) => (
    <TouchableOpacity
        activeOpacity={onPress ? activeOpacity : 1}
        onPress={onPress}
        style={style}
        className={`rounded-[24px] overflow-hidden border border-white/10 relative ${className}`}
    >
        <LinearGradient
            colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="absolute inset-0"
        />
        {children}
    </TouchableOpacity>
);

export default function ProposalsScreen({ route, navigation }) {
    const [activeTab, setActiveTab] = useState('projects'); // projects, applications
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [applicationModalVisible, setApplicationModalVisible] = useState(false);

    // Custom Confirmation Modal State
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [isApplying, setIsApplying] = useState(false);

    // Form States
    const [coverLetter, setCoverLetter] = useState('');
    const [deliveryItem, setDeliveryItem] = useState('');
    const [paymentType, setPaymentType] = useState('cash'); // 'cash' | 'barter'
    const [budgetExpectation, setBudgetExpectation] = useState('');

    // Real Data States
    const [projects, setProjects] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter params
    const incomingProject = route.params?.project;

    // Handle Deep Linking / Params
    useEffect(() => {
        if (incomingProject) {
            // If we received a project from navigation, open it immediately
            setSelectedProject(incomingProject);
            setProjectModalVisible(true);
            // Clear params to avoid reopening on simple re-renders is tricky with just params, 
            // but standard pattern is fine for now or resetting params
            navigation.setParams({ project: null });
        }
    }, [incomingProject]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [])
    );

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Active Projects
            const { data: projectsData, error: projectsError } = await supabase
                .from('advert_projects')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;
            setProjects(projectsData || []);

            // 2. Fetch My Applications
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: appsData, error: appsError } = await supabase
                    .from('advert_applications')
                    .select('*, advert_projects!advert_applications_advert_id_fkey(*)') // Use explicit FK avoid ambiguity
                    .eq('influencer_user_id', user.id)
                    .order('created_at', { ascending: false });

                if (appsError) throw appsError;
                setApplications(appsData || []);
            }
        } catch (error) {
            console.error('Error fetching proposals:', error);
            // Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const openProject = (project) => {
        setSelectedProject(project);
        setProjectModalVisible(true);
    };

    const closeProject = () => {
        setProjectModalVisible(false);
        setSelectedProject(null);
    };

    const openApplication = (application) => {
        setSelectedApplication(application);
        setApplicationModalVisible(true);
    };

    const closeApplication = () => {
        setApplicationModalVisible(false);
        setSelectedApplication(null);
    };

    const handleApply = (project) => {
        if (!project) return;
        setSelectedProject(project);
        setProjectModalVisible(false);
        setConfirmModalVisible(true);
    };

    const executeApply = async () => {
        if (!selectedProject) return;
        setIsApplying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Kullanıcı bulunamadı.");

            // Detayları cover_letter'a ekle (Schema uyumluluğu için)
            const fullCoverLetter = `${coverLetter}\n\n--- Teklif Detayları ---\nTeslimat: ${deliveryItem}\nÖdeme Tercihi: ${paymentType === 'cash' ? 'Nakit' : 'Barter'}`;

            const { error } = await supabase
                .from('advert_applications')
                .insert({
                    advert_id: selectedProject.id,
                    influencer_user_id: user.id,
                    status: 'pending',
                    cover_letter: fullCoverLetter,
                    budget_expectation: budgetExpectation ? parseInt(budgetExpectation) : 0
                });

            if (error) {
                console.error('Başvuru hatası:', error);
                throw new Error("Başvuru gönderilemedi: " + error.message);
            }

            setConfirmModalVisible(false);
            Alert.alert("Başarılı", "Başvurunuz markaya iletildi!");
            fetchData();
            setActiveTab('applications');
        } catch (error) {
            Alert.alert("Hata", error.message);
        } finally {
            setIsApplying(false);
        }
    };

    const getStatusInfo = (status) => {
        switch (status) {
            case 'pending': return { text: 'BEKLİYOR', color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
            case 'shortlisted': return { text: 'DEĞERLENDİRİLİYOR', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
            case 'accepted': return { text: 'KABUL EDİLDİ', color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' };
            case 'rejected': return { text: 'REDDEDİLDİ', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' };
            default: return { text: status?.toUpperCase(), color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
        }
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />

            {/* MASTER BACKGROUND GRADIENTS */}
            <LinearGradient
                colors={['#1e1b4b', '#020617', '#020617']}
                className="absolute inset-0"
            />
            <View className="absolute -top-20 right-0 w-80 h-80 bg-soft-gold/5 rounded-full blur-[80px]" />
            <View className="absolute bottom-0 -left-20 w-80 h-80 bg-purple-600/10 rounded-full blur-[80px]" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pt-2 pb-6">
                    <Text className="text-white text-3xl font-bold mb-1 tracking-tight">İlanlar</Text>
                    <Text className="text-gray-400 text-sm mb-6 font-medium opacity-80">Açık iş birliklerini incele ve başvur.</Text>

                    {/* Tabs */}
                    <View className="flex-row bg-white/5 border border-white/10 rounded-2xl p-1 h-14 relative">
                        {/* Selected Tab Indicator - Animated would be better but static for now */}
                        <TouchableOpacity
                            onPress={() => setActiveTab('projects')}
                            className={`flex-1 items-center justify-center rounded-xl ${activeTab === 'projects' ? 'bg-soft-gold shadow-lg shadow-soft-gold/20' : ''}`}
                        >
                            <Text className={`text-xs font-bold tracking-wide ${activeTab === 'projects' ? 'text-black' : 'text-gray-400'}`}>MARKA PROJELERİ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('applications')}
                            className={`flex-1 items-center justify-center rounded-xl ${activeTab === 'applications' ? 'bg-soft-gold shadow-lg shadow-soft-gold/20' : ''}`}
                        >
                            <Text className={`text-xs font-bold tracking-wide ${activeTab === 'applications' ? 'text-black' : 'text-gray-400'}`}>BAŞVURULARIM</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                    {/* Marka Projeleri (Open Projects) */}
                    {activeTab === 'projects' && (
                        <View className="space-y-4">
                            {projects.map((item) => (
                                <GlassCard
                                    key={item.id}
                                    onPress={() => openProject(item)}
                                    className="p-5 mb-3 !rounded-[32px] !border-white/5 bg-white/[0.02]"
                                >
                                    <View className="flex-row justify-between items-start mb-4">
                                        <View className="flex-row items-center flex-1">
                                            <View className="w-12 h-12 bg-white rounded-2xl items-center justify-center mr-4 shadow-lg shadow-black/20">
                                                {item.brand_logo ? (
                                                    <Image source={{ uri: item.brand_logo }} className="w-8 h-8 resize-contain" />
                                                ) : (
                                                    <Text className="font-black text-black text-xl">{(item.brand_name || 'M').substring(0, 1)}</Text>
                                                )}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-white font-bold text-lg leading-6 mb-0.5">{item.title}</Text>
                                                <Text className="text-gray-400 text-xs font-medium uppercase tracking-wider">{item.brand_name}</Text>
                                            </View>
                                        </View>
                                        {item.is_new && (
                                            <View className="bg-soft-gold/20 px-2.5 py-1 rounded-full border border-soft-gold/30">
                                                <Text className="text-soft-gold text-[9px] font-black tracking-widest uppercase">YENİ</Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text className="text-gray-300 text-sm mb-5 leading-5 opacity-80" numberOfLines={2}>
                                        {item.summary || item.description}
                                    </Text>

                                    <View className="flex-row items-center justify-between mt-1">
                                        <View className="flex-row gap-2">
                                            <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
                                                <Text className="text-gray-200 text-[10px] font-bold">{item.platform || 'Instagram'}</Text>
                                            </View>
                                            <View className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/5">
                                                <Text className="text-soft-gold text-[10px] font-bold">₺{item.budget_min?.toLocaleString()}</Text>
                                            </View>
                                        </View>

                                        <View className="w-8 h-8 rounded-full bg-white/10 items-center justify-center border border-white/10">
                                            <ChevronRight color="#fff" size={14} />
                                        </View>
                                    </View>
                                </GlassCard>
                            ))}
                            {projects.length === 0 && !loading && (
                                <View className="items-center justify-center py-20 opacity-50">
                                    <Briefcase size={48} color="gray" className="mb-4 text-gray-600" />
                                    <Text className="text-gray-500 font-medium">Şu an açık proje bulunmamaktadır.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Başvurularım (My Applications) */}
                    {activeTab === 'applications' && (
                        <View className="space-y-4">
                            {applications.map((app) => {
                                const statusInfo = getStatusInfo(app.status);
                                return (
                                    <GlassCard
                                        key={app.id}
                                        onPress={() => openApplication(app)}
                                        className="p-5 mb-3 !rounded-[28px] !border-white/5 bg-white/[0.02]"
                                    >
                                        <View className="flex-row justify-between mb-3">
                                            <View className={`px-2.5 py-1 rounded-lg border ${statusInfo.border} ${statusInfo.bg}`}>
                                                <Text className={`${statusInfo.color} text-[10px] font-bold tracking-wider`}>{statusInfo.text}</Text>
                                            </View>
                                            <Text className="text-gray-500 text-[10px] font-medium">{new Date(app.created_at).toLocaleDateString('tr-TR')}</Text>
                                        </View>

                                        <Text className="text-white font-bold text-lg mb-1 leading-6">{app.advert_projects?.title || 'Proje Başlığı Yok'}</Text>
                                        <Text className="text-gray-400 text-xs mb-4">{app.advert_projects?.brand_name}</Text>

                                        <View className="flex-row justify-between items-center border-t border-white/5 pt-3">
                                            <View>
                                                <Text className="text-gray-500 text-[10px] uppercase font-bold mb-0.5">Teklifin</Text>
                                                <Text className="text-soft-gold font-bold text-sm">₺{app.budget_expectation?.toLocaleString()}</Text>
                                            </View>
                                            <View className="flex-row items-center opacity-60">
                                                <Text className="text-white text-xs mr-1">Detay</Text>
                                                <ChevronRight color="white" size={12} />
                                            </View>
                                        </View>
                                    </GlassCard>
                                );
                            })}

                            {applications.length === 0 && !loading && (
                                <View className="items-center justify-center py-20 opacity-50">
                                    <Text className="text-gray-500 font-medium">Henüz bir başvurunuz bulunmamaktadır.</Text>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>

            {/* --- PROJECT DETAIL MODAL --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={projectModalVisible}
                onRequestClose={closeProject}
            >
                {selectedProject && (
                    <View className="flex-1 bg-black/80 justify-end">
                        {/* Close Area */}
                        <TouchableOpacity className="flex-1" onPress={closeProject} />

                        <View className="h-[85%] bg-[#0B0F19] rounded-t-[40px] border-t border-white/10 overflow-hidden relative shadow-2xl shadow-black">
                            {/* Modal Glow */}
                            <View className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                            {/* Header */}
                            <View className="px-8 py-6 flex-row justify-between items-start pt-8">
                                <View className="flex-row items-center">
                                    <View className="w-16 h-16 bg-white rounded-2xl items-center justify-center mr-4 shadow-xl transform rotate-2">
                                        <Text className="font-black text-black text-2xl">{(selectedProject.brand_name || 'M').substring(0, 1)}</Text>
                                    </View>
                                    <View className="flex-1 pr-4">
                                        <Text className="text-white font-black text-2xl leading-7 mb-1">{selectedProject.title}</Text>
                                        <Text className="text-gray-400 text-sm font-medium uppercase tracking-widest">{selectedProject.brand_name}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={closeProject} className="bg-white/5 p-2 rounded-full border border-white/10">
                                    <X color="#9ca3af" size={20} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="flex-1 px-8">
                                {/* Tags */}
                                <View className="flex-row flex-wrap gap-2 mb-8">
                                    <View className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex-row items-center">
                                        <Building2 color="#9CA3AF" size={14} className="mr-2" />
                                        <Text className="text-gray-300 text-xs font-bold">{selectedProject.location || 'Online'}</Text>
                                    </View>
                                    <View className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex-row items-center">
                                        <Calendar color="#9CA3AF" size={14} className="mr-2" />
                                        <Text className="text-gray-300 text-xs font-bold">Son: {selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString('tr-TR') : 'Belirsiz'}</Text>
                                    </View>
                                </View>

                                {/* Description */}
                                <View className="mb-8">
                                    <Text className="text-white font-bold text-lg mb-3">Proje Detayları</Text>
                                    <Text className="text-gray-400 text-base leading-7 font-light">{selectedProject.summary || selectedProject.description}</Text>
                                </View>

                                {/* Budget Box */}
                                <GlassCard className="mb-8 p-0 overflow-hidden bg-soft-gold/10 !border-soft-gold/30">
                                    <View className="p-5 flex-row justify-between items-center">
                                        <View>
                                            <Text className="text-soft-gold/70 text-xs font-bold uppercase tracking-widest mb-1">TAHMİNİ BÜTÇE ARALIĞI</Text>
                                            <Text className="text-white font-black text-3xl">₺{selectedProject.budget_min / 1000}K - ₺{selectedProject.budget_max / 1000}K</Text>
                                        </View>
                                        <View className="w-12 h-12 bg-soft-gold rounded-full items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)]">
                                            <DollarSign color="#000" size={24} />
                                        </View>
                                    </View>
                                </GlassCard>

                                {/* Extra Info */}
                                <View className="mb-32 space-y-4">
                                    <View className="flex-row items-start">
                                        <View className="w-2 h-2 rounded-full bg-soft-gold mt-2 mr-3" />
                                        <View>
                                            <Text className="text-white font-bold text-sm">Platform</Text>
                                            <Text className="text-gray-500 text-xs">{selectedProject.platform || 'Instagram'}</Text>
                                        </View>
                                    </View>
                                    <View className="flex-row items-start">
                                        <View className="w-2 h-2 rounded-full bg-soft-gold mt-2 mr-3" />
                                        <View>
                                            <Text className="text-white font-bold text-sm">Beklenen Teslimatlar</Text>
                                            <Text className="text-gray-500 text-xs">{selectedProject.deliverables?.join(', ') || '1x Reels, 2x Story'}</Text>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>

                            {/* Floating Bottom Button */}
                            <View className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0B0F19] to-transparent pt-20">
                                <TouchableOpacity
                                    className="w-full bg-soft-gold h-16 rounded-[20px] items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)] active:scale-[0.98] transition"
                                    onPress={() => handleApply(selectedProject)}
                                >
                                    <Text className="text-black font-black text-lg tracking-wider">HEMEN BAŞVUR</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </Modal>

            {/* --- APPLICATION DETAIL MODAL --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={applicationModalVisible}
                onRequestClose={closeApplication}
            >
                {selectedApplication && (
                    <View className="flex-1 bg-black/80 justify-end">
                        <TouchableOpacity className="flex-1" onPress={closeApplication} />
                        <View className="h-[75%] bg-[#0B0F19] rounded-t-[40px] border-t border-white/10 p-8 shadow-2xl">
                            <View className="items-center mb-8">
                                <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${getStatusInfo(selectedApplication.status).bg} border ${getStatusInfo(selectedApplication.status).border}`}>
                                    <Clock color={getStatusInfo(selectedApplication.status).color.replace('text-', '').replace('-500', '') === 'yellow' ? '#EAB308' : '#fff'} size={40} />
                                </View>
                                <Text className={`font-black text-2xl mb-2 ${getStatusInfo(selectedApplication.status).color}`}>
                                    {getStatusInfo(selectedApplication.status).text}
                                </Text>
                                <Text className="text-gray-400 text-center text-sm px-8">
                                    Başvurunuz marka tarafından inceleniyor. Durum değiştiğinde bildirim alacaksınız.
                                </Text>
                            </View>

                            <View className="bg-white/[0.03] rounded-3xl p-6 border border-white/5 space-y-4">
                                <View className="flex-row justify-between border-b border-white/5 pb-3">
                                    <Text className="text-gray-500 text-sm">Marka</Text>
                                    <Text className="text-white font-bold">{selectedApplication.advert_projects?.brand_name}</Text>
                                </View>
                                <View className="flex-row justify-between border-b border-white/5 pb-3">
                                    <Text className="text-gray-500 text-sm">Tarih</Text>
                                    <Text className="text-white font-bold">{new Date(selectedApplication.created_at).toLocaleDateString('tr-TR')}</Text>
                                </View>
                                <View className="flex-row justify-between">
                                    <Text className="text-gray-500 text-sm">Teklifiniz</Text>
                                    <Text className="text-soft-gold font-bold text-lg">₺{selectedApplication.budget_expectation}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => alert('İptal işlemi henüz aktif değil.')}
                                className="mt-auto w-full h-14 rounded-xl border border-red-500/30 items-center justify-center bg-red-500/5"
                            >
                                <Text className="text-red-500 font-bold">Başvuruyu İptal Et</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </Modal>

            {/* --- CONFIRMATION MODAL --- */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={confirmModalVisible}
                onRequestClose={() => setConfirmModalVisible(false)}
            >
                <View className="flex-1 bg-black/90 items-center justify-center p-6">
                    <View className="w-full max-w-sm bg-[#0B0F19] rounded-[32px] border border-white/10 p-6 shadow-2xl relative">
                        {/* Header */}
                        <Text className="text-white font-bold text-xl mb-6">Başvuru Formu</Text>

                        {/* Form Fields */}
                        <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false}>

                            {/* Niyet Mesajı */}
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">NİYET MESAJI</Text>
                            <TextInput
                                className="bg-[#15171e] text-white p-4 rounded-xl border border-white/10 h-32 mb-4"
                                placeholder="Kısa olarak neden uygun olduğundan bahset."
                                placeholderTextColor="#4B5563"
                                multiline
                                textAlignVertical="top"
                                value={coverLetter}
                                onChangeText={setCoverLetter}
                            />

                            {/* Önerdiğin Teslim */}
                            <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">ÖNERDİĞİN TESLİM</Text>
                            <TextInput
                                className="bg-[#15171e] text-white p-4 rounded-xl border border-white/10 mb-4"
                                placeholder="Örn: 1 Reels + 3 Story"
                                placeholderTextColor="#4B5563"
                                value={deliveryItem}
                                onChangeText={setDeliveryItem}
                            />

                            {/* Ödeme Tercihi & Bütçe Row */}
                            <View className="flex-row gap-4 mb-2">
                                {/* Ödeme Tercihi */}
                                <View className="flex-1">
                                    <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">ÖDEME TERCİHİ</Text>
                                    <View className="flex-row gap-2">
                                        <TouchableOpacity
                                            onPress={() => setPaymentType('cash')}
                                            className={`flex-1 flex-row items-center justify-center p-3 rounded-xl border ${paymentType === 'cash' ? 'bg-white/10 border-white' : 'bg-[#15171e] border-white/10'}`}
                                        >
                                            <View className={`w-3 h-3 rounded-full border mr-2 items-center justify-center ${paymentType === 'cash' ? 'border-white' : 'border-gray-500'}`}>
                                                {paymentType === 'cash' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </View>
                                            <Text className={paymentType === 'cash' ? 'text-white font-bold' : 'text-gray-500'}>Nakit</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            onPress={() => {
                                                setPaymentType('barter');
                                                setBudgetExpectation('');
                                            }}
                                            className={`flex-1 flex-row items-center justify-center p-3 rounded-xl border ${paymentType === 'barter' ? 'bg-white/10 border-white' : 'bg-[#15171e] border-white/10'}`}
                                        >
                                            <View className={`w-3 h-3 rounded-full border mr-2 items-center justify-center ${paymentType === 'barter' ? 'border-white' : 'border-gray-500'}`}>
                                                {paymentType === 'barter' && <View className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </View>
                                            <Text className={paymentType === 'barter' ? 'text-white font-bold' : 'text-gray-500'}>Barter</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Bütçe Beklentisi */}
                            <View className={`mb-8 ${paymentType === 'barter' ? 'opacity-50' : ''}`}>
                                <Text className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">BÜTÇE BEKLENTİN</Text>
                                <TextInput
                                    className="bg-[#15171e] text-white p-4 rounded-xl border border-white/10"
                                    placeholder={paymentType === 'barter' ? "Barter anlaşmalarında bütçe girilmez" : "Örn: 25.000"}
                                    placeholderTextColor="#4B5563"
                                    keyboardType="numeric"
                                    value={budgetExpectation}
                                    onChangeText={setBudgetExpectation}
                                    editable={paymentType === 'cash'}
                                />
                            </View>

                            {/* Action Button */}
                            <TouchableOpacity
                                onPress={executeApply}
                                disabled={isApplying}
                                className="w-full bg-soft-gold h-14 rounded-xl items-center justify-center flex-row shadow-lg shadow-soft-gold/20"
                            >
                                {isApplying ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <>
                                        <Text className="text-black font-bold text-base mr-2">Başvuruyu Gönder</Text>
                                        <ChevronRight color="black" size={18} />
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setConfirmModalVisible(false)}
                                className="w-full items-center py-4"
                            >
                                <Text className="text-gray-500 font-medium">Vazgeç</Text>
                            </TouchableOpacity>

                        </ScrollView>
                    </View>
                </View>
            </Modal>

        </View>
    );
}
