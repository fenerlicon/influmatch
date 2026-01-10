import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, KeyboardAvoidingView, ScrollView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Mail, KeyRound } from 'lucide-react-native';
import { CustomToast } from '../components/CustomToast';
import { getTurkishErrorMessage } from '../lib/errorUtils';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    async function handleReset() {
        if (!email) {
            showToast('Lütfen e-posta adresinizi girin.', 'info');
            return;
        }

        setLoading(true);
        Keyboard.dismiss();

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: 'https://influmatch.net/auth/update-password',
        });

        if (error) {
            showToast(getTurkishErrorMessage(error), 'error');
            setLoading(false);
        } else {
            showToast('Sıfırlama bağlantısı gönderildi! Lütfen e-postanızı kontrol edin.', 'success');
            setTimeout(() => {
                navigation.goBack();
            }, 3000);
            setLoading(false);
        }
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

            <SafeAreaView className="flex-1">

                {/* Header */}
                <View className="px-6 pt-4 pb-2">
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/5"
                    >
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                </View>

                {/* Keyboard Handling Fix */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    className="flex-1"
                >
                    <ScrollView
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 }}
                        className="px-6"
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* justifyContent: 'center' kaldırıldı. Manuel margin verildi. */}
                        <View className="items-center w-full mt-10">

                            {/* Icon */}
                            <View className="w-24 h-24 bg-soft-gold/10 rounded-full items-center justify-center mb-6 border border-soft-gold/20">
                                <KeyRound color="#D4AF37" size={40} />
                            </View>

                            <Text className="text-white text-3xl font-bold mb-3 text-center">Şifreni mi Unuttun?</Text>
                            <Text className="text-gray-400 text-center text-sm px-4 mb-10 leading-6">
                                Endişelenme, olabilir. E-posta adresini gir, sana şifreni sıfırlaman için bir bağlantı gönderelim.
                            </Text>

                            {/* Form */}
                            <View className="w-full space-y-6">
                                <View className="space-y-2">
                                    <Text className="text-gray-400 text-xs font-bold uppercase tracking-wider ml-1">E-Posta</Text>
                                    <View className="flex-row items-center bg-surface border border-white/10 rounded-2xl px-4 h-14 space-x-3 focus:border-soft-gold/50 transition-all">
                                        <Mail color="#6B7280" size={20} />
                                        <TextInput
                                            className="flex-1 text-white font-medium h-full"
                                            placeholder="ornek@mail.com"
                                            placeholderTextColor="#4B5563"
                                            autoCapitalize="none"
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                        />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={handleReset}
                                    disabled={loading}
                                    className="overflow-hidden rounded-2xl mt-4 shadow-lg shadow-soft-gold/10 w-full"
                                >
                                    <LinearGradient
                                        colors={['#D4AF37', '#B4932C']}
                                        className="h-14 items-center justify-center flex-row space-x-2"
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="black" />
                                        ) : (
                                            <Text className="text-[#0B0F19] font-bold text-lg">Bağlantı Gönder</Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
