import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ShieldCheck, Upload, CheckCircle2, Clock } from 'lucide-react-native';

export default function VerificationScreen({ navigation }) {
    const [step, setStep] = useState(1);
    const [idFront, setIdFront] = useState(null);
    const [idBack, setIdBack] = useState(null);

    // Mock upload function
    const handleUpload = (side) => {
        Alert.alert("Fotoğraf Yükle", "Galeriden veya kameradan yükleme yapılacak.", [
            { text: "Galeri", onPress: () => side === 'front' ? setIdFront('uploaded') : setIdBack('uploaded') },
            { text: "Kamera", onPress: () => side === 'front' ? setIdFront('uploaded') : setIdBack('uploaded') },
            { text: "İptal", style: "cancel" }
        ]);
    };

    const handleSubmit = () => {
        Alert.alert("Başarılı", "Belgeleriniz incelenmek üzere gönderildi. 24-48 saat içinde sonuçlanacaktır.");
        navigation.goBack();
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />

            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 py-4 flex-row items-center">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center mr-4">
                        <ChevronLeft color="white" size={24} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Hesap Doğrulama</Text>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                    {/* Status Card */}
                    <View className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-5 mb-8 flex-row items-start">
                        <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mr-4">
                            <ShieldCheck color="#60a5fa" size={24} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-blue-400 font-bold text-lg mb-1">Hesabınız Onaylanmamış</Text>
                            <Text className="text-gray-400 text-xs leading-5">Mavi tik rozeti almak ve güvenilirliğinizi artırmak için kimliğinizi doğrulayın.</Text>
                        </View>
                    </View>

                    {/* Steps */}
                    <View className="mb-8">
                        <Text className="text-white font-bold text-lg mb-4">Kimlik Yükleme</Text>

                        <Text className="text-gray-400 text-sm mb-2">Kimlik Ön Yüzü</Text>
                        <TouchableOpacity
                            onPress={() => handleUpload('front')}
                            className={`w-full h-40 border-2 border-dashed rounded-2xl items-center justify-center mb-6 ${idFront ? 'border-green-500 bg-green-500/10' : 'border-white/20 bg-white/5'}`}
                        >
                            {idFront ? (
                                <View className="items-center">
                                    <CheckCircle2 color="#4ade80" size={32} className="mb-2" />
                                    <Text className="text-green-400 font-bold">Yüklendi</Text>
                                </View>
                            ) : (
                                <View className="items-center">
                                    <Upload color="#9ca3af" size={32} className="mb-2" />
                                    <Text className="text-gray-400">Yüklemek için dokun</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text className="text-gray-400 text-sm mb-2">Kimlik Arka Yüzü</Text>
                        <TouchableOpacity
                            onPress={() => handleUpload('back')}
                            className={`w-full h-40 border-2 border-dashed rounded-2xl items-center justify-center mb-6 ${idBack ? 'border-green-500 bg-green-500/10' : 'border-white/20 bg-white/5'}`}
                        >
                            {idBack ? (
                                <View className="items-center">
                                    <CheckCircle2 color="#4ade80" size={32} className="mb-2" />
                                    <Text className="text-green-400 font-bold">Yüklendi</Text>
                                </View>
                            ) : (
                                <View className="items-center">
                                    <Upload color="#9ca3af" size={32} className="mb-2" />
                                    <Text className="text-gray-400">Yüklemek için dokun</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!idFront || !idBack}
                        className={`w-full h-14 rounded-xl items-center justify-center ${idFront && idBack ? 'bg-soft-gold shadow-lg shadow-soft-gold/20' : 'bg-white/10 opacity-50'}`}
                    >
                        <Text className={`font-bold text-base ${idFront && idBack ? 'text-black' : 'text-gray-500'}`}>Gönder</Text>
                    </TouchableOpacity>

                    <View className="flex-row items-center justify-center mt-6 mb-10">
                        <Clock size={14} color="#6b7280" className="mr-2" />
                        <Text className="text-gray-500 text-xs">Onay süreci ortalama 24 saattir.</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
