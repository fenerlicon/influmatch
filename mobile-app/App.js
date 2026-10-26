import './global.css';
import './lib/nativewind-interop';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { House, Briefcase, Megaphone, MessageCircle, UserRound, Search } from 'lucide-react-native';
import { useFonts, Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { supabase } from './lib/supabase';
import { TabBar, colors } from './components/ui';

// ─── Auth Screens ─────────────────────────────────────────────────────────────
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import RegisterRoleScreen from './screens/RegisterRoleScreen';
import RegisterFormScreen from './screens/RegisterFormScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import TasksScreen from './screens/TasksScreen';
import AccountRejectedScreen from './screens/AccountRejectedScreen';
import { registerForPushNotificationsAsync, savePushToken, listenForNotificationTaps, routeForLink } from './utils/notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── Influencer Screens ───────────────────────────────────────────────────────
import DashboardScreen from './screens/DashboardScreen';
import DiscoverScreen from './screens/influencer/DiscoverScreen';
import ProposalsScreen from './screens/influencer/ProposalsScreen';
import ProfileScreen from './screens/influencer/ProfileScreen';
import SpotlightScreen from './screens/influencer/SpotlightScreen';
import BadgesScreen from './screens/influencer/BadgesScreen';
import StatisticsScreen from './screens/influencer/StatisticsScreen';
import VerificationScreen from './screens/influencer/VerificationScreen';
import MyProfileScreen from './screens/influencer/MyProfileScreen';
import InfluencerDetailScreen from './screens/influencer/InfluencerDetailScreen';

// ─── Brand Screens ────────────────────────────────────────────────────────────
import BrandDashboardScreen from './screens/brand/BrandDashboardScreen';
import BrandAdvertsScreen from './screens/brand/BrandAdvertsScreen';
import BrandProfileScreen from './screens/brand/BrandProfileScreen';
import BrandVerificationScreen from './screens/brand/BrandVerificationScreen';
import CampaignsScreen from './screens/brand/CampaignsScreen';
import CampaignDetailScreen from './screens/brand/CampaignDetailScreen';
import SocialVerifyGateScreen from './screens/influencer/SocialVerifyGateScreen';
import { resolveHomeRoute } from './lib/routing';

// ─── Shared Screens ───────────────────────────────────────────────────────────
import MessagesScreen from './screens/MessagesScreen';
import JobsScreen from './screens/JobsScreen';
import CollaborationDetailScreen from './screens/CollaborationDetailScreen';
import SettingsScreen from './screens/SettingsScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import NotificationsScreen from './screens/NotificationsScreen';

// ─── Navigation Ref ───────────────────────────────────────────────────────────
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();

// ─── Components ───────────────────────────────────────────────────────────────
import FeedbackBanner from './components/FeedbackBanner';

// Geliştirme: simülatörde ?screen=EkranAdı oturumdan bağımsız o ekranı açar (görünüm kontrolü için; veriler yine oturuma bağlı).
const DEV_SCREEN = __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('screen')
  : null;

// MVP bandının gösterilmediği giriş/kayıt/doğrulama ekranları
const AUTH_ROUTES = new Set(['Login', 'ForgotPassword', 'RegisterRole', 'RegisterForm', 'VerifyEmail', 'Onboarding', 'SocialVerifyGate', 'BrandVerification', 'Rejected']);

// ─── Tema (components/ui/theme.js) ────────────────────────────────────────────
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.bg,
    text: colors.fg,
    border: colors.line,
    notification: colors.gold,
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Sekme çubuğu components/ui/TabBar.js; her sekme options.tabIcon + title verir.
const TAB_OPTIONS = { headerShown: false };
const renderTabBar = (props) => <TabBar {...props} />;

// ─── Influencer sekmeleri: Ana Sayfa · İşler · İlanlar · Mesajlar · Profil ────
// Rota adları ekranlar ve bildirim yönlendirmesi (utils/notifications.js) tarafından kullanılır; değiştirirken ikisini de güncelle.
function InfluencerTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_OPTIONS} tabBar={renderTabBar}>
      <Tab.Screen name="Ana Sayfa" component={DashboardScreen} options={{ tabIcon: House }} />
      <Tab.Screen name="İşler" component={JobsScreen} options={{ tabIcon: Briefcase }} />
      <Tab.Screen name="İlanlar" component={ProposalsScreen} options={{ tabIcon: Megaphone }} />
      <Tab.Screen name="Mesajlar" component={MessagesScreen} options={{ tabIcon: MessageCircle }} />
      <Tab.Screen name="Profil" component={ProfileScreen} options={{ tabIcon: UserRound }} />
    </Tab.Navigator>
  );
}

// ─── Marka sekmeleri: Ana Sayfa · Keşfet · İlanlar · İşler · Mesajlar ─────────
// Marka profili ve ayarlar sekme değil; üst sağdaki avatardan "BrandProfile" açılır.
function BrandTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_OPTIONS} tabBar={renderTabBar}>
      <Tab.Screen name="Ana Sayfa" component={BrandDashboardScreen} options={{ tabIcon: House }} />
      <Tab.Screen name="Keşfet" component={DiscoverScreen} options={{ tabIcon: Search }} />
      <Tab.Screen name="BrandAdverts" component={BrandAdvertsScreen} options={{ title: 'İlanlar', tabIcon: Megaphone }} />
      <Tab.Screen name="İşler" component={JobsScreen} options={{ tabIcon: Briefcase }} />
      <Tab.Screen name="Mesajlar" component={MessagesScreen} options={{ tabIcon: MessageCircle }} />
    </Tab.Navigator>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [session, setSession] = useState(null);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold,
    InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        handlePushRegistration(session.user.id);
        checkUserSession(session);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        handlePushRegistration(session.user.id);
        checkUserSession(session);
      } else {
        setInitialRoute('Login');
        setLoading(false);
      }
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // Bildirime dokununca ilgili ekranı aç (mesaj → sohbet, teklif → Teklifler ...).
  useEffect(() => {
    if (loading || !session?.user) return;
    const openLink = async (link) => {
      const { data } = await supabase.from('users').select('role, verification_status').eq('id', session.user.id).maybeSingle();
      // Reddedilmiş hesap yalnızca ret / itiraz ekranında kalır.
      if (data?.verification_status === 'rejected') return;
      const target = routeForLink(link, data?.role);
      if (!target) return;
      const go = () => navigationRef.navigate(target.name, target.params);
      if (navigationRef.isReady()) go();
      else setTimeout(() => navigationRef.isReady() && go(), 500);
    };
    return listenForNotificationTaps(openLink);
  }, [loading, session?.user?.id]);

  const handlePushRegistration = async (userId) => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await savePushToken(token);
    }
  };

  async function checkUserSession(session) {
    if (!session?.user) {
      setInitialRoute('Login');
      setLoading(false);
      return;
    }

    try {
      // Web ile aynı yönlendirme kuralları (lib/routing.js): reddedilmiş hesap, eksik profil, zorunlu sosyal doğrulama.
      const route = await resolveHomeRoute(session.user.id);
      // Reddedilmiş hesap: ret nedeni + itiraz ekranı (2026-10-26; web RejectedScreen ile aynı). Başka ekrana geçilemez.
      setInitialRoute(route);
    } catch (e) {
      console.warn('Session check error:', e);
      setInitialRoute('Login');
    } finally {
      setLoading(false);
    }
  }

  // Yazı tipi yüklenemezse (ağ yok vb.) sistem yazı tipiyle devam edilir.
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  // Geliştirme: simülatörde ?ui=1 bileşen vitrinini açar
  if (__DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' && window.location.search.includes('ui=1')) {
    const UIGalleryScreen = require('./screens/dev/UIGalleryScreen').default;
    return <SafeAreaProvider><UIGalleryScreen /></SafeAreaProvider>;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <FeedbackBanner navigation={navigationRef} hidden={AUTH_ROUTES.has(currentRoute ?? initialRoute)} />
      <NavigationContainer
        theme={AppTheme}
        ref={navigationRef}
        onReady={() => setCurrentRoute(navigationRef.getCurrentRoute()?.name)}
        onStateChange={() => setCurrentRoute(navigationRef.getCurrentRoute()?.name)}
      >
        <Stack.Navigator
          initialRouteName={DEV_SCREEN || initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg },
            animation: 'slide_from_right',
          }}
        >
          {/* ── Auth Flow ── */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
          <Stack.Screen name="RegisterForm" component={RegisterFormScreen} initialParams={DEV_SCREEN ? { role: 'influencer' } : undefined} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} initialParams={DEV_SCREEN ? { email: 'ornek@mail.com' } : undefined} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="SocialVerifyGate" component={SocialVerifyGateScreen} options={{ gestureEnabled: false }} />
          <Stack.Screen name="Rejected" component={AccountRejectedScreen} options={{ gestureEnabled: false }} />

          {/* ── Influencer Main ── */}
          <Stack.Screen name="Dashboard" component={InfluencerTabs} />

          {/* ── Brand Main ── */}
          <Stack.Screen name="BrandDashboard" component={BrandTabs} />

          {/* ── Influencer Sub-screens ── */}
          <Stack.Screen name="Spotlight" component={SpotlightScreen} />
          <Stack.Screen name="Badges" component={BadgesScreen} />
          <Stack.Screen name="Verification" component={VerificationScreen} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
          <Stack.Screen name="MyProfile" component={MyProfileScreen} />
          <Stack.Screen name="InfluencerDetail" component={InfluencerDetailScreen} />
          {/* Influencer vitrini artık sekme değil; profilden açılır */}
          <Stack.Screen name="Vitrin" component={DiscoverScreen} />

          {/* ── Shared Sub-screens ── */}
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="CollaborationDetail" component={CollaborationDetailScreen} />
          {/* Görevler (2026-10-18) */}
          <Stack.Screen name="Tasks" component={TasksScreen} />

          {/* ── Brand Sub-screens ── */}
          <Stack.Screen name="BrandVerification" component={BrandVerificationScreen} />
          <Stack.Screen name="BrandProfile" component={BrandProfileScreen} />
          {/* Kampanyalar (3.19) */}
          <Stack.Screen name="Campaigns" component={CampaignsScreen} />
          <Stack.Screen name="CampaignDetail" component={CampaignDetailScreen} />

        </Stack.Navigator>
      </NavigationContainer>
    </View>
    </SafeAreaProvider>
  );
}
