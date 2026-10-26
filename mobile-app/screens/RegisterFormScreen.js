import React, { useState } from 'react';
import { View, Pressable, Linking } from 'react-native';
import { Mail, Lock, User, Briefcase, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { CustomToast } from '../components/CustomToast';
import { getTurkishErrorMessage } from '../lib/errorUtils';
import { LEGAL_CONSENT_VERSION } from '../constants/consent';
import { Screen, StackHeader, BottomBar, Text, Button, TextField, Checkbox, colors } from '../components/ui';

function EyeToggle({ shown, onPress }) {
    const Icon = shown ? EyeOff : Eye;
    return (
        <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={shown ? 'Şifreyi gizle' : 'Şifreyi göster'}>
            <Icon size={18} color={colors.fg3} />
        </Pressable>
    );
}

export default function RegisterFormScreen({ route, navigation }) {
    const { role } = route.params;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        isAgreed: false,
        // Görevler: davet eden kullanıcının kodu (isteğe bağlı; kayıtta tetikleyici davet kaydını yazar).
        inviteCode: '',
    });

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Toast State
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const hideToast = () => {
        setToast(prev => ({ ...prev, visible: false }));
    };

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const openLink = (url) => {
        Linking.openURL(url).catch(err => console.error("Could not load page", err));
    };

    async function handleRegister() {
        if (!formData.fullName || !formData.email || !formData.password || !formData.confirmPassword) {
            showToast('Lütfen tüm zorunlu alanları doldurun.', 'info');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            showToast('Şifreler eşleşmiyor.', 'error');
            return;
        }

        if (!formData.isAgreed) {
            showToast('Lütfen Kullanım Koşulları ve Gizlilik Politikasını kabul edin.', 'info');
            return;
        }

        setLoading(true);

        const { data: { user }, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    full_name: formData.fullName,
                    role: role,
                    invite_code: /^[A-Z0-9]{6,12}$/.test(formData.inviteCode) ? formData.inviteCode : null,
                    // Onaylanan metnin sürümü (KVKK kaydı; tetikleyici sunucu saatiyle consent_records'a yazar)
                    legal_consent_version: LEGAL_CONSENT_VERSION,
                    signup_source: 'mobile',
                }
            }
        });

        if (authError) {
            showToast(getTurkishErrorMessage(authError), 'error');
            setLoading(false);
            return;
        }

        if (user) {
            // Toast göstermeye gerek yok, direkt geçiş yapıyoruz
            navigation.navigate('VerifyEmail', { email: formData.email });
        }
        setLoading(false);
    }

    const mismatch = !!formData.confirmPassword && formData.password !== formData.confirmPassword;

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader onBack={() => navigation.goBack()} right={<Text variant="caption" tone="fg3">2 / 3</Text>} />}
            footer={
                <BottomBar>
                    <View className="flex-1"><Button title="Kayıt ol" onPress={handleRegister} loading={loading} disabled={!formData.isAgreed} block /></View>
                </BottomBar>
            }
        >
            <CustomToast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

            <View style={{ gap: 6 }} className="mb-1">
                <Text variant="title" style={{ fontSize: 32, lineHeight: 36 }}>Hesabını oluştur</Text>
                <Text tone="fg2">{role === 'brand' ? 'Marka' : 'Influencer'} olarak kaydoluyorsun.</Text>
            </View>

            <TextField
                label={role === 'brand' ? 'Yetkili ad soyad' : 'Ad soyad'}
                icon={role === 'brand' ? Briefcase : User}
                placeholder="Adınız Soyadınız"
                autoComplete="name"
                value={formData.fullName}
                onChangeText={(t) => updateField('fullName', t)}
            />
            <TextField
                label="E-posta"
                icon={Mail}
                placeholder="ornek@mail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={formData.email}
                onChangeText={(t) => updateField('email', t)}
            />
            <TextField
                label="Şifre"
                icon={Lock}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                value={formData.password}
                onChangeText={(t) => updateField('password', t)}
                right={<EyeToggle shown={showPassword} onPress={() => setShowPassword(!showPassword)} />}
            />
            <TextField
                label="Şifre tekrarı"
                icon={Lock}
                placeholder="••••••••"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChangeText={(t) => updateField('confirmPassword', t)}
                error={mismatch ? 'Şifreler eşleşmiyor.' : undefined}
                right={<EyeToggle shown={showConfirmPassword} onPress={() => setShowConfirmPassword(!showConfirmPassword)} />}
            />
            <TextField
                label="Davet kodu"
                hint="İsteğe bağlı"
                placeholder="Örn. AB3K9QXZ"
                autoCapitalize="characters"
                autoCorrect={false}
                value={formData.inviteCode}
                onChangeText={(t) => updateField('inviteCode', t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12))}
            />

            <Checkbox checked={formData.isAgreed} onChange={(v) => updateField('isAgreed', v)}>
                <Text variant="small" tone="fg2" style={{ lineHeight: 20 }}>
                    <Text variant="small" weight="medium" tone="gold" onPress={() => openLink('https://influmatch.net/legal?tab=terms')}>Kullanım koşulları</Text>
                    {' '}ve{' '}
                    <Text variant="small" weight="medium" tone="gold" onPress={() => openLink('https://influmatch.net/legal?tab=privacy')}>gizlilik politikasını</Text>
                    {' '}okudum, kabul ediyorum.
                </Text>
            </Checkbox>

            <Text variant="small" tone="fg2" style={{ textAlign: 'center' }} className="mt-1">
                Zaten hesabın var mı?{' '}
                <Text variant="small" weight="medium" tone="gold" onPress={() => navigation.navigate('Login')} suppressHighlighting>Giriş yap</Text>
            </Text>
        </Screen>
    );
}
