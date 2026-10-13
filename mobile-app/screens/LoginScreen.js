import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { resolveHomeRoute, REJECTED_MESSAGE } from '../lib/routing';
import { CustomToast } from '../components/CustomToast';
import { Text, Button, TextField, colors } from '../components/ui';

// Türkçe Hata Mesajları Çevirisi
function getTurkishErrorMessage(error) {
    if (!error) return 'Bilinmeyen bir hata oluştu.';
    const msg = error.message || '';

    // Supabase Auth Hataları
    if (msg.includes('Invalid login credentials')) return 'E-posta adresi veya şifre hatalı.';
    if (msg.includes('Email not confirmed')) return 'Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.';
    if (msg.includes('User not found')) return 'Kullanıcı bulunamadı.';
    if (msg.includes('Invalid email')) return 'Geçersiz e-posta formatı.';
    if (msg.includes('network')) return 'Bağlantı hatası. İnternetinizi kontrol edin.';
    if (msg.includes('Rate limit')) return 'Çok fazla deneme yaptınız. Lütfen bekleyin.';

    return 'Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.';
}

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    async function signInWithEmail() {
        if (!email || !password) {
            showToast('Lütfen e-posta ve şifrenizi girin.', 'info');
            return;
        }

        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            showToast(getTurkishErrorMessage(error), 'error');
            setLoading(false);
        } else {
            // Yönlendirme veritabanındaki bilgilere göre (lib/routing.js); user_metadata'ya güvenilmez.
            let route;
            try {
                route = await resolveHomeRoute(data.user.id);
            } catch (e) {
                showToast('Profil bilgileri alınamadı. Lütfen tekrar deneyin.', 'error');
                setLoading(false);
                return;
            }

            if (route === 'Rejected') {
                showToast(REJECTED_MESSAGE, 'error');
                await supabase.auth.signOut();
                setLoading(false);
                return;
            }

            showToast('Giriş başarılı, yönlendiriliyorsunuz...', 'success');
            setTimeout(() => {
                navigation.replace(route);
                setLoading(false);
            }, 1000);
        }
    }

    const EyeIcon = showPassword ? EyeOff : Eye;

    return (
        <SafeAreaView className="flex-1 bg-bg">
            <CustomToast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 32, gap: 28 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ gap: 10 }}>
                        <Text weight="bold" style={{ fontSize: 30, lineHeight: 36, letterSpacing: 0.3 }}>
                            INFLU<Text weight="bold" tone="gold" style={{ fontSize: 30, lineHeight: 36, letterSpacing: 0.3 }}>MATCH</Text>
                        </Text>
                        <Text variant="display" style={{ fontSize: 40, lineHeight: 42 }}>Türkiye'nin Influencer Pazaryeri</Text>
                    </View>

                    <View style={{ gap: 14 }}>
                        <TextField
                            label="E-posta"
                            icon={Mail}
                            placeholder="ornek@mail.com"
                            autoCapitalize="none"
                            autoComplete="email"
                            keyboardType="email-address"
                            textContentType="emailAddress"
                            value={email}
                            onChangeText={setEmail}
                            returnKeyType="next"
                        />
                        <TextField
                            label="Şifre"
                            icon={Lock}
                            placeholder="••••••••"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            autoComplete="password"
                            textContentType="password"
                            value={password}
                            onChangeText={setPassword}
                            returnKeyType="go"
                            onSubmitEditing={signInWithEmail}
                            right={
                                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={10} accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                                    <EyeIcon size={18} color={colors.fg3} />
                                </Pressable>
                            }
                        />
                        <Text variant="small" tone="fg2" style={{ textAlign: 'right' }} onPress={() => navigation.navigate('ForgotPassword')} suppressHighlighting>
                            Şifremi unuttum
                        </Text>
                    </View>

                    <View style={{ gap: 14 }}>
                        <Button title="Giriş yap" onPress={signInWithEmail} loading={loading} block />
                        <Text variant="small" tone="fg2" style={{ textAlign: 'center' }}>
                            Hesabın yok mu?{' '}
                            <Text variant="small" weight="medium" tone="gold" onPress={() => navigation.navigate('RegisterRole')} suppressHighlighting>Kayıt ol</Text>
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
