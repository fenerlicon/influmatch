import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Helper to safely get Notifications module only when needed
const getNotifications = () => {
    if (isExpoGo && Platform.OS === 'android') return null;
    try {
        return require('expo-notifications');
    } catch (e) {
        return null;
    }
};

// Configure how notifications are handled when the app is open
const Notifications = getNotifications();
if (Notifications) {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

export async function registerForPushNotificationsAsync() {
    const SafeNotifications = getNotifications();
    if (!SafeNotifications) {
        console.log('Skipping push notification registration: Environment not supported or not a physical device.');
        return null;
    }

    try {
        let token;

        if (Platform.OS === 'android') {
            await SafeNotifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: SafeNotifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await SafeNotifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await SafeNotifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                console.log('Failed to get permissions for push notification!');
                return null;
            }

            // Get the token
            token = (await SafeNotifications.getExpoPushTokenAsync()).data;
            console.log('Expo Push Token:', token);
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    } catch (error) {
        console.log('Error during push notification registration:', error);
        return null;
    }
}

export async function savePushTokenToDb(userId, token) {
  if (!userId || !token) return;
  
  try {
    const { error } = await supabase
      .from('users')
      .update({ push_token: token })
      .eq('id', userId);
      
    if (error) {
      console.error('Error saving push token:', error);
    } else {
      console.log('Push token saved to DB successfully');
    }
  } catch (err) {
    console.error('Unexpected error saving push token:', err);
  }
}
