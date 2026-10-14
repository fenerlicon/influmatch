import React, { useState } from 'react';
import { View, Alert, Pressable } from 'react-native';
import { MessageSquare, Send } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { Screen, StackHeader, BottomBar, Text, Button, TextField, IconBox } from '../components/ui';

// Uygulama geri bildirimi. Web ile aynı sunucu kodu (lib/feedback.ts): admin panelindeki geri bildirim listesine düşer.
export default function FeedbackScreen({ navigation }) {
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState(5);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Mesaj boş', 'Lütfen bir mesaj yazın.');
            return;
        }
        setLoading(true);
        const description = rating ? `[Mobil · ${rating}/5] ${message.trim()}` : `[Mobil] ${message.trim()}`;
        const result = await apiRequest('feedback', { method: 'POST', body: { description } });
        setLoading(false);
        if (!result.success) {
            Alert.alert('Gönderilemedi', result.error || 'Geri bildirim gönderilemedi. Lütfen tekrar deneyin.');
            return;
        }
        Alert.alert('Teşekkürler', 'Geri bildiriminiz gönderildi.');
        navigation.goBack();
    };

    return (
        <Screen
            scroll
            keyboard
            header={<StackHeader title="Geri bildirim" onBack={() => navigation.goBack()} />}
            footer={
                <BottomBar>
                    <View className="flex-1"><Button title="Gönder" icon={Send} onPress={handleSubmit} loading={loading} disabled={!message.trim()} block /></View>
                </BottomBar>
            }
        >
            <View className="flex-row items-center" style={{ gap: 12 }}>
                <IconBox icon={MessageSquare} tone="info" size={44} />
                <Text tone="fg2" style={{ flex: 1 }}>Hata bildirebilir ya da uygulamayı geliştirmemiz için öneride bulunabilirsin.</Text>
            </View>

            <TextField label="Mesajın" multiline height={150} value={message} onChangeText={setMessage} placeholder="Neyi geliştirebiliriz?" />

            <View style={{ gap: 7 }}>
                <Text variant="small" weight="medium" tone="fg2">Puanın</Text>
                <View className="flex-row" style={{ gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                        const on = rating >= star;
                        return (
                            <Pressable
                                key={star}
                                onPress={() => setRating(star)}
                                accessibilityRole="button"
                                accessibilityLabel={`${star} puan`}
                                accessibilityState={{ selected: rating === star }}
                                className={`flex-1 h-12 rounded-xl items-center justify-center border ${on ? 'bg-gold-soft border-gold-line' : 'bg-s1 border-line'}`}
                            >
                                <Text weight="semibold" tone={on ? 'gold' : 'fg3'} style={{ fontSize: 16 }}>{star}</Text>
                            </Pressable>
                        );
                    })}
                </View>
            </View>
        </Screen>
    );
}
