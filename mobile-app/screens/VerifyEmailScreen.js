import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, Pressable, Keyboard } from 'react-native';
import { MailCheck, ClipboardPaste } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { CustomToast } from '../components/CustomToast';
import { getTurkishErrorMessage } from '../lib/errorUtils';
import { Screen, StackHeader, Text, Button, colors, fonts, ICON_STROKE } from '../components/ui';

const CODE_LENGTH = 6;

export default function VerifyEmailScreen({ route, navigation }) {
    const { email } = route.params;
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60); // 60 saniye sayaç
    const [clipboardCode, setClipboardCode] = useState('');
    const [focused, setFocused] = useState(true);
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

    // Clipboard Kontrolü
    useEffect(() => {
        checkClipboard();
        const interval = setInterval(checkClipboard, 2000);
        return () => clearInterval(interval);
    }, []);

    const checkClipboard = async () => {
        try {
            const text = await Clipboard.getStringAsync();
            const cleaned = text.trim();
            if (/^\d{6}$/.test(cleaned)) {
                setClipboardCode(cleaned);
            } else {
                setClipboardCode('');
            }
        } catch (e) {
            // silent fail
        }
    };

    const pasteFromClipboard = () => {
        if (clipboardCode) {
            setCode(clipboardCode);
            showToast('Kod panodan yapıştırıldı!', 'success');
        }
    };

    async function handleVerify() {
        if (code.length < CODE_LENGTH) return;

        setLoading(true);
        Keyboard.dismiss();

        const { error } = await supabase.auth.verifyOtp({
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
        <Screen scroll keyboard header={<StackHeader onBack={() => navigation.goBack()} right={<Text variant="caption" tone="fg3">3 / 3</Text>} />} contentClassName="pt-3">
            <CustomToast visible={toast.visible} message={toast.message} type={toast.type} onHide={hideToast} />

            <View className="w-[72px] h-[72px] rounded-[20px] bg-s1 border border-line items-center justify-center">
                <MailCheck size={32} color={colors.gold} strokeWidth={ICON_STROKE} />
            </View>
            <View style={{ gap: 6 }}>
                <Text variant="title" style={{ fontSize: 32, lineHeight: 36 }}>E-postanı doğrula</Text>
                <Text tone="fg2">
                    <Text weight="medium">{email}</Text> adresine gönderdiğimiz 6 haneli kodu gir. Spam klasörüne de bak.
                </Text>
            </View>

            {/* Görünmez giriş alanı + 6 kutu */}
            <Pressable onPress={() => inputRef.current?.focus()} accessibilityLabel="Doğrulama kodu">
                <TextInput
                    ref={inputRef}
                    value={code}
                    onChangeText={(text) => setCode(text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH))}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    autoFocus
                    caretHidden
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, zIndex: 10 }}
                />
                <View className="flex-row justify-between" pointerEvents="none">
                    {Array.from({ length: CODE_LENGTH }).map((_, i) => {
                        const digit = code[i];
                        const active = focused && i === Math.min(code.length, CODE_LENGTH - 1);
                        return (
                            <View
                                key={i}
                                className={`w-12 h-14 rounded-xl border items-center justify-center bg-s2 ${active ? 'border-gold-line' : digit ? 'border-line-strong' : 'border-line'}`}
                            >
                                <Text weight="semibold" style={{ fontSize: 22, lineHeight: 28, fontFamily: fonts.semibold }}>{digit || ''}</Text>
                            </View>
                        );
                    })}
                </View>
            </Pressable>

            {clipboardCode && clipboardCode !== code ? (
                <Button title={`Panodaki kodu yapıştır: ${clipboardCode}`} variant="secondary" size="md" icon={ClipboardPaste} onPress={pasteFromClipboard} block />
            ) : null}

            <Button title="Doğrula ve devam et" onPress={handleVerify} loading={loading} disabled={code.length !== CODE_LENGTH} block />

            <Text variant="small" tone="fg3" style={{ textAlign: 'center' }}>
                Kod gelmedi mi?{' '}
                {timeLeft > 0 ? (
                    <Text variant="small" tone="fg2">Tekrar gönder ({`0:${String(timeLeft).padStart(2, '0')}`})</Text>
                ) : (
                    <Text variant="small" weight="medium" tone="gold" onPress={handleResend} suppressHighlighting>Tekrar gönder</Text>
                )}
            </Text>
        </Screen>
    );
}
