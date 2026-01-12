import React, { useState, useEffect } from 'react';
import { View, Platform, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, ShoppingBag, Send, MessageCircle, User } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth Screens
import LoginScreen from './screens/LoginScreen';
import RegisterRoleScreen from './screens/RegisterRoleScreen';
import RegisterFormScreen from './screens/RegisterFormScreen';
import VerifyEmailScreen from './screens/VerifyEmailScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import IntroVideoScreen from './screens/IntroVideoScreen';

// Influencer Screens
import DashboardScreen from './screens/DashboardScreen'; // Home Tab
import DiscoverScreen from './screens/influencer/DiscoverScreen';
import ProposalsScreen from './screens/influencer/ProposalsScreen';
import MessagesScreen from './screens/influencer/MessagesScreen';
import ProfileScreen from './screens/influencer/ProfileScreen';
import SpotlightScreen from './screens/influencer/SpotlightScreen';
import BadgesScreen from './screens/influencer/BadgesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function InfluencerTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F1014', // Midnight Background
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.05)',
          height: Platform.OS === 'ios' ? 90 : 70,
          paddingTop: 10,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarActiveTintColor: '#D4AF37', // Gold
        tabBarInactiveTintColor: '#6B7280', // Gray
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
          tabBarIcon: ({ color, size }) => <Home color={color} size={24} />
        }}
      />
      <Tab.Screen
        name="Vitrin"
        component={DiscoverScreen}
        options={{
          tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={24} />
        }}
      />
      <Tab.Screen
        name="Teklifler"
        component={ProposalsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Send color={color} size={24} />
        }}
      />
      <Tab.Screen
        name="Mesajlar"
        component={MessagesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={24} />
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <User color={color} size={24} />
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkIntroStatus();
  }, []);

  const checkIntroStatus = async () => {
    try {
      const hasSeenIntro = await AsyncStorage.getItem('hasSeenIntro');
      if (hasSeenIntro === 'true') {
        setInitialRoute('Login');
      } else {
        setInitialRoute('IntroVideo');
      }
    } catch (error) {
      console.error('Error checking intro status:', error);
      setInitialRoute('Login'); // Fallback
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'black', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'black' }
        }}
      >
        <Stack.Screen name="IntroVideo" component={IntroVideoScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="RegisterRole" component={RegisterRoleScreen} />
        <Stack.Screen name="RegisterForm" component={RegisterFormScreen} />
        <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />

        {/* Main Application Logic */}
        <Stack.Screen name="Dashboard" component={InfluencerTabs} />

        {/* Sub-Screens (Not in Tab Bar) */}
        <Stack.Screen name="Spotlight" component={SpotlightScreen} />
        <Stack.Screen name="Badges" component={BadgesScreen} />

      </Stack.Navigator>
    </NavigationContainer>
  );
}
