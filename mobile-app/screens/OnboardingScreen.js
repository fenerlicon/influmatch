import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Pressable, Image } from 'react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { resolveHomeRoute } from '../lib/routing';
import { User, MapPin, Globe, Instagram, Youtube, Music2, Hash, Building, AtSign, AlertCircle, CheckCircle, XCircle, Camera, Check } from 'lucide-react-native';
import { CustomToast } from '../components/CustomToast';
import { getTurkishErrorMessage } from '../lib/errorUtils';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
// Web ile aynı kategori anahtarları (utils/categories.ts); tek kategori seçilir.
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '../constants/categories';
import {
    Screen, StackHeader, BottomBar, Text, Button, TextField, SelectField, OptionSheet, FilterChip, Chip, Notice, colors, ICON_STROKE,
} from '../components/ui';

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
        return <View className="flex-1 bg-bg items-center justify-center"><ActivityIndicator color={colors.gold} /></View>;
    }

    const isBrand = role === 'brand';
    const usernameRight = usernameStatus === 'checking'
        ? <ActivityIndicator size="small" color={colors.gold} />
        : usernameStatus === 'valid'
            ? <CheckCircle size={18} color={colors.success} strokeWidth={ICON_STROKE} />
            : usernameStatus === 'taken'
                ? <XCircle size={18} color={colors.danger} strokeWidth={ICON_STROKE} />
                : null;

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="Profilini tamamla" onBack={() => navigation.navigate('RegisterRole')} />}
            footer={<BottomBar><View className="flex-1"><Button title="Kaydet ve başla" onPress={handleSubmit} loading={loading} block /></View></BottomBar>}
            contentClassName="pt-2"
        >
            <CustomToast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

            <View style={{ gap: 6 }}>
                <Text variant="title">{isBrand ? 'Marka detayları' : 'Ne üretiyorsun?'}</Text>
                <Text tone="fg2">{isBrand ? 'Markan bu bilgilerle tanınır.' : 'Markalar seni bu bilgilere göre bulur.'}</Text>
            </View>

            {/* Fotoğraf / logo */}
            <View className="items-center py-1">
                <Pressable onPress={pickImage} accessibilityRole="button" accessibilityLabel={isBrand ? 'Logo yükle' : 'Fotoğraf yükle'}>
                    <View className={`w-[104px] h-[104px] rounded-full bg-s2 border items-center justify-center overflow-hidden ${formData.avatar_url ? 'border-gold-line' : 'border-dashed border-line-strong'}`}>
                        {formData.avatar_url ? (
                            <Image source={{ uri: formData.avatar_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                        ) : (
                            <View className="items-center" style={{ gap: 6 }}>
                                <Camera color={colors.fg3} size={24} strokeWidth={ICON_STROKE} />
                                <Text variant="caption" tone="fg3">{isBrand ? 'Logo yükle' : 'Fotoğraf yükle'}</Text>
                            </View>
                        )}
                    </View>
                    <View className="absolute bottom-0.5 right-0.5 w-8 h-8 rounded-full bg-gold border-2 border-bg items-center justify-center">
                        {uploading ? <ActivityIndicator size="small" color={colors.goldInk} />
                            : formData.avatar_url ? <Check color={colors.goldInk} size={15} strokeWidth={2.5} />
                                : <Camera color={colors.goldInk} size={15} strokeWidth={2} />}
                    </View>
                </Pressable>
            </View>

            <TextField
                label={isBrand ? 'Marka adı' : 'Ad soyad'}
                icon={isBrand ? Building : User}
                placeholder={isBrand ? 'Markanızın adı' : 'Adınız Soyadınız'}
                value={formData.fullName}
                onChangeText={(t) => updateField('fullName', t)}
            />

            <TextField
                label="Kullanıcı adı"
                icon={AtSign}
                placeholder="kullaniciadi"
                autoCapitalize="none"
                autoCorrect={false}
                value={formData.username}
                onChangeText={(t) => updateField('username', t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                right={usernameRight}
                error={usernameStatus === 'taken' ? 'Bu kullanıcı adı kullanımda.' : undefined}
                hint={usernameStatus === 'valid' ? 'Kullanıcı adı uygun. Sonradan değiştirilemez.' : usernameStatus === 'short' ? 'En az 3 karakter.' : 'Sonradan değiştirilemez.'}
            />

            {/* İçerik üretici türü (web ile aynı seçenekler) */}
            {!isBrand && (
                <View style={{ gap: 7 }}>
                    <Text variant="small" weight="medium" tone="fg2">İçerik üretici türü</Text>
                    <View className="flex-row" style={{ gap: 8 }}>
                        {CREATOR_TYPES.map((type) => {
                            const on = formData.creatorType === type.value;
                            return (
                                <Pressable
                                    key={type.value}
                                    onPress={() => updateField('creatorType', type.value)}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: on }}
                                    className={`flex-1 items-center rounded-xl border px-2 py-3 ${on ? 'bg-gold-soft border-gold-line' : 'bg-s1 border-line'}`}
                                >
                                    <Text variant="small" weight="semibold" tone={on ? 'fg' : 'fg2'}>{type.label}</Text>
                                    <Text variant="caption" tone="fg3" style={{ textAlign: 'center' }}>{type.desc}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Kategori (yalnızca influencer, tek seçim) */}
            {!isBrand && (
                <View style={{ gap: 7 }}>
                    <Text variant="small" weight="medium" tone="fg2">Kategori</Text>
                    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                        {INFLUENCER_CATEGORY_KEYS.map((cat) => (
                            <FilterChip key={cat} label={INFLUENCER_CATEGORIES[cat]} selected={formData.category === cat} onPress={() => selectCategory(cat)} />
                        ))}
                    </View>
                </View>
            )}

            {isBrand && (
                <>
                    {/* Web sitesi (zorunlu; kurumsal e-posta bu alan adına ait olmalı) */}
                    <TextField label="Web sitesi" icon={Globe} placeholder="https://www.markaniz.com" autoCapitalize="none" keyboardType="url" value={formData.website} onChangeText={(t) => updateField('website', t)} />
                    <TextField
                        label="Kurumsal e-posta"
                        icon={AtSign}
                        placeholder="ad@markaniz.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={formData.corporateEmail}
                        onChangeText={(t) => updateField('corporateEmail', t)}
                        hint={'Web sitenizin alan adına ait olmalı (giriş e-postanızdan farklı olabilir). "Resmi İşletme" rozeti için bu adrese gönderilen kodla doğrulanır.'}
                    />
                    <View style={{ gap: 7 }}>
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Text variant="small" weight="medium" tone="fg2">Vergi numarası</Text>
                            <Chip label="İsteğe bağlı" />
                        </View>
                        <TextField
                            icon={Hash}
                            placeholder="1234567890"
                            keyboardType="number-pad"
                            maxLength={14}
                            value={formData.taxId}
                            onChangeText={(t) => updateField('taxId', t)}
                            hint="Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girer."
                        />
                    </View>
                    {formData.taxId.trim() ? (
                        <>
                            <TextField label="Vergi dairesi" icon={Building} placeholder="Kadıköy Vergi Dairesi" value={formData.taxOffice} onChangeText={(t) => updateField('taxOffice', t)} />
                            <SelectField label="Vergi dairesinin ili" icon={MapPin} placeholder="Şehir seçin" value={formData.taxOfficeCity} onPress={() => { setCityField('taxOfficeCity'); setShowCityModal(true); }} />
                        </>
                    ) : null}
                </>
            )}

            <SelectField label="Şehir" icon={MapPin} placeholder="Şehir seçin" value={formData.city} onPress={() => { setCityField('city'); setShowCityModal(true); }} />

            <TextField label="Kısa tanıtım" placeholder="Kendinden kısaca bahset..." multiline value={formData.bio} onChangeText={(t) => updateField('bio', t)} />

            {/* Sosyal medya (influencer için en az biri zorunlu, markada isteğe bağlı) */}
            <View className="pt-3 border-t border-line" style={{ gap: 12 }}>
                <Text variant="small" weight="medium" tone="fg2">Sosyal medya</Text>
                <TextField icon={Instagram} prefix="instagram.com/" placeholder="kullaniciadi" autoCapitalize="none" autoCorrect={false} value={formData.instagram} onChangeText={(t) => updateField('instagram', t)} />
                <TextField icon={Music2} prefix="tiktok.com/@" placeholder="kullaniciadi" autoCapitalize="none" autoCorrect={false} value={formData.tiktok} onChangeText={(t) => updateField('tiktok', t)} />
                <TextField icon={Youtube} prefix="youtube.com/" placeholder="kanal" autoCapitalize="none" autoCorrect={false} value={formData.youtube} onChangeText={(t) => updateField('youtube', t)} />
                {!isBrand && (
                    <Notice tone="warning" icon={AlertCircle} text="Hesabının doğrulanabilmesi için en az bir sosyal medya hesabı eklemelisin." />
                )}
            </View>

            <OptionSheet
                visible={showCityModal}
                onClose={() => setShowCityModal(false)}
                title="Şehir seçin"
                searchPlaceholder="Şehir ara"
                options={TURKEY_CITIES}
                value={formData[cityField]}
                onSelect={(city) => updateField(cityField, city)}
            />
        </Screen>
    );
}
