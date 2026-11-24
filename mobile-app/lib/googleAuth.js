// Google ile giriş (2026-11-24; web components/auth/GoogleSignInButton.tsx ile aynı akış).
// Supabase OAuth sayfası uygulama içi tarayıcıda açılır, dönüş influmatch://auth/callback (Expo Go'da exp://.../--/auth/callback).
// Yeni hesap influencer rolüyle açılır; Kullanım Koşulları onayı ve davet kodu onboarding'de alınır (web lib/oauth-signup.ts).
// Kurulum (kullanıcı adımı): Supabase → Authentication → Providers → Google açık; Redirect URLs'e influmatch://** eklenmeli.
// Açılınca GOOGLE_AUTH_ENABLED true yapılır. iOS'ta mağaza yayınında Google ile giriş varsa Apple ile giriş de istenir (App Store 4.8).
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export const GOOGLE_AUTH_ENABLED = false;

const INTENT_KEY = 'influmatch_oauth_signup';

/** Kayıt ekranında seçilen hesap türü ve davet kodu (onboarding ön doldurur). */
export async function saveGoogleSignupIntent(intent) {
    try {
        await AsyncStorage.setItem(INTENT_KEY, JSON.stringify({ ...intent, at: Date.now() }));
    } catch (e) {}
}

export async function readGoogleSignupIntent() {
    try {
        const raw = await AsyncStorage.getItem(INTENT_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed?.at || Date.now() - parsed.at > 60 * 60 * 1000) return null;
        return {
            creatorType: parsed.creatorType === 'ugc' || parsed.creatorType === 'influencer' ? parsed.creatorType : undefined,
            inviteCode: typeof parsed.inviteCode === 'string' && /^[A-Z0-9]{6,12}$/.test(parsed.inviteCode) ? parsed.inviteCode : undefined,
        };
    } catch (e) {
        return null;
    }
}

export function clearGoogleSignupIntent() {
    AsyncStorage.removeItem(INTENT_KEY).catch(() => null);
}

function paramsFrom(url) {
    const out = {};
    const parts = [url.split('#')[1], (url.split('?')[1] || '').split('#')[0]].filter(Boolean);
    for (const part of parts) {
        for (const pair of part.split('&')) {
            const [k, v] = pair.split('=');
            if (k) out[decodeURIComponent(k)] = decodeURIComponent(v || '');
        }
    }
    return out;
}

/**
 * Google ile oturum açar. Sonuç: { user } | { cancelled: true } | { error }.
 */
export async function signInWithGoogle() {
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
    });
    if (error || !data?.url) return { error: 'Google ile giriş başlatılamadı.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) return { cancelled: true };

    const params = paramsFrom(result.url);
    if (params.error) return { error: 'Google ile giriş tamamlanamadı.' };
    if (params.code) {
        const { data: exchanged, error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError || !exchanged?.user) return { error: 'Google ile giriş tamamlanamadı.' };
        return { user: exchanged.user };
    }
    if (params.access_token && params.refresh_token) {
        const { data: session, error: sessionError } = await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
        });
        if (sessionError || !session?.user) return { error: 'Google ile giriş tamamlanamadı.' };
        return { user: session.user };
    }
    return { error: 'Google ile giriş tamamlanamadı.' };
}
