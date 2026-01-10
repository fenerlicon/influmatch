import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Star, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function SpotlightScreen({ navigation }) {
    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="px-6 py-4 flex-row items-center space-x-4 border-b border-white/5">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-white/10">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <Text className="text-white text-xl font-bold">Spotlight Paketleri</Text>
                </View>

                <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>

                    <View className="mb-8 items-center">
                        <View className="w-16 h-16 bg-soft-gold/20 rounded-full items-center justify-center mb-4 border border-soft-gold/50">
                            <Star color="#D4AF37" size={32} fill="#D4AF37" />
                        </View>
                        <Text className="text-white text-2xl font-bold text-center mb-2">Öne Çıkın, Daha Fazla İş Alın</Text>
                        <Text className="text-gray-400 text-center leading-5 px-4">
                            Profilinizi markaların vitrininde en üste taşıyın ve görünürlüğünüzü %300 artırın.
                        </Text>
                    </View>

                    {/* Pro Package */}
                    <LinearGradient
                        colors={['#1c1c2e', '#2a2a3e']}
                        className="p-6 rounded-3xl border border-soft-gold/30 relative overflow-hidden mb-6"
                    >
                        <View className="absolute top-0 right-0 bg-soft-gold px-3 py-1 rounded-bl-xl">
                            <Text className="text-midnight text-[10px] font-bold">EN POPÜLER</Text>
                        </View>

                        <Text className="text-soft-gold font-bold text-lg mb-1">PRO INFLUENCER</Text>
                        <View className="flex-row items-end mb-4">
                            <Text className="text-white text-3xl font-bold">₺499</Text>
                            <Text className="text-gray-400 text-sm mb-1 ml-1">/aylık</Text>
                        </View>

                        <View className="space-y-3 mb-6">
                            {['Vitrin sırasında en üstte yer alın', 'Rozet görünürlüğü', 'Markalara doğrudan mesaj hakkı', 'Detaylı istatistikler'].map((feature, i) => (
                                <View key={i} className="flex-row items-center space-x-3">
                                    <View className="bg-soft-gold/20 p-1 rounded-full">
                                        <Check color="#D4AF37" size={12} strokeWidth={3} />
                                    </View>
                                    <Text className="text-gray-300 text-sm">{feature}</Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity className="bg-soft-gold h-12 rounded-xl items-center justify-center">
                            <Text className="text-midnight font-bold">Hemen Başla</Text>
                        </TouchableOpacity>
                    </LinearGradient>

                    {/* Standard Package */}
                    <View className="p-6 rounded-3xl border border-white/10 bg-surface mb-10">
                        <Text className="text-white font-bold text-lg mb-1">STARTER</Text>
                        <View className="flex-row items-end mb-4">
                            <Text className="text-white text-3xl font-bold">₺199</Text>
                            <Text className="text-gray-400 text-sm mb-1 ml-1">/aylık</Text>
                        </View>

                        <View className="space-y-3 mb-6">
                            {['Arama sonuçlarında öne çıkma', 'Profil doğrulama rozeti'].map((feature, i) => (
                                <View key={i} className="flex-row items-center space-x-3">
                                    <View className="bg-white/10 p-1 rounded-full">
                                        <Check color="white" size={12} strokeWidth={3} />
                                    </View>
                                    <Text className="text-gray-300 text-sm">{feature}</Text>
                                </View>
                            ))}
                        </View>

                        <TouchableOpacity className="bg-white/10 h-12 rounded-xl items-center justify-center border border-white/5">
                            <Text className="text-white font-bold">Paketi Seç</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
