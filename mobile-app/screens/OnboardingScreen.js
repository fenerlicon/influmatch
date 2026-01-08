import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { User, MapPin, AlignLeft, Globe, Instagram, Youtube, Video, ChevronRight, Hash, Building } from 'lucide-react-native';

const CATEGORIES = ['Moda', 'Güzellik', 'Teknoloji', 'Oyun', 'Spor', 'Yaşam', 'Seyahat', 'Yemek', 'Sanat', 'Eğlence'];

export default function OnboardingScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState(null); // 'influencer' or 'brand'
    const [user, setUser] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        bio: '',
        city: '',
        website: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        taxId: '', // For brands
        category: '', // For influencers
    });

    useEffect(() => {
        getCurrentUser();
    }, []);

    async function getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            setRole(user.user_metadata?.role || 'influencer');
        } else {
            // No user found, redirect to login
            navigation.replace('Login');
        }
    }

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    async function handleSubmit() {
        if (!formData.username || !formData.city) {
            Alert.alert('Eksik Bilgi', 'Lütfen Kullanıcı Adı ve Şehir alanlarını doldurun.');
            return;
        }

        if (role === 'influencer' && !formData.category) {
            Alert.alert('Eksik Bilgi', 'Lütfen bir kategori seçin.');
            return;
        }

        if (role === 'brand' && !formData.taxId) {
            Alert.alert('Eksik Bilgi', 'Lütfen Vergi Numarası girin.');
            return;
        }

        setLoading(true);

        try {
            // 1. Check if username is taken
            const { data: existingUser, error: checkError } = await supabase
                .from('users')
                .select('id')
                .eq('username', formData.username)
                .neq('id', user.id) // Exclude current user
                .single();

            if (existingUser) {
                Alert.alert('Hata', 'Bu kullanıcı adı zaten alınmış.');
                setLoading(false);
                return;
            }

            // 2. Prepare update data
            const updates = {
                username: formData.username,
                bio: formData.bio,
                location: formData.city,
                social_links: {
                    instagram: formData.instagram,
                    tiktok: formData.tiktok,
                    youtube: formData.youtube,
                    website: formData.website
                },
                updated_at: new Date(),
                is_onboarded: true, // Mark as completed
                ...(role === 'influencer' ? { category: formData.category } : { tax_id: formData.taxId })
            };

            // 3. Update public.users table
            const { error: updateError } = await supabase
                .from('users')
                .update(updates)
                .eq('id', user.id);

            if (updateError) throw updateError;

            // 4. Update auth metadata (optional but good for syncing)
            await supabase.auth.updateUser({
                data: { username: formData.username, is_onboarded: true }
            });

            // Success -> Go to Dashboard
            navigation.replace('Dashboard'); // Bu ekranı henüz oluşturmadık, Login'deki gibi placeholder gerekebilir

        } catch (error) {
            Alert.alert('Hata', error.message);
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
            <SafeAreaView className="flex-1">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1"
                >
                    <ScrollView className="flex-1 px-6 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                        <Text className="text-soft-gold text-sm font-bold uppercase tracking-widest mb-2">Profilini Tamamla</Text>
                        <Text className="text-white text-3xl font-bold mb-6">
                            {role === 'brand' ? 'Marka Detayları' : 'Influencer Profili'}
                        </Text>

                        <View className="space-y-6">

                            {/* Kullanıcı Adı */}
                            <View className="space-y-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Kullanıcı Adı</Text>
                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                    <Hash color="#6B7280" size={18} />
                                    <TextInput
                                        className="flex-1 text-white font-medium"
                                        placeholder="kullaniciadi"
                                        placeholderTextColor="#4B5563"
                                        autoCapitalize="none"
                                        value={formData.username}
                                        onChangeText={(t) => updateField('username', t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                                    />
                                </View>
                            </View>

                            {/* Kategori Seçimi (SADECE INFLUENCER) */}
                            {role === 'influencer' && (
                                <View className="space-y-2">
                                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Kategori</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                                        {CATEGORIES.map((cat) => (
                                            <TouchableOpacity
                                                key={cat}
                                                onPress={() => updateField('category', cat)}
                                                className={`mr-2 px-4 py-2 rounded-full border ${formData.category === cat ? 'bg-soft-gold border-soft-gold' : 'bg-surface border-white/10'}`}
                                            >
                                                <Text className={`${formData.category === cat ? 'text-[#0B0F19] font-bold' : 'text-gray-400'}`}>{cat}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Tax ID (SADECE MARKA) */}
                            {role === 'brand' && (
                                <View className="space-y-2">
                                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Vergi Numarası</Text>
                                    <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                        <Building color="#6B7280" size={18} />
                                        <TextInput
                                            className="flex-1 text-white font-medium"
                                            placeholder="1234567890"
                                            placeholderTextColor="#4B5563"
                                            keyboardType="number-pad"
                                            value={formData.taxId}
                                            onChangeText={(t) => updateField('taxId', t)}
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Şehir */}
                            <View className="space-y-2">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Şehir</Text>
                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-14 px-4 space-x-3">
                                    <MapPin color="#6B7280" size={18} />
                                    <TextInput
                                        className="flex-1 text-white font-medium"
                                        placeholder="İstanbul"
                                        placeholderTextColor="#4B5563"
                                        value={formData.city}
                                        onChangeText={(t) => updateField('city', t)}
                                    />
                                </View>
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

                            {/* Sosyal Medya Linkleri */}
                            <View className="space-y-4 pt-4 border-t border-white/5">
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">Sosyal Medya</Text>

                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-12 px-4 space-x-3">
                                    <Instagram color="#E1306C" size={18} />
                                    <TextInput
                                        className="flex-1 text-white text-sm"
                                        placeholder="Instagram Username"
                                        placeholderTextColor="#4B5563"
                                        autoCapitalize="none"
                                        value={formData.instagram}
                                        onChangeText={(t) => updateField('instagram', t)}
                                    />
                                </View>

                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-12 px-4 space-x-3">
                                    <Video color="#fff" size={18} fill="#000" /> {/* TikTok (Simulated) */}
                                    <TextInput
                                        className="flex-1 text-white text-sm"
                                        placeholder="TikTok Username"
                                        placeholderTextColor="#4B5563"
                                        autoCapitalize="none"
                                        value={formData.tiktok}
                                        onChangeText={(t) => updateField('tiktok', t)}
                                    />
                                </View>

                                <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl h-12 px-4 space-x-3">
                                    <Youtube color="#FF0000" size={18} />
                                    <TextInput
                                        className="flex-1 text-white text-sm"
                                        placeholder="YouTube Channel URL"
                                        placeholderTextColor="#4B5563"
                                        autoCapitalize="none"
                                        value={formData.youtube}
                                        onChangeText={(t) => updateField('youtube', t)}
                                    />
                                </View>
                            </View>

                            {/* Kaydet Butonu */}
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={handleSubmit}
                                disabled={loading}
                                className="overflow-hidden rounded-2xl mt-4 shadow-lg shadow-soft-gold/20"
                            >
                                <LinearGradient
                                    colors={['#D4AF37', '#b89428']}
                                    className="h-14 items-center justify-center flex-row space-x-2"
                                >
                                    {loading ? (
                                        <ActivityIndicator color="black" />
                                    ) : (
                                        <>
                                            <Text className="text-[#0B0F19] font-bold text-lg">Kaydet ve Başla</Text>
                                            <ChevronRight color="#0B0F19" size={20} strokeWidth={2.5} />
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
