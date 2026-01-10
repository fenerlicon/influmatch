import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, MailOpen } from 'lucide-react-native';
import { CustomToast } from '../components/CustomToast';
import { getTurkishErrorMessage } from '../lib/errorUtils';

export default function VerifyEmailScreen({ route, navigation }) {
    const { email } = route.params;
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60); // 60 saniye sayaç
    const inputRef = useRef(null);

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    // Sayaç Mantığı
    useEffect(() => {
        if (timeLeft > 0) {
            const timerId = setTimeout(() => {
                setTimeLeft(timeLeft - 1);
            }, 1000);
            return () => clearTimeout(timerId);
        }
    }, [timeLeft]);

    // Kod girildiğinde otomatik doğrulama için
    useEffect(() => {
        // 6 veya 8 haneli olabilir, 6'yı geçince tetiklemeye çalışalım ama asıl doğrulama butonu var
        if (code.length === 6 || code.length === 8) {
            // handleVerify(); // Otomatik tetiklemeyelim, 6 mı 8 mi emin değiliz, kullanıcı butona bassın
        }
    }, [code]);

    async function handleVerify() {
        if (code.length < 6) return;

        setLoading(true);
        Keyboard.dismiss();

        const { data, error } = await supabase.auth.verifyOtp({
            email: email,
            token: code,
            type: 'signup'
        });

        if (error) {
            showToast(getTurkishErrorMessage(error), 'error');
            setLoading(false);
        } else {
            showToast('Hesabınız başarıyla doğrulandı!', 'success');
            // Navigate after delay
            setTimeout(() => {
                navigation.replace('Onboarding');
            }, 1000);
            setLoading(false);
        }
    }

    // Yeniden gönder
    async function handleResend() {
        if (timeLeft > 0) return;

        // Supabase Resend Logic
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email: email,
        });

        if (error) {
            showToast(getTurkishErrorMessage(error), 'error');
        } else {
            showToast('Yeni doğrulama kodu gönderildi.', 'success');
            setTimeLeft(60);
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

            <SafeAreaView className="flex-1 px-6">

                {/* Header */}
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 bg-white/5 rounded-full items-center justify-center border border-white/5 mt-4"
                >
                    <ArrowLeft color="white" size={20} />
                </TouchableOpacity>

                <View className="flex-1 items-center justify-center -mt-20">

                    {/* İkon */}
                    <View className="w-24 h-24 bg-soft-gold/10 rounded-full items-center justify-center mb-6 border border-soft-gold/20">
                        <MailOpen color="#D4AF37" size={40} />
                    </View>

                    <Text className="text-white text-3xl font-bold mb-3 text-center">E-Postanı Doğrula</Text>
                    <Text className="text-gray-400 text-center text-sm px-4 mb-2 leading-6">
                        <Text className="text-white font-bold">{email}</Text> adresine gönderdiğimiz 6 haneli doğrulama kodunu gir.
                    </Text>
                    <Text className="text-gray-500 text-[10px] text-center mb-10">
                        Lütfen spam klasörünü de kontrol etmeyi unutma.
                    </Text>

                    {/* Code Input UI */}
                    <View className="relative mb-8 w-full items-center">
                        <TextInput
                            ref={inputRef}
                            value={code}
                            onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').substr(0, 6))}
                            keyboardType="number-pad"
                            className="absolute w-full h-16 opacity-0" // Gizli input
                            autoFocus={true}
                        />

                        {/* Görsel Kutular */}
                        {/* Fixed to 6 digits to match Supabase default and validation logic */}
                        <View className="flex-row justify-center w-full flex-wrap gap-2" pointerEvents="none">
                            {[0, 1, 2, 3, 4, 5].map((i) => {
                                const digit = code[i];
                                const isActive = i === code.length;
                                return (
                                    <View
                                        key={i}
                                        className={`w-11 h-14 rounded-xl border items-center justify-center bg-surface transition-all ${isActive ? 'border-soft-gold bg-soft-gold/5' :
                                            digit ? 'border-white/30' : 'border-white/10'
                                            }`}
                                    >
                                        <Text className="text-white text-2xl font-bold">
                                            {digit || ''}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Buton */}
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={handleVerify}
                        disabled={loading || code.length !== 6}
                        className={`w-full overflow-hidden rounded-2xl shadow-lg shadow-soft-gold/20 ${code.length !== 6 ? 'opacity-50' : ''}`}
                    >
                        <LinearGradient
                            colors={['#D4AF37', '#b89428']}
                            className="h-14 items-center justify-center"
                        >
                            {loading ? (
                                <ActivityIndicator color="black" />
                            ) : (
                                <Text className="text-[#0B0F19] font-bold text-lg">Doğrula ve Devam Et</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Sayaç ve Yeniden Gönder */}
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={handleResend}
                        disabled={timeLeft > 0}
                        className={`mt-6 w-full py-4 rounded-xl border items-center justify-center ${timeLeft > 0
                                ? 'border-white/10 bg-white/5'
                                : 'border-soft-gold/50 bg-soft-gold/10'
                            }`}
                    >
                        <Text className={`font-medium ${timeLeft > 0 ? 'text-gray-500' : 'text-soft-gold'}`}>
                            {timeLeft > 0
                                ? `Yeni kod için bekle: ${timeLeft}sn`
                                : 'Kodu Tekrar Gönder'
                            }
                        </Text>
                    </TouchableOpacity>

                </View>
            </SafeAreaView>
        </View>
    );
}
