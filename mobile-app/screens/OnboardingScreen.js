import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform, Modal, FlatList, Image } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { resolveHomeRoute } from '../lib/routing';
import { LinearGradient } from 'expo-linear-gradient';
import { User, MapPin, AlignLeft, Globe, Instagram, Youtube, Music2, ChevronRight, ChevronLeft, Hash, Building, AtSign, AlertCircle, X, Search, CheckCircle, XCircle, Camera, Check } from 'lucide-react-native';
import { CustomToast } from '../components/CustomToast';
import { getTurkishErrorMessage } from '../lib/errorUtils';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
// Web ile aynı kategori anahtarları (utils/categories.ts); tek kategori seçilir.
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '../constants/categories';

// Web'deki seçeneklerle aynı (components/onboarding/InfluencerForm.tsx).
const CREATOR_TYPES = [
    { value: 'influencer', label: 'Influencer', desc: 'Kendi kitlem var' },
    { value: 'ugc', label: 'UGC Kreatörü', desc: 'Markalara özel' },
    { value: 'both', label: 'Her İkisi De', desc: 'Kitle + üretim' },
];

const TURKEY_CITIES = [
    "İstanbul", "Ankara", "İzmir", "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop", "Sivas", "Şanlıurfa", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
].sort();

export default function OnboardingScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [role, setRole] = useState(null);
    const [user, setUser] = useState(null);
    const [showCityModal, setShowCityModal] = useState(false);
    const [citySearch, setCitySearch] = useState('');
    // Şehir seçici iki alan için kullanılır: profil şehri ve vergi dairesinin ili.
    const [cityField, setCityField] = useState('city');

    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        corporateEmail: '',
        bio: '',
        city: '',
        website: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        taxId: '',
        taxOffice: '',
        taxOfficeCity: '',
        category: '',
        creatorType: '',
        avatar_url: '',
    });

    // Username Status: 'idle', 'checking', 'valid', 'taken', 'short'
    const [usernameStatus, setUsernameStatus] = useState('idle');

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    useEffect(() => {
        getCurrentUser();
    }, []);

    // Real-time Username Check
    useEffect(() => {
        if (!user) return;

        const username = formData.username;
        if (!username) {
            setUsernameStatus('idle');
            return;
        }

        if (username.length < 3) {
            setUsernameStatus('short');
            return;
        }

        setUsernameStatus('checking');

        const timeoutId = setTimeout(async () => {
            // Başka hesapların satırları istemciden okunamaz; kontrol web sunucusunda (/api/check-username ile aynı kod).
            const result = await apiRequest(`check-username?username=${encodeURIComponent(username)}`);
            if (result.error || typeof result.available !== 'boolean') {
                setUsernameStatus('idle');
            } else {
                setUsernameStatus(result.available ? 'valid' : 'taken');
            }
        }, 500);

        return () => clearTimeout(timeoutId);

    }, [formData.username, user]);


    async function getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            setRole(user.user_metadata?.role || 'influencer');
        } else {
            navigation.replace('Login');
        }
    }

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const selectCategory = (key) => updateField('category', key);

    const filteredCities = TURKEY_CITIES.filter(city =>
        city.toLowerCase().includes(citySearch.toLowerCase())
    );

    // Image Picker & Upload
    async function pickImage() {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled) {
                uploadAvatar(result.assets[0].base64);
            }
        } catch (error) {
            showToast('Resim seçilemedi.', 'error');
        }
    }

    async function uploadAvatar(base64Image) {
        try {
            setUploading(true);
            const filePath = `${user.id}/${Date.now()}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(base64Image), {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            updateField('avatar_url', data.publicUrl);
            showToast('Fotoğraf başarıyla yüklendi!', 'success');

        } catch (error) {
            showToast('Fotoğraf yüklenirken hata oluştu.', 'error');
            console.log(error);
        } finally {
            setUploading(false);
        }
    }

    // Submit: kayıt web ile aynı sunucu kodundan geçer (/api/mobile/onboarding → lib/onboarding.ts).
    async function handleSubmit() {
        if (!formData.fullName.trim()) {
            showToast(role === 'brand' ? 'Lütfen marka adını girin.' : 'Lütfen adınızı ve soyadınızı girin.', 'info');
            return;
        }

        if (!formData.username || !formData.city) {
            showToast('Lütfen Kullanıcı Adı ve Şehir alanlarını doldurun.', 'info');
            return;
        }

        if (usernameStatus === 'taken') {
            showToast('Lütfen farklı bir kullanıcı adı seçin.', 'error');
            return;
        }

        if (!formData.avatar_url) {
            showToast(role === 'brand' ? 'Lütfen marka logosu yükleyin.' : 'Lütfen profil fotoğrafı yükleyin.', 'info');
            return;
        }

        if (role === 'influencer' && !formData.creatorType) {
            showToast('Lütfen içerik üretici türünüzü seçin.', 'info');
            return;
        }

        if (role === 'influencer' && !formData.category) {
            showToast('Lütfen bir kategori seçin.', 'info');
            return;
        }

        // Zorunlu alan kontrolü - Sosyal Medya (sadece influencer için)
        if (role === 'influencer') {
            const hasSocial = (formData.instagram?.trim()) || (formData.tiktok?.trim()) || (formData.youtube?.trim());
            if (!hasSocial) {
                showToast('Hesabınızın doğrulanması için en az 1 sosyal medya hesabı eklemeniz şarttır.', 'error');
                return;
            }
        }

        if (role === 'brand' && (!formData.website.trim() || !formData.corporateEmail.trim())) {
            showToast('Lütfen web sitesi ve kurumsal e-posta alanlarını doldurun.', 'info');
            return;
        }

        setLoading(true);

        try {
            const hasTaxId = role === 'brand' && formData.taxId.trim();
            const result = await apiRequest('onboarding', {
                method: 'POST',
                body: {
                    role,
                    fullName: formData.fullName,
                    username: formData.username,
                    city: formData.city,
                    bio: formData.bio,
                    avatarUrl: formData.avatar_url || null,
                    // Kullanıcı adı veya link; sunucu web kurallarıyla doğrulayıp normalize eder.
                    socialLinks: {
                        instagram: formData.instagram.trim() || null,
                        tiktok: formData.tiktok.trim() || null,
                        youtube: formData.youtube.trim() || null,
                        website: role === 'brand' ? formData.website.trim() || null : null,
                    },
                    ...(role === 'influencer'
                        ? { category: formData.category, creatorType: formData.creatorType }
                        : {
                            corporateEmail: formData.corporateEmail.trim(),
                            taxId: hasTaxId ? formData.taxId.trim() : null,
                            taxOffice: hasTaxId ? formData.taxOffice.trim() : null,
                            taxOfficeCity: hasTaxId ? formData.taxOfficeCity : null,
                        }
                    ),
                },
            });

            if (result.error || !result.success) {
                showToast(result.error || 'Profil kaydedilemedi. Lütfen tekrar deneyin.', 'error');
                return;
            }

            showToast('Profiliniz oluşturuldu!', 'success');
            // Influencer doğrulanmış sosyal hesabı yoksa zorunlu doğrulama ekranına gider (lib/routing.js).
            const dest = await resolveHomeRoute(user.id).catch(() => (role === 'brand' ? 'BrandDashboard' : 'Dashboard'));
            setTimeout(() => {
                navigation.replace(dest === 'Rejected' ? 'Login' : dest === 'Onboarding' ? (role === 'brand' ? 'BrandDashboard' : 'Dashboard') : dest);
            }, 1000);

        } catch (error) {
            console.log('Onboarding Error:', error);
            showToast('Profil kaydedilemedi. Lütfen tekrar deneyin.', 'error');
        } finally {
            setLoading(false);
        }
    }

    if (!user) {
        return <View className="flex-1 bg-midnight items-center justify-center"><ActivityIndicator color="#D4AF37" /></View>;
    }

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <CustomToast
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onHide={hideToast}
            />
            {/* KeyboardAvoidingView moved to wrap content properly */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <SafeAreaView className="flex-1">
                    <ScrollView
                        className="flex-1 px-6 pt-4"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        keyboardShouldPersistTaps="handled"
                    >

                        {/* Geri Butonu */}
                        <TouchableOpacity
                            onPress={() => navigation.navigate('RegisterRole')}
                            className="flex-row items-center mb-6"
                            activeOpacity={0.7}
                        >
                            <View className="w-9 h-9 bg-white/5 border border-white/10 rounded-2xl items-center justify-center mr-3">
                                <ChevronLeft color="white" size={18} />
                            </View>
                            <Text className="text-gray-400 text-sm">Rol seçimine dön</Text>
                        </TouchableOpacity>

                        <Text className="text-soft-gold text-sm font-bold uppercase tracking-widest mb-2">Profilini Tamamla</Text>
                        <Text className="text-white text-3xl font-bold mb-6">
                            {role === 'brand' ? 'Marka Detayları' : 'Influencer Profili'}
                        </Text>

                        {/* Avatar Upload */}
                        <View className="items-center mb-6">
                            <TouchableOpacity onPress={pickImage} className="relative" activeOpacity={0.8}>
                                <View className={`w-28 h-28 rounded-full bg-surface border-2 border-dashed ${formData.avatar_url ? 'border-soft-gold' : 'border-white/20'} items-center justify-center overflow-hidden`}>
                                    {formData.avatar_url ? (
                                        <Image source={{ uri: formData.avatar_url }} className="w-full h-full" resizeMode="cover" />
                                    ) : (
                                        <View className="items-center">
                                            <Camera color="#6B7280" size={28} />
                                            <Text className="text-gray-500 text-xs mt-2 font-medium">
                                                {role === 'brand' ? 'Logo Yükle' : 'Fotoğraf Yükle'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View className="absolute bottom-1 right-1 bg-soft-gold p-2 rounded-full border border-midnight shadow-lg">
                                    {uploading ? (
                                        <ActivityIndicator size="small" color="#0B0F19" />
                                    ) : formData.avatar_url ? (
                                        <Check color="#0B0F19" size={16} strokeWidth={3} />
                                    ) : (
                                        <Camera color="#0B0F19" size={16} strokeWidth={2.5} />
                                    )}
                                </View>
                            </TouchableOpacity>
                        </View>


                        <View className="space-y-6">

                            {/* Ad Soyad / Marka Adı */}
                            <View className="space-y-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">{role === 'brand' ? 'Marka Adı' : 'Ad Soyad'}</Text>
                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                    {role === 'brand' ? <Building color="#6B7280" size={18} /> : <User color="#6B7280" size={18} />}
                                    <TextInput
                                        className="flex-1 text-white font-medium"
                                        placeholder={role === 'brand' ? 'Markanızın Adı' : 'Adınız Soyadınız'}
                                        placeholderTextColor="#4B5563"
                                        value={formData.fullName}
                                        onChangeText={(t) => updateField('fullName', t)}
                                    />
                                </View>
                            </View>

                            {/* Kullanıcı Adı */}
                            <View className="space-y-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Kullanıcı Adı</Text>
                                <View className={`flex-row items-center bg-surface border rounded-2xl h-14 px-4 space-x-3 
                                    ${usernameStatus === 'valid' ? 'border-green-500/50' :
                                        usernameStatus === 'taken' ? 'border-red-500/50' :
                                            'border-white/10'}`}>
                                    <AtSign color={usernameStatus === 'valid' ? '#22c55e' : usernameStatus === 'taken' ? '#ef4444' : '#6B7280'} size={18} />
                                    <TextInput
                                        className="flex-1 text-white font-medium"
                                        placeholder="kullaniciadi"
                                        placeholderTextColor="#4B5563"
                                        autoCapitalize="none"
                                        value={formData.username}
                                        onChangeText={(t) => updateField('username', t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                                    />
                                    {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#D4AF37" />}
                                    {usernameStatus === 'valid' && <CheckCircle size={18} color="#22c55e" />}
                                    {usernameStatus === 'taken' && <XCircle size={18} color="#ef4444" />}
                                </View>

                                <View className="flex-row justify-between ml-1">
                                    <Text className="text-gray-500 text-[10px]">Influmatch için bir kullanıcı adı girin.</Text>
                                    {usernameStatus === 'taken' && <Text className="text-red-400 text-[10px] font-bold">Bu kullanıcı adı kullanımda</Text>}
                                    {usernameStatus === 'valid' && <Text className="text-green-400 text-[10px] font-bold">Kullanıcı adı uygun</Text>}
                                </View>
                            </View>

                            {/* İçerik üretici türü (web ile aynı seçenekler) */}
                            {role === 'influencer' && (
                                <View className="space-y-2">
                                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">İçerik Üretici Türü</Text>
                                    <View className="flex-row gap-2">
                                        {CREATOR_TYPES.map((type) => {
                                            const isSelected = formData.creatorType === type.value;
                                            return (
                                                <TouchableOpacity
                                                    key={type.value}
                                                    onPress={() => updateField('creatorType', type.value)}
                                                    className={`flex-1 items-center rounded-2xl border px-2 py-3 ${isSelected ? 'bg-soft-gold/10 border-soft-gold' : 'bg-surface border-white/10'}`}
                                                >
                                                    <Text className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-400'}`}>{type.label}</Text>
                                                    <Text className="text-[10px] text-gray-500 mt-0.5">{type.desc}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* Kategori Seçimi (SADECE INFLUENCER) */}
                            {role === 'influencer' && (
                                <View className="space-y-2">
                                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Kategori</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                                        {INFLUENCER_CATEGORY_KEYS.map((cat) => {
                                            const isSelected = formData.category === cat;
                                            return (
                                                <TouchableOpacity
                                                    key={cat}
                                                    onPress={() => selectCategory(cat)}
                                                    className={`mr-2 px-4 py-2 rounded-full border ${isSelected ? 'bg-soft-gold border-soft-gold' : 'bg-surface border-white/10'}`}
                                                >
                                                    <Text className={`${isSelected ? 'text-[#0B0F19] font-bold' : 'text-gray-400'}`}>{INFLUENCER_CATEGORIES[cat]}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            )}

                            {role === 'brand' && (
                                <View className="space-y-4">
                                    {/* Web sitesi (zorunlu; kurumsal e-posta bu alan adına ait olmalı) */}
                                    <View className="space-y-2">
                                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Web Sitesi</Text>
                                        <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                            <Globe color="#6B7280" size={18} />
                                            <TextInput
                                                className="flex-1 text-white font-medium"
                                                placeholder="https://www.markaniz.com"
                                                placeholderTextColor="#4B5563"
                                                autoCapitalize="none"
                                                keyboardType="url"
                                                value={formData.website}
                                                onChangeText={(t) => updateField('website', t)}
                                            />
                                        </View>
                                    </View>

                                    {/* Kurumsal e-posta */}
                                    <View className="space-y-2">
                                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Kurumsal E-posta</Text>
                                        <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                            <AtSign color="#6B7280" size={18} />
                                            <TextInput
                                                className="flex-1 text-white font-medium"
                                                placeholder="ad@markaniz.com"
                                                placeholderTextColor="#4B5563"
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                                value={formData.corporateEmail}
                                                onChangeText={(t) => updateField('corporateEmail', t)}
                                            />
                                        </View>
                                        <Text className="text-gray-500 text-[10px] ml-1 leading-4">
                                            Web sitenizin alan adına ait bir e-posta olmalı (giriş e-postanızdan farklı olabilir). "Resmi İşletme" rozeti için bu adrese gönderilen kodla doğrulanır.
                                        </Text>
                                    </View>

                                    {/* Vergi Numarası */}
                                    <View className="space-y-2">
                                        <View className="flex-row items-center ml-1 gap-2">
                                            <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider">Vergi Numarası</Text>
                                            <View className="bg-gray-700/60 px-2 py-0.5 rounded-full">
                                                <Text className="text-gray-400 text-[9px] font-bold">OPSİYONEL</Text>
                                            </View>
                                        </View>
                                        <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                            <Hash color="#6B7280" size={18} />
                                            <TextInput
                                                className="flex-1 text-white font-medium"
                                                placeholder="1234567890"
                                                placeholderTextColor="#4B5563"
                                                keyboardType="number-pad"
                                                maxLength={14}
                                                value={formData.taxId}
                                                onChangeText={(t) => updateField('taxId', t)}
                                            />
                                        </View>
                                        <Text className="text-gray-500 text-[10px] ml-1 leading-4">
                                            Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girer.
                                        </Text>
                                    </View>

                                    {formData.taxId.trim() ? (
                                        <View className="space-y-4">
                                            <View className="space-y-2">
                                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Vergi Dairesi</Text>
                                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                                    <Building color="#6B7280" size={18} />
                                                    <TextInput
                                                        className="flex-1 text-white font-medium"
                                                        placeholder="Kadıköy Vergi Dairesi"
                                                        placeholderTextColor="#4B5563"
                                                        value={formData.taxOffice}
                                                        onChangeText={(t) => updateField('taxOffice', t)}
                                                    />
                                                </View>
                                            </View>
                                            <View className="space-y-2">
                                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Vergi Dairesinin İli</Text>
                                                <TouchableOpacity
                                                    onPress={() => { setCityField('taxOfficeCity'); setShowCityModal(true); }}
                                                    className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3"
                                                >
                                                    <MapPin color="#6B7280" size={18} />
                                                    <Text className={`flex-1 font-medium ${formData.taxOfficeCity ? 'text-white' : 'text-[#4B5563]'}`}>
                                                        {formData.taxOfficeCity || 'Şehir Seçin'}
                                                    </Text>
                                                    <ChevronRight color="#4B5563" size={20} />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : null}
                                </View>
                            )}

                            {/* Şehir Seçimi */}
                            <View className="space-y-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Şehir</Text>
                                <TouchableOpacity
                                    onPress={() => { setCityField('city'); setShowCityModal(true); }}
                                    className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3"
                                >
                                    <MapPin color="#6B7280" size={18} />
                                    <Text className={`flex-1 font-medium ${formData.city ? 'text-white' : 'text-[#4B5563]'}`}>
                                        {formData.city || 'Şehir Seçin'}
                                    </Text>
                                    <ChevronRight color="#4B5563" size={20} />
                                </TouchableOpacity>
                            </View>

                            {/* Biyografi */}
                            <View className="space-y-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Biyografi</Text>
                                <View className="bg-surface border border-white/10 rounded-2xl p-4 min-h-[100px]">
                                    <View className="flex-row space-x-3">
                                        <AlignLeft color="#6B7280" size={18} className="mt-1" />
                                        <TextInput
                                            className="flex-1 text-white font-medium leading-5"
                                            placeholder="Kendinden kısaca bahset..."
                                            placeholderTextColor="#4B5563"
                                            multiline
                                            value={formData.bio}
                                            onChangeText={(t) => updateField('bio', t)}
                                            style={{ textAlignVertical: 'top' }}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Sosyal Medya Linkleri (influencer için en az biri zorunlu, markada isteğe bağlı) */}
                            {(
                                <View className="space-y-4 pt-4 border-t border-white/5">
                                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Sosyal Medya</Text>
                                    <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-12 px-4">
                                        <Instagram color="#E1306C" size={18} />
                                        <Text className="text-gray-500 ml-2 text-sm">instagram.com/</Text>
                                        <TextInput className="flex-1 text-white text-sm ml-0.5" placeholder="username" placeholderTextColor="#4B5563" autoCapitalize="none" value={formData.instagram} onChangeText={(t) => updateField('instagram', t)} />
                                    </View>
                                    <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-12 px-4">
                                        <Music2 color="#fff" size={18} fill="#000" />
                                        <Text className="text-gray-500 ml-2 text-sm">tiktok.com/@</Text>
                                        <TextInput className="flex-1 text-white text-sm ml-0.5" placeholder="username" placeholderTextColor="#4B5563" autoCapitalize="none" value={formData.tiktok} onChangeText={(t) => updateField('tiktok', t)} />
                                    </View>
                                    <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-12 px-4">
                                        <Youtube color="#FF0000" size={18} />
                                        <Text className="text-gray-500 ml-2 text-sm">youtube.com/</Text>
                                        <TextInput className="flex-1 text-white text-sm ml-0.5" placeholder="channel" placeholderTextColor="#4B5563" autoCapitalize="none" value={formData.youtube} onChangeText={(t) => updateField('youtube', t)} />
                                    </View>
                                    {role === 'influencer' && (
                                        <View className="flex-row items-center mt-2 bg-red-500/10 p-3 rounded-xl border border-red-500/30">
                                            <AlertCircle size={18} color="#EF4444" style={{ marginRight: 8 }} />
                                            <Text className="text-red-400 text-xs flex-1 font-medium leading-4">Hesabınızın doğrulanabilmesi için en az 1 sosyal medya hesabınızı eklemeniz gerekmektedir.</Text>
                                        </View>
                                    )}
                                </View>
                            )}

                            <TouchableOpacity activeOpacity={0.9} onPress={handleSubmit} disabled={loading} className="overflow-hidden rounded-2xl mt-4 shadow-lg shadow-soft-gold/20">
                                <LinearGradient colors={['#D4AF37', '#b89428']} className="h-14 items-center justify-center">
                                    {loading ? <ActivityIndicator color="black" /> : <View className="flex-row items-center space-x-2"><Text className="text-[#0B0F19] font-bold text-lg">Kaydet ve Başla</Text><ChevronRight color="#0B0F19" size={20} strokeWidth={2.5} /></View>}
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            </KeyboardAvoidingView>

            <Modal visible={showCityModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCityModal(false)}>
                <View className="flex-1 bg-midnight">
                    <View className="flex-row justify-between items-center p-4 border-b border-white/10">
                        <Text className="text-white text-lg font-bold">Şehir Seçin</Text>
                        <TouchableOpacity onPress={() => setShowCityModal(false)}><X color="white" size={24} /></TouchableOpacity>
                    </View>
                    <View className="p-4">
                        <View className="flex-row items-center bg-surface border border-white/10 rounded-xl px-3 h-10">
                            <Search color="#6B7280" size={18} />
                            <TextInput className="flex-1 text-white ml-2" placeholder="Şehir ara..." placeholderTextColor="#6B7280" value={citySearch} onChangeText={setCitySearch} />
                        </View>
                    </View>
                    <FlatList data={filteredCities} keyExtractor={item => item} renderItem={({ item }) => (
                        <TouchableOpacity className={`p-4 border-b border-white/5 flex-row justify-between items-center ${formData[cityField] === item ? 'bg-soft-gold/10' : ''}`} onPress={() => { updateField(cityField, item); setShowCityModal(false); }}>
                            <Text className={`text-base ${formData[cityField] === item ? 'text-soft-gold font-bold' : 'text-gray-300'}`}>{item}</Text>
                            {formData[cityField] === item && <Text className="text-soft-gold">✓</Text>}
                        </TouchableOpacity>
                    )} />
                </View>
            </Modal>
        </View>
    );
}
