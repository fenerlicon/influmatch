import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, ShoppingBag, Send, MessageCircle, User, Briefcase, Search, Instagram, Music, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from './lib/supabase';

// ─── Auth Screens ─────────────────────────────────────────────────────────────
import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import RegisterRoleScreen from './screens/RegisterRoleScreen';
import RegisterFormScreen from './screens/RegisterFormScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { registerForPushNotificationsAsync, savePushTokenToDb } from './utils/notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// ─── Influencer Screens ───────────────────────────────────────────────────────
import DashboardScreen from './screens/DashboardScreen';
import DiscoverScreen from './screens/influencer/DiscoverScreen';
import ProposalsScreen from './screens/influencer/ProposalsScreen';
import MessagesScreen from './screens/influencer/MessagesScreen';
import ProfileScreen from './screens/influencer/ProfileScreen';
import SpotlightScreen from './screens/influencer/SpotlightScreen';
import BadgesScreen from './screens/influencer/BadgesScreen';
import AnalysisScreen from './screens/influencer/AnalysisScreen';
import StatisticsScreen from './screens/influencer/StatisticsScreen';
import VerificationScreen from './screens/influencer/VerificationScreen';
import MyProfileScreen from './screens/influencer/MyProfileScreen';
import InfluencerDetailScreen from './screens/influencer/InfluencerDetailScreen';

// ─── Brand Screens ────────────────────────────────────────────────────────────
import BrandDashboardScreen from './screens/brand/BrandDashboardScreen';
import BrandMessagesScreen from './screens/brand/BrandMessagesScreen';
import BrandAdvertsScreen from './screens/brand/BrandAdvertsScreen';
import BrandProfileScreen from './screens/brand/BrandProfileScreen';
import BrandVerificationScreen from './screens/brand/BrandVerificationScreen';

// ─── Shared Screens ───────────────────────────────────────────────────────────
import SettingsScreen from './screens/SettingsScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import AiAssistantScreen from './screens/AiAssistantScreen';

// ─── Navigation Ref ───────────────────────────────────────────────────────────
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();

// ─── Components ───────────────────────────────────────────────────────────────
import FeedbackBanner from './components/FeedbackBanner';

// ─── Theme ────────────────────────────────────────────────────────────────────
const MyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B0F19',
    card: '#0F1014',
    text: '#ffffff',
    border: 'rgba(255,255,255,0.05)',
  },
};

// ─── Tab bar shared options ───────────────────────────────────────────────────
const TAB_BAR_STYLE = {
  headerShown: false,
  tabBarShowLabel: false, // Image doesn't show labels
  tabBarStyle: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    height: 70,
    position: 'absolute',
    bottom: 25, 
    left: 20, 
    right: 20,
    elevation: 0,
    borderRadius: 30,
    overflow: 'hidden',
  },
  tabBarBackground: () => (
    <View style={{ 
      flex: 1, 
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 30,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.1)',
    }}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.02)']}
        style={{ position: 'absolute', inset: 0, borderRadius: 30 }}
      />
    </View>
  ),
  tabBarActiveTintColor: '#fbbf24',
  tabBarInactiveTintColor: '#64748b',
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ─── Influencer Tab Navigator ─────────────────────────────────────────────────
function InfluencerTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_BAR_STYLE}>
      <Tab.Screen
        name="Ana Sayfa"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Vitrin"
        component={DiscoverScreen}
        options={{ tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }}
      />
      <Tab.Screen
        name="İlanlar"
        component={ProposalsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Send color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Mesajlar"
        component={MessagesScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Brand Tab Navigator ──────────────────────────────────────────────────────
function BrandTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_BAR_STYLE}>
      <Tab.Screen
        name="Ana Sayfa"
        component={BrandDashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Keşfet"
        component={DiscoverScreen}
        options={{ tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tab.Screen
        name="BrandAdverts"
        component={BrandAdvertsScreen}
        options={{
          tabBarLabel: 'İlanlarım',
          tabBarIcon: ({ color, size }) => <Briefcase color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Mesajlar"
        component={BrandMessagesScreen}
        options={{ tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profil"
        component={BrandProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');
  const [session, setSession] = useState(null);

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

  const handlePushRegistration = async (userId) => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await savePushTokenToDb(userId, token);
    }
  };

  async function checkUserSession(session) {
    if (!session?.user) {
      setInitialRoute('Login');
      setLoading(false);
      return;
    }

    try {
      // Fetch user role to determine correct tab navigator
      const { data: userData, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) throw error;

      if (userData?.role === 'brand') {
        setInitialRoute('BrandDashboard');
      } else {
        setInitialRoute('Dashboard');
      }
    } catch (e) {
      console.warn('Session check error:', e);
      setInitialRoute('Login');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0F19', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0B0F19' }}>
      <FeedbackBanner navigation={navigationRef} />
      <NavigationContainer theme={MyDarkTheme} ref={navigationRef}>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#0B0F19' },
            animation: 'fade',
          }}
        >
          {/* ── Auth Flow ── */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
          <Stack.Screen name="RegisterForm" component={RegisterFormScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />

          {/* ── Influencer Main ── */}
          <Stack.Screen name="Dashboard" component={InfluencerTabs} />

          {/* ── Brand Main ── */}
          <Stack.Screen name="BrandDashboard" component={BrandTabs} />

          {/* ── Influencer Sub-screens ── */}
          <Stack.Screen name="Spotlight" component={SpotlightScreen} />
          <Stack.Screen name="Badges" component={BadgesScreen} />
          <Stack.Screen name="Analysis" component={AnalysisScreen} />
          <Stack.Screen name="Verification" component={VerificationScreen} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
          <Stack.Screen name="MyProfile" component={MyProfileScreen} />
          <Stack.Screen name="InfluencerDetail" component={InfluencerDetailScreen} />

          {/* ── Shared Sub-screens ── */}
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />

          {/* ── Brand Sub-screens ── */}
          <Stack.Screen name="BrandVerification" component={BrandVerificationScreen} />

        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
