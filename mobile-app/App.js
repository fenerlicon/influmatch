import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, Send, MessageCircle, User } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';

// Screens

import LoginScreen from './screens/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import RegisterRoleScreen from './screens/RegisterRoleScreen';
import RegisterFormScreen from './screens/RegisterFormScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import OnboardingScreen from './screens/OnboardingScreen';

// Core & Influencer Screens
import DashboardScreen from './screens/DashboardScreen';
import DiscoverScreen from './screens/influencer/DiscoverScreen';
import ProposalsScreen from './screens/influencer/ProposalsScreen';
import MessagesScreen from './screens/influencer/MessagesScreen';
import ProfileScreen from './screens/influencer/ProfileScreen';
import SpotlightScreen from './screens/influencer/SpotlightScreen';
import BadgesScreen from './screens/influencer/BadgesScreen';

import AnalysisScreen from './screens/influencer/AnalysisScreen';
import SettingsScreen from './screens/SettingsScreen';

import StatisticsScreen from './screens/influencer/StatisticsScreen';
import VerificationScreen from './screens/influencer/VerificationScreen';
import FeedbackScreen from './screens/FeedbackScreen';
import MyProfileScreen from './screens/influencer/MyProfileScreen';

import AiAssistantScreen from './screens/AiAssistantScreen';


const MyDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0B0F19', // Midnight
    card: '#0F1014',
    text: '#ffffff',
    border: 'rgba(255,255,255,0.05)',
  },
};

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Navigation Ref
import { createNavigationContainerRef } from '@react-navigation/native';
export const navigationRef = createNavigationContainerRef();

// Import FeedbackBanner
import FeedbackBanner from './components/FeedbackBanner';

function InfluencerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#020617', // Darker Slate to match dashboard
          borderTopWidth: 0, // No border for glass feel
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          position: 'absolute', // Floating effect
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
        },
        tabBarBackground: () => (
          <View style={{ flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.85)' }} />
        ),
        tabBarActiveTintColor: '#D4AF37', // Gold
        tabBarInactiveTintColor: '#94a3b8', // Slate-400
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 4,
        }
      }}
    >
      <Tab.Screen
        name="Ana Sayfa"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Vitrin"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="İlanlar"
        component={ProposalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Send color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Mesajlar"
        component={MessagesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />
        }}
      />
    </ Tab.Navigator>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    checkUserSession();
  }, []);

  async function checkUserSession() {
    try {
      // Check Supabase Session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        setInitialRoute('Dashboard');
      } else {
        setInitialRoute('Login');
      }
    } catch (e) {
      console.warn('Session check error:', e);
      setInitialRoute('Login'); // Fallback
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
            animation: 'fade' // Smooth transitions
          }}
        >
          {/* Auth Flow */}

          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
          <Stack.Screen name="RegisterForm" component={RegisterFormScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />

          {/* Main App */}
          <Stack.Screen name="Dashboard" component={InfluencerTabs} />

          {/* Sub-Screens */}
          <Stack.Screen name="Spotlight" component={SpotlightScreen} />
          <Stack.Screen name="Badges" component={BadgesScreen} />
          <Stack.Screen name="Analysis" component={AnalysisScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Verification" component={VerificationScreen} />
          <Stack.Screen name="Statistics" component={StatisticsScreen} />
          <Stack.Screen name="Feedback" component={FeedbackScreen} />
          <Stack.Screen name="MyProfile" component={MyProfileScreen} />
          <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />

        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}
