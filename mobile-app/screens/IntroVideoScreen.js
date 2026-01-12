import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export default function IntroVideoScreen() {
    const video = useRef(null);
    const [status, setStatus] = useState({});
    const navigation = useNavigation();

    const handleFinish = async () => {
        try {
            await AsyncStorage.setItem('hasSeenIntro', 'true');
            // Navigate to Login (resetting stack effectively to prevent going back to video)
            navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            });
        } catch (error) {
            console.error('Error saving intro status:', error);
            navigation.replace('Login');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar hidden />
            <Video
                ref={video}
                style={styles.video}
                source={require('../assets/IFM.mp4')}
                useNativeControls={false}
                resizeMode={ResizeMode.COVER}
                isLooping={false}
                shouldPlay={true}
                onPlaybackStatusUpdate={status => {
                    setStatus(() => status);
                    if (status.didJustFinish) {
                        handleFinish();
                    }
                }}
            />

            <TouchableOpacity
                style={styles.skipButton}
                onPress={handleFinish}
            >
                <Text style={styles.skipText}>Geç</Text>
                <ArrowRight color="white" size={16} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
        alignItems: 'center',
        justifyContent: 'center',
    },
    video: {
        width: width,
        height: height,
    },
    skipButton: {
        position: 'absolute',
        bottom: 50,
        right: 30,
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    skipText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
});
