import { View, Text, ScrollView, TouchableOpacity, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Clock, CheckCircle2, XCircle, ChevronRight, FileText, Briefcase, Building2, Calendar, DollarSign, X, CheckCircle, BarChart3, AlertCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProposalsScreen() {
    const [activeTab, setActiveTab] = useState('projects'); // projects (Marka Projeleri), applications (Başvurularım)
    const [selectedProject, setSelectedProject] = useState(null);
    const [selectedApplication, setSelectedApplication] = useState(null);
    const [projectModalVisible, setProjectModalVisible] = useState(false);
    const [applicationModalVisible, setApplicationModalVisible] = useState(false);

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

    // Dummy Data for demo
    const projects = [
        { id: 1, brand: 'LC Waikiki', title: 'Kış Koleksiyonu Reels', category: 'Moda', budget: '₺5.000 - ₺10.000', deadline: '20 Ocak 2026', location: 'İstanbul', type: 'Reels', desc: 'Yeni sezon kış ürünlerimizi tanıtacak, enerjik ve stil sahibi Reels içerikleri arıyoruz. İçerikler en az 30 saniye olmalı ve markamızın belirlediği müzik kullanılmalıdır.' },
        { id: 2, brand: 'Getir', title: 'Hızlı Teslimat Deneyimi', category: 'Teknoloji', budget: '₺3.000 - ₺7.000', deadline: '25 Ocak 2026', location: 'Online', type: 'Story', desc: 'Getir uygulamasının yeni özelliklerini anlatan eğlenceli story serisi hazırlanacak.' },
        { id: 3, brand: 'Starbucks', title: 'Yeni Kahve Tadımı', category: 'Yeme & İçme', budget: '₺8.000 - ₺12.000', deadline: '15 Şubat 2026', location: 'Mağaza Ziyareti', type: 'Post', desc: 'Yeni çıkan kahve çeşitlerimizi deneyimleyip takipçilerinizle paylaşmanızı istiyoruz.' },
    ];

    const applications = [
        { id: 101, title: 'Trendyol Yaz Kampanyası', status: 'pending', date: '08 Ocak 2026', offer: '₺12.500', brand: 'Trendyol' }
    ];

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
                                                <Text className="font-bold text-black">{item.brand.substring(0, 2).toUpperCase()}</Text>
                                            </View>
                                            <View>
                                                <Text className="text-white font-bold text-base">{item.brand}</Text>
                                                <Text className="text-gray-500 text-xs">{item.category} • {item.location}</Text>
                                            </View>
                                        </View>
                                        <View className="bg-soft-gold/10 px-2 py-1 rounded border border-soft-gold/30">
                                            <Text className="text-soft-gold text-[10px] font-bold">YENİ</Text>
                                        </View>
                                    </View>

                                    <Text className="text-white font-bold text-lg mb-1">{item.title}</Text>
                                    <Text className="text-gray-400 text-sm mb-4 leading-5" numberOfLines={2}>
                                        {item.desc}
                                    </Text>

                                    <View className="flex-row justify-between items-center pt-3 border-t border-white/5">
                                        <Text className="text-soft-gold font-bold text-lg">{item.budget}</Text>
                                        <View className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                                            <Text className="text-white text-xs font-bold">Detaylar</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}
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
                                        <Text className="text-white font-bold text-lg">{app.title}</Text>
                                        <View className="bg-yellow-500/20 px-2 py-1 rounded text-yellow-500 text-[10px] font-bold border border-yellow-500/20">
                                            <Text className="text-yellow-500 text-[10px] font-bold">BEKLİYOR</Text>
                                        </View>
                                    </View>
                                    <Text className="text-gray-400 text-xs mb-3">Başvuru Tarihi: {app.date}</Text>
                                    <View className="flex-row justify-between items-center border-t border-white/5 pt-3">
                                        <Text className="text-soft-gold font-bold">{app.offer}</Text>
                                        <View className="flex-row items-center space-x-1">
                                            <Text className="text-gray-500 text-xs text-right">Teklifiniz</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))}

                            <View className="items-center justify-center py-10 opacity-50">
                                <Text className="text-gray-600 text-center text-xs">Daha fazla başvuru bulunamadı.</Text>
                            </View>
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
                                        <Text className="font-bold text-black text-xl">{selectedProject.brand.substring(0, 2).toUpperCase()}</Text>
                                    </View>
                                    <View>
                                        <Text className="text-white font-bold text-2xl">{selectedProject.brand}</Text>
                                        <Text className="text-gray-400 text-sm">{selectedProject.category}</Text>
                                    </View>
                                </View>

                                <Text className="text-white font-bold text-xl mb-2">{selectedProject.title}</Text>
                                <View className="flex-row flex-wrap gap-2 mb-6">
                                    <View className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex-row items-center">
                                        <Building2 color="#9CA3AF" size={12} className="mr-1.5" />
                                        <Text className="text-gray-300 text-xs">{selectedProject.location}</Text>
                                    </View>
                                    <View className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 flex-row items-center">
                                        <Calendar color="#9CA3AF" size={12} className="mr-1.5" />
                                        <Text className="text-gray-300 text-xs">Son: {selectedProject.deadline}</Text>
                                    </View>
                                </View>

                                <View className="bg-surface p-5 rounded-2xl border border-white/5 mb-6">
                                    <Text className="text-white font-bold text-lg mb-3">Proje Tanımı</Text>
                                    <Text className="text-gray-400 text-sm leading-6 mb-4">{selectedProject.desc}</Text>

                                    <Text className="text-white font-bold text-base mb-2">Gereksinimler</Text>
                                    <View className="space-y-2">
                                        <View className="flex-row items-center">
                                            <View className="w-1.5 h-1.5 rounded-full bg-soft-gold mr-2" />
                                            <Text className="text-gray-400 text-sm">En az 10K Takipçi</Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <View className="w-1.5 h-1.5 rounded-full bg-soft-gold mr-2" />
                                            <Text className="text-gray-400 text-sm">İçerik Türü: {selectedProject.type}</Text>
                                        </View>
                                        <View className="flex-row items-center">
                                            <View className="w-1.5 h-1.5 rounded-full bg-soft-gold mr-2" />
                                            <Text className="text-gray-400 text-sm">Yüksek etkileşim oranı</Text>
                                        </View>
                                    </View>
                                </View>

                                <View className="bg-soft-gold/5 p-5 rounded-2xl border border-soft-gold/20 mb-8 items-center flex-row justify-between">
                                    <View>
                                        <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Tahmini Bütçe</Text>
                                        <Text className="text-soft-gold font-bold text-xl">{selectedProject.budget}</Text>
                                    </View>
                                    <DollarSign color="#D4AF37" size={24} />
                                </View>

                                <TouchableOpacity
                                    className="w-full bg-soft-gold h-14 rounded-xl items-center justify-center mb-6 shadow-lg shadow-soft-gold/20"
                                    onPress={() => alert('Başvuru formuna yönlendiriliyor...')}
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
                                    <Text className="text-white font-bold text-xl mb-1">Değerlendiriliyor</Text>
                                    <Text className="text-gray-400 text-sm text-center px-4">Başvurunuz marka tarafından inceleniyor. Yakında dönüş sağlanacak.</Text>
                                </View>

                                <View className="bg-surface p-5 rounded-2xl border border-white/5 mb-6">
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-white/5">
                                        <Text className="text-gray-400 text-sm">Marka</Text>
                                        <Text className="text-white font-bold">{selectedApplication.brand}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-white/5">
                                        <Text className="text-gray-400 text-sm">İlan Başlığı</Text>
                                        <Text className="text-white font-bold">{selectedApplication.title}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-white/5">
                                        <Text className="text-gray-400 text-sm">Başvuru Tarihi</Text>
                                        <Text className="text-white font-bold">{selectedApplication.date}</Text>
                                    </View>
                                    <View className="flex-row justify-between items-center">
                                        <Text className="text-gray-400 text-sm">Teklif Ettiğiniz Tutar</Text>
                                        <Text className="text-soft-gold font-bold text-lg">{selectedApplication.offer}</Text>
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
