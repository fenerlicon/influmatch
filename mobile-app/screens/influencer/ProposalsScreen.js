import { View, Text, ScrollView, TouchableOpacity, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Clock, CheckCircle2, XCircle, ChevronRight, FileText, Briefcase, Building2, Calendar, DollarSign, X, CheckCircle, BarChart3, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProposalsScreen() {
    const [activeTab, setActiveTab] = useState('projects'); // projects (Marka Projeleri), applications (Başvurularım)
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [applicationModalVisible, setApplicationModalVisible] = useState(false);

    // Real Data States
    const [projects, setProjects] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Active Projects (Marka Projeleri)
            const { data: projectsData, error: projectsError } = await supabase
                .from('advert_projects')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            if (projectsError) throw projectsError;
            setProjects(projectsData || []);

            // 2. Fetch My Applications (Başvurularım)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: appsData, error: appsError } = await supabase
                    .from('advert_applications')
                    .select('*, advert_project:advert_projects(*)')
                    .eq('influencer_user_id', user.id)
                    .order('created_at', { ascending: false });

                if (appsError) throw appsError;
                setApplications(appsData || []);
            }
        } catch (error) {
            console.error('Error fetching proposals data:', error);
            Alert.alert('Hata', 'Veriler yüklenirken bir sorun oluştu.');
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

    const handleApply = async (project) => {
        Alert.alert('Başvuru', 'Bu projeye başvurmak istediğinize emin misiniz?', [
            { text: 'İptal', style: 'cancel' },
            {
                text: 'Evet, Başvur', onPress: async () => {
                    try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (!user) return;

                        const { error } = await supabase
                            .from('advert_applications')
                            .insert({
                                advert_id: project.id,
                                influencer_user_id: user.id,
                                status: 'pending',
                                cover_letter: 'Mobil uygulamadan hızlı başvuru.',
                                budget_expectation: project.budget_min
                            });

                        if (error) throw error;
                        Alert.alert('Başarılı', 'Başvurunuz alındı!');
                        setProjectModalVisible(false);
                        fetchData(); // Refresh data
                    } catch (error) {
                        Alert.alert('Hata', 'Başvuru yapılırken hata: ' + error.message);
                    }
                }
            }
        ]);
    };

    const getStatusText = (status) => {
        switch (status) {
            case 'pending': return 'BEKLİYOR';
            case 'shortlisted': return 'DEĞERLENDİRİLİYOR';
            case 'accepted': return 'KABUL EDİLDİ';
            case 'rejected': return 'REDDEDİLDİ';
            default: return status?.toUpperCase() || '';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/20';
            case 'shortlisted': return 'text-blue-500 bg-blue-500/20 border-blue-500/20';
            case 'accepted': return 'text-green-500 bg-green-500/20 border-green-500/20';
            case 'rejected': return 'text-red-500 bg-red-500/20 border-red-500/20';
            default: return 'text-gray-500 bg-gray-500/20 border-gray-500/20';
        }
    };

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 border-b border-white/5 bg-midnight">
                    <Text className="text-white text-3xl font-bold mb-2">İlanlar</Text>
                    <Text className="text-gray-400 text-xs mb-6">Açık iş birliklerini incele ve başvur.</Text>

                    {/* Tabs */}
                    <View className="flex-row bg-surface border border-white/10 rounded-xl p-1">
                        <TouchableOpacity
                            onPress={() => setActiveTab('projects')}
                            className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'projects' ? 'bg-soft-gold' : 'transparent'}`}
                        >
                            <Text className={`text-xs font-bold ${activeTab === 'projects' ? 'text-midnight' : 'text-gray-400'}`}>Marka Projeleri</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setActiveTab('applications')}
                            className={`flex-1 py-2 items-center rounded-lg ${activeTab === 'applications' ? 'bg-soft-gold' : 'transparent'}`}
                        >
                            <Text className={`text-xs font-bold ${activeTab === 'applications' ? 'text-midnight' : 'text-gray-400'}`}>Başvurularım</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

                    {/* Marka Projeleri (Open Projects) */}
                    {activeTab === 'projects' && (
                        <View className="space-y-4">
                            {projects.map((item) => (
                                <TouchableOpacity
                                    key={item.id}
                                    className="bg-surface p-4 rounded-3xl border border-white/10 mb-4 shadow-lg shadow-black/30"
                                    onPress={() => openProject(item)}
                                >
                                    <View className="flex-row justify-between items-start mb-3">
                                        <View className="flex-row items-center">
                                            <View className="w-10 h-10 bg-white rounded-full items-center justify-center mr-3">
                                                <Text className="font-bold text-black">{(item.brand_name || 'M').substring(0, 2).toUpperCase()}</Text>
                                            </View>
                                            <View>
                                                <Text className="text-white font-bold text-base">{item.brand_name || 'Gizli Marka'}</Text>
                                                <Text className="text-gray-500 text-xs">{item.category || 'Genel'} • {item.location || 'Online'}</Text>
                                            </View>
                                        </View>
                                        <View className="bg-soft-gold/10 px-2 py-1 rounded border border-soft-gold/30">
                                            <Text className="text-soft-gold text-[10px] font-bold">YENİ</Text>
                                        </View>
                                    </View>

                                    <Text className="text-white font-bold text-lg mb-1">{item.title}</Text>
                                    <Text className="text-gray-400 text-sm mb-4 leading-5" numberOfLines={2}>
                                        {item.summary || item.description}
                                    </Text>

                                    <View className="flex-row justify-between items-center pt-3 border-t border-white/5">
                                        <Text className="text-soft-gold font-bold text-lg">₺{item.budget_min} - ₺{item.budget_max}</Text>
                                        <View className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                                            <Text className="text-white text-xs font-bold">Detaylar</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
                            {projects.length === 0 && !loading && (
                                <Text className="text-gray-500 text-center mt-10">Şu an açık proje bulunmamaktadır.</Text>
                            )}
                        </View>
                    )}

                    {/* Başvurularım (My Applications) */}
                    {activeTab === 'applications' && (
                        <View className="space-y-4">
                            {applications.map((app) => (
                                <TouchableOpacity
                                    key={app.id}
                                    className="bg-surface p-4 rounded-2xl border border-white/10"
                                    onPress={() => openApplication(app)}
                                >
                                    <View className="flex-row justify-between mb-2">
                                        <Text className="text-white font-bold text-lg">{app.advert_project?.title || 'Proje Başlığı Yok'}</Text>
                                        <View className={`px-2 py-1 rounded border ${getStatusColor(app.status)}`}>
                                            <Text className={getStatusColor(app.status).split(' ')[0] + " text-[10px] font-bold"}>{getStatusText(app.status)}</Text>
                                        </View>
                                    </View>
                                    <Text className="text-gray-400 text-xs mb-3">Başvuru Tarihi: {new Date(app.created_at).toLocaleDateString('tr-TR')}</Text>
                                    <View className="flex-row justify-between items-center border-t border-white/5 pt-3">
                                        <Text className="text-soft-gold font-bold">Teklif: ₺{app.budget_expectation}</Text>
                                        <View className="flex-row items-center space-x-1">
                                            <Text className="text-gray-500 text-xs text-right">Detaylar</Text>
                                            <ChevronRight color="gray" size={14} />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            {applications.length === 0 && !loading && (
                                <View className="items-center justify-center py-10 opacity-50">
                                    <Text className="text-gray-600 text-center text-xs">Henüz bir başvurunuz bulunmamaktadır.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View className="h-24" />
                </ScrollView>
            </SafeAreaView>

            {/* Project Details Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={projectModalVisible}
                onRequestClose={closeProject}
            >
                {selectedProject && (
                    <View className="flex-1 bg-black/90 justify-end">
                        <View className="h-[90%] bg-midnight rounded-t-[32px] border-t border-white/10 overflow-hidden">
                            {/* Modal Header */}
                            <View className="px-6 py-5 border-b border-white/5 flex-row justify-between items-center bg-surface">
                                <View>
                                    <Text className="text-gray-400 text-xs uppercase tracking-widest font-bold">PROJE DETAYI</Text>
                                </View>
                                <TouchableOpacity onPress={closeProject} className="bg-white/10 p-2 rounded-full">
                                    <X color="white" size={20} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="flex-1 p-6">
                                <View className="flex-row items-center mb-6">
                                    <View className="w-16 h-16 bg-white rounded-full items-center justify-center mr-4">
                                        <Text className="font-bold text-black text-xl">{(selectedProject.brand_name || 'M').substring(0, 2).toUpperCase()}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-white font-bold text-2xl">{selectedProject.brand_name || 'Gizli Marka'}</Text>
                                        <Text className="text-gray-400 text-sm">{selectedProject.category || 'Genel'}</Text>
                                    </View>
                                </View>

                                <Text className="text-white font-bold text-xl mb-2">{selectedProject.title}</Text>
                                <View className="flex-row flex-wrap gap-2 mb-6">
                                    <View className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex-row items-center">
                                        <Building2 color="#9CA3AF" size={12} className="mr-1.5" />
                                        <Text className="text-gray-300 text-xs">{selectedProject.location || 'Online'}</Text>
                                    </View>
                                    <View className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex-row items-center">
                                        <Calendar color="#9CA3AF" size={12} className="mr-1.5" />
                                        <Text className="text-gray-300 text-xs">Son: {selectedProject.deadline ? new Date(selectedProject.deadline).toLocaleDateString('tr-TR') : 'Belirsiz'}</Text>
                                    </View>
                                </View>

                                <View className="bg-surface p-5 rounded-2xl border border-white/5 mb-6">
                                    <Text className="text-white font-bold text-lg mb-3">Proje Tanımı</Text>
                                    <Text className="text-gray-400 text-sm leading-6 mb-4">{selectedProject.summary || selectedProject.description}</Text>

                                    <Text className="text-white font-bold text-base mb-2">Gereksinimler</Text>
                                    <View className="space-y-2">
                                        <View className="flex-row items-center">
                                            <View className="w-1.5 h-1.5 rounded-full bg-soft-gold mr-2" />
                                            <Text className="text-gray-400 text-sm">Platform: {selectedProject.platforms ? selectedProject.platforms.join(', ') : 'Instagram'}</Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <View className="w-1.5 h-1.5 rounded-full bg-soft-gold mr-2" />
                                            <Text className="text-gray-400 text-sm">Teslimatlar: {selectedProject.deliverables ? selectedProject.deliverables.join(', ') : 'Belirtilmedi'}</Text>
                                        </View>
                                    </View>
                                </View>

                                <View className="bg-soft-gold/5 p-5 rounded-2xl border border-soft-gold/20 mb-8 items-center flex-row justify-between">
                                    <View>
                                        <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Tahmini Bütçe</Text>
                                        <Text className="text-soft-gold font-bold text-xl">₺{selectedProject.budget_min} - ₺{selectedProject.budget_max}</Text>
                                    </View>
                                    <DollarSign color="#D4AF37" size={24} />
                                </View>

                                <TouchableOpacity
                                    className="w-full bg-soft-gold h-14 rounded-xl items-center justify-center mb-6 shadow-lg shadow-soft-gold/20"
                                    onPress={() => handleApply(selectedProject)}
                                >
                                    <Text className="text-midnight font-bold text-base uppercase tracking-wider">Hemen Başvur</Text>
                                </TouchableOpacity>

                            </ScrollView>
                        </View>
                    </View>
                )}
            </Modal>

            {/* Application Details Modal */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={applicationModalVisible}
                onRequestClose={closeApplication}
            >
                {selectedApplication && (
                    <View className="flex-1 bg-black/90 justify-end">
                        <View className="h-[80%] bg-midnight rounded-t-[32px] border-t border-white/10 overflow-hidden">
                            {/* Modal Header */}
                            <View className="px-6 py-5 border-b border-white/5 flex-row justify-between items-center bg-surface">
                                <View>
                                    <Text className="text-gray-400 text-xs uppercase tracking-widest font-bold">BAŞVURU DURUMU</Text>
                                </View>
                                <TouchableOpacity onPress={closeApplication} className="bg-white/10 p-2 rounded-full">
                                    <X color="white" size={20} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="flex-1 p-6">
                                <View className="bg-surface p-6 rounded-3xl border border-white/5 mb-6 items-center">
                                    <View className="w-16 h-16 bg-yellow-500/10 rounded-full items-center justify-center mb-4 border border-yellow-500/20">
                                        <Clock color="#EAB308" size={32} />
                                    </View>
                                    <Text className="text-white font-bold text-xl mb-1">{getStatusText(selectedApplication.status)}</Text>
                                    <Text className="text-gray-400 text-sm text-center px-4">Başvurunuz marka tarafından inceleniyor. Yakında dönüş sağlanacak.</Text>
                                </View>

                                <View className="bg-surface p-5 rounded-2xl border border-white/5 mb-6">
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-white/5">
                                        <Text className="text-gray-400 text-sm">Marka</Text>
                                        <Text className="text-white font-bold">{selectedApplication.advert_project?.brand_name || 'Bilinmiyor'}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-white/5">
                                        <Text className="text-gray-400 text-sm">İlan Başlığı</Text>
                                        <Text className="text-white font-bold">{selectedApplication.advert_project?.title || ''}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-white/5">
                                        <Text className="text-gray-400 text-sm">Başvuru Tarihi</Text>
                                        <Text className="text-white font-bold">{new Date(selectedApplication.created_at).toLocaleDateString('tr-TR')}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-gray-400 text-sm">Teklif Ettiğiniz Tutar</Text>
                                        <Text className="text-soft-gold font-bold text-lg">₺{selectedApplication.budget_expectation}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    className="w-full bg-red-500/10 h-14 rounded-xl items-center justify-center mb-6 border border-red-500/20"
                                    onPress={() => alert('Başvuru iptal ediliyor...')}
                                >
                                    <Text className="text-red-500 font-bold text-base">Başvuruyu İptal Et</Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </View>
                )}
            </Modal>
        </View>
    );
}
