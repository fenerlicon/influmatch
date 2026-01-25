import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, Modal, Clipboard, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, Camera, Save, User, Briefcase, Link as LinkIcon, Edit2, Instagram, CheckCircle2, Copy, X } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function MyProfileScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState({
        full_name: '',
        username: '',
        bio: '',
        website: '',
        location: 'Türkiye',
        category: 'Lifestyle',
        avatar_url: null,
        instagram_connected: false
    });

    // Instagram Verification States
    const [modalVisible, setModalVisible] = useState(false);
    const [verifyStep, setVerifyStep] = useState(1); // 1: Input, 2: Code, 3: Success
    const [igUsername, setIgUsername] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        getProfile();
    }, []);

    async function getProfile() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get User Profile
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            // 2. Check if Instagram is connected
            const { data: socialData } = await supabase
                .from('social_accounts')
                .select('id')
                .eq('user_id', user.id)
                .eq('platform', 'instagram')
                .single();

            if (data) {
                setProfile({
                    ...data,
                    location: data.location || 'Türkiye',
                    website: data.website || '',
                    bio: data.bio || '',
                    instagram_connected: !!socialData
                });
            }
        } catch (error) {
            console.log('Error:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleUpdate = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            const updates = {
                id: user.id,
                full_name: profile.full_name,
                username: profile.username,
                bio: profile.bio,
                website: profile.website,
                category: profile.category,
                updated_at: new Date(),
            };

            const { error } = await supabase.from('users').upsert(updates);
            if (error) throw error;

            Alert.alert('Başarılı', 'Profiliniz güncellendi.');
            navigation.goBack();

        } catch (error) {
            Alert.alert('Hata', error.message);
        } finally {
            setSaving(false);
        }
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (!result.canceled) {
            Alert.alert('Demo', 'Avatar yükleme işlemi bu demoda simüle edilmiştir.');
        }
    };

    // --- INSTAGRAM VERIFICATION LOGIC ---

    const getApiUrl = () => {
        // Change this to your production URL when deploying
        // For Android Emulator use 10.0.2.2, for iOS Simulator use localhost
        if (Platform.OS === 'android') return 'http://10.0.2.2:3000/api/mobile/verify-instagram';

        // Default (iOS Simulator or Web Preview)
        return 'http://localhost:3000/api/mobile/verify-instagram';
    };

    const generateCode = async () => {
        if (!igUsername) return Alert.alert('Uyarı', 'Lütfen Instagram kullanıcı adını gir.');

        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Kullanıcı bulunamadı");

            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate',
                    userId: user.id,
                    username: igUsername
                })
            });

            // Handle non-JSON responses (like 404 HTML)
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("API Response not JSON:", text);
                throw new Error("Sunucudan geçersiz yanıt alındı. API rotasını kontrol edin.");
            }

            if (data.success && data.code) {
                setVerificationCode(data.code);
                setVerifyStep(2);
            } else {
                throw new Error(data.error || 'Kod üretilemedi.');
            }

        } catch (error) {
            console.error('API Error:', error);
            Alert.alert('Hata', error.message || 'Bağlantı hatası.');
        } finally {
            setVerifying(false);
        }
    };

    const verifyAccount = async () => {
        setVerifying(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Kullanıcı bulunamadı");

            const response = await fetch(getApiUrl(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify',
                    userId: user.id
                })
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.error("API Response not JSON (Verify):", text);
                throw new Error("Sunucu hatası.");
            }

            if (data.success) {
                setProfile(prev => ({ ...prev, instagram_connected: true }));
                setVerifyStep(3);

                // Refresh profile data to get social stats
                getProfile();
            } else {
                throw new Error(data.error || 'Doğrulama başarısız.');
            }

        } catch (error) {
            console.error('Verification Error:', error);
            Alert.alert('Hata', error.message || 'Doğrulama sırasında hata oluştu.');
        } finally {
            setVerifying(false);
        }
    };

    const copyToClipboard = () => {
        Clipboard.setString(verificationCode);
        Alert.alert('Kopyalandı', 'Doğrulama kodu kopyalandı.');
    };

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <ActivityIndicator color="#D4AF37" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Profili Düzenle</Text>
                    <View className="w-10" />
                </View>

                <ScrollView className="flex-1 px-6">

                    {/* Avatar Edit */}
                    <View className="items-center my-6">
                        <View className="w-28 h-28 rounded-full border-4 border-white/10 relative">
                            <Image
                                source={{ uri: profile.avatar_url || 'https://via.placeholder.com/150' }}
                                className="w-full h-full rounded-full bg-gray-800"
                            />
                            <TouchableOpacity
                                onPress={pickImage}
                                className="absolute bottom-0 right-0 bg-soft-gold w-8 h-8 rounded-full items-center justify-center shadow-lg"
                            >
                                <Camera size={16} color="black" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Social Accounts Section */}
                    <View className="mb-8">
                        <Text className="text-gray-400 text-xs font-bold uppercase ml-1 mb-3">SOSYAL HESAPLAR</Text>

                        <View className="bg-[#15171e] rounded-xl border border-white/10 overflow-hidden">
                            <View className="p-4 flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 items-center justify-center mr-3">
                                        <Instagram color="white" size={20} />
                                    </View>
                                    <View>
                                        <Text className="text-white font-bold text-sm">Instagram</Text>
                                        <Text className="text-gray-500 text-xs">{profile.instagram_connected ? 'Bağlandı' : 'Bağlı Değil'}</Text>
                                    </View>
                                </View>

                                {profile.instagram_connected ? (
                                    <View className="bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20 flex-row items-center">
                                        <CheckCircle2 size={12} color="#4ade80" className="mr-1.5" />
                                        <Text className="text-green-400 text-xs font-bold">ONAYLI</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => setModalVisible(true)}
                                        className="bg-white/10 px-4 py-2 rounded-lg"
                                    >
                                        <Text className="text-white text-xs font-bold">BAĞLA</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Form Fields */}
                    <View className="space-y-5 pb-10">
                        <View>
                            <Text className="text-gray-400 text-xs font-bold uppercase ml-1 mb-2">AD SOYAD</Text>
                            <View className="flex-row items-center bg-[#15171e] rounded-xl border border-white/10 px-4 h-12">
                                <User size={18} color="#6b7280" className="mr-3" />
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    value={profile.full_name}
                                    onChangeText={(text) => setProfile({ ...profile, full_name: text })}
                                    placeholder="Ad Soyad"
                                    placeholderTextColor="#4b5563"
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-bold uppercase ml-1 mb-2">KULLANICI ADI</Text>
                            <View className="flex-row items-center bg-[#15171e] rounded-xl border border-white/10 px-4 h-12">
                                <Text className="text-gray-500 mr-1">@</Text>
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    value={profile.username}
                                    onChangeText={(text) => setProfile({ ...profile, username: text })}
                                    placeholder="kullaniciadi"
                                    placeholderTextColor="#4b5563"
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-bold uppercase ml-1 mb-2">kategori</Text>
                            <View className="flex-row items-center bg-[#15171e] rounded-xl border border-white/10 px-4 h-12">
                                <Briefcase size={18} color="#6b7280" className="mr-3" />
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    value={profile.category}
                                    onChangeText={(text) => setProfile({ ...profile, category: text })}
                                    placeholder="Örn: Teknoloji"
                                    placeholderTextColor="#4b5563"
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-bold uppercase ml-1 mb-2">WEBSITE</Text>
                            <View className="flex-row items-center bg-[#15171e] rounded-xl border border-white/10 px-4 h-12">
                                <LinkIcon size={18} color="#6b7280" className="mr-3" />
                                <TextInput
                                    className="flex-1 text-white font-medium"
                                    value={profile.website}
                                    onChangeText={(text) => setProfile({ ...profile, website: text })}
                                    placeholder="https://..."
                                    placeholderTextColor="#4b5563"
                                />
                            </View>
                        </View>

                        <View>
                            <Text className="text-gray-400 text-xs font-bold uppercase ml-1 mb-2">BİYOGRAFİ</Text>
                            <View className="flex-row items-start bg-[#15171e] rounded-xl border border-white/10 p-4 h-32">
                                <Edit2 size={18} color="#6b7280" className="mr-3 mt-1" />
                                <TextInput
                                    className="flex-1 text-white font-medium text-sm leading-5"
                                    value={profile.bio}
                                    onChangeText={(text) => setProfile({ ...profile, bio: text })}
                                    placeholder="Kendinden bahset..."
                                    placeholderTextColor="#4b5563"
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleUpdate}
                        disabled={saving}
                        className="bg-soft-gold h-14 rounded-2xl items-center justify-center flex-row shadow-lg shadow-soft-gold/20 mb-10"
                    >
                        {saving ? (
                            <ActivityIndicator color="black" />
                        ) : (
                            <>
                                <Save color="black" size={20} className="mr-2" />
                                <Text className="text-black font-bold text-lg">Değişiklikleri Kaydet</Text>
                            </>
                        )}
                    </TouchableOpacity>

                </ScrollView>
            </SafeAreaView>

            {/* --- INSTAGRAM VERIFICATION MODAL --- */}
            <Modal
                animationType="slide"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 justify-center px-6">
                    <View className="bg-[#15171e] rounded-3xl border border-white/10 p-6">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="text-white text-xl font-bold">Instagram Hesabını Bağla</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <X color="gray" size={24} />
                            </TouchableOpacity>
                        </View>

                        {verifyStep === 1 && (
                            <>
                                <Text className="text-gray-400 text-sm mb-4">
                                    Instagram hesabını analiz edebilmemiz için kullanıcı adını gir.
                                </Text>
                                <View className="bg-black/30 h-14 rounded-xl border border-white/10 px-4 flex-row items-center mb-6">
                                    <Instagram size={20} color="#a855f7" className="mr-3" />
                                    <TextInput
                                        className="flex-1 text-white font-medium"
                                        placeholder="Kullanıcı adı"
                                        placeholderTextColor="#6b7280"
                                        value={igUsername}
                                        onChangeText={setIgUsername}
                                        autoCapitalize="none"
                                    />
                                </View>
                                <TouchableOpacity
                                    onPress={generateCode}
                                    disabled={verifying}
                                    className="bg-purple-600 h-12 rounded-xl items-center justify-center"
                                >
                                    {verifying ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold">Devam Et</Text>}
                                </TouchableOpacity>
                            </>
                        )}

                        {verifyStep === 2 && (
                            <>
                                <Text className="text-gray-300 text-sm mb-4 leading-6">
                                    Aşağıdaki doğrulama kodunu Instagram biyografine ekle ve "Doğrula" butonuna bas.
                                </Text>

                                <View className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4 mb-6 flex-row items-center justify-between">
                                    <Text className="text-white font-mono text-lg font-bold tracking-widest">{verificationCode}</Text>
                                    <TouchableOpacity onPress={copyToClipboard} className="p-2">
                                        <Copy size={20} color="#a855f7" />
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    onPress={verifyAccount}
                                    disabled={verifying}
                                    className="bg-soft-gold h-12 rounded-xl items-center justify-center mb-3"
                                >
                                    {verifying ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold">Hesabı Doğrula</Text>}
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setVerifyStep(1)} className="items-center py-2">
                                    <Text className="text-gray-500 text-xs">Geri Dön</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {verifyStep === 3 && (
                            <View className="items-center py-6">
                                <View className="w-16 h-16 bg-green-500/20 rounded-full items-center justify-center mb-4 border border-green-500/50">
                                    <CheckCircle2 size={32} color="#4ade80" />
                                </View>
                                <Text className="text-white text-lg font-bold mb-2">Başarıyla Bağlandı!</Text>
                                <Text className="text-gray-400 text-center text-sm mb-6">
                                    Instagram hesabın doğrulandı ve verilerin çekildi.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setModalVisible(false);
                                        setVerifyStep(1); // Reset for future
                                        setIgUsername('');
                                    }}
                                    className="bg-white/10 w-full h-12 rounded-xl items-center justify-center"
                                >
                                    <Text className="text-white font-bold">Tamam</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}
