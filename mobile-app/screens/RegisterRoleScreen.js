import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterRoleScreen({ navigation }) {
    const [selectedRole, setSelectedRole] = useState('influencer'); // Varsayılan seçim

    const handleContinue = () => {
        navigation.navigate('RegisterForm', { role: selectedRole });
    };

    const RenderCard = ({ role, title, description, features }) => {
        const isSelected = selectedRole === role;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSelectedRole(role)}
                className={`rounded-3xl p-6 mb-4 border transition-all ${isSelected ? 'border-soft-gold bg-white/5' : 'border-white/10 bg-transparent'}`}
            >
                <View className="flex-row justify-between items-start mb-2">
                    <View>
                        <Text className="text-soft-gold/80 text-[10px] font-bold tracking-[4px] uppercase mb-2">HESAP TÜRÜ</Text>
                        <Text className="text-white text-3xl font-bold">{title}</Text>
                    </View>

                    {/* Seçim Yuvarlağı */}
                    <View className={`w-8 h-8 rounded-full items-center justify-center border ${isSelected ? 'bg-soft-gold border-soft-gold' : 'border-white/20'}`}>
                        {isSelected && <Check size={16} color="black" strokeWidth={3} />}
                    </View>
                </View>

                <Text className="text-gray-400 text-sm leading-5 mt-2 mb-6">
                    {description}
                </Text>

                {/* Özellik Listesi */}
                <View className="space-y-3">
                    {features.map((feature, index) => (
                        <View key={index} className="flex-row items-center space-x-3">
                            <View className="w-1.5 h-1.5 rounded-full bg-soft-gold" />
                            <Text className="text-gray-300 text-sm font-medium">{feature}</Text>
                        </View>
                    ))}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View className="flex-1 bg-midnight">
            <StatusBar style="light" />

            {/* Arka Plan Işığı */}
            <View className="absolute top-0 w-full h-96 opacity-30">
                <LinearGradient
                    colors={['#D4AF37', 'transparent']}
                    style={{ flex: 1 }}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                />
            </View>

            <SafeAreaView className="flex-1">
                <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 100, paddingTop: 20 }} showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View className="items-center mb-10">
                        <Text className="text-soft-gold text-xs font-bold tracking-[4px] uppercase mb-4">BAŞLANGIÇ</Text>
                        <Text className="text-white text-4xl font-bold text-center mb-4">Rolünüzü Seçin</Text>
                        <Text className="text-gray-400 text-center text-sm px-4 leading-6">
                            Influmatch'e nasıl katılmak istersiniz? Size en uygun deneyimi sunabilmemiz için lütfen seçiminizi yapın.
                        </Text>
                    </View>

                    {/* Kartlar */}
                    <RenderCard
                        role="influencer"
                        title="Influencer"
                        description="Markalarla işbirliği yapın, gelirinizi artırın ve kariyerinizi yönetin."
                        features={[
                            "Spotlight ile öne çıkın",
                            "Marka tekliflerini değerlendirin",
                            "Profesyonel profil yönetimi"
                        ]}
                    />

                    <RenderCard
                        role="brand"
                        title="Marka"
                        description="En uygun influencerları bulun, kampanyalar oluşturun ve yönetin."
                        features={[
                            "Influencerları keşfedin",
                            "Kampanya akışını yönetin",
                            "Proje bazlı anlaşmalar"
                        ]}
                    />

                    {/* Alt Kısım */}
                    <View className="mt-8 items-center">
                        <Text className="text-gray-300 text-sm mb-6">
                            Seçilen Rol: <Text className="font-bold text-white">{selectedRole === 'brand' ? 'Marka' : 'Influencer'}</Text>
                        </Text>

                        <TouchableOpacity
                            onPress={handleContinue}
                            className="w-full bg-soft-gold h-14 rounded-full items-center justify-center active:opacity-90 shadow-lg shadow-soft-gold/20"
                        >
                            <Text className="text-[#0B0F19] font-bold text-base">Devam Et</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </View>
    );
}
