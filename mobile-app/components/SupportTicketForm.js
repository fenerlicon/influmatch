import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Send } from 'lucide-react-native';
import { apiRequest } from '../lib/api';

// Web'deki destek formuyla aynı alanlar (konu ve öncelik listeleri lib/support.ts ile aynı);
// talep web'in sunucu kodu üzerinden açılır: /api/mobile/support
const SUBJECTS = ['Ödeme Sorunu', 'Teknik Hata', 'Şikayet/Bildirim', 'Öneri'];
const PRIORITIES = ['Düşük', 'Orta', 'Acil'];

const Chips = ({ options, value, onChange }) => (
    <View className="flex-row flex-wrap mb-3">
        {options.map((opt) => {
            const selected = value === opt;
            return (
                <TouchableOpacity key={opt} onPress={() => onChange(opt)}
                    className={`mr-2 mb-2 px-3 py-2 rounded-full border ${selected ? 'bg-soft-gold border-soft-gold' : 'bg-white/5 border-white/10'}`}>
                    <Text className={`text-xs ${selected ? 'text-[#0B0F19] font-bold' : 'text-gray-400'}`}>{opt}</Text>
                </TouchableOpacity>
            );
        })}
    </View>
);

export default function SupportTicketForm({ onSent }) {
    const [subject, setSubject] = useState('');
    const [priority, setPriority] = useState('Orta');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const send = async () => {
        if (sending) return;
        setSending(true);
        const result = await apiRequest('support', { method: 'POST', body: { subject, priority, message } });
        setSending(false);
        if (!result.success) return Alert.alert('Hata', result.error || 'Destek talebi oluşturulamadı. Lütfen tekrar deneyin.');
        Alert.alert('Gönderildi', `Destek talebiniz oluşturuldu${result.ticketCode ? ` (#${result.ticketCode})` : ''}.`);
        setSubject(''); setPriority('Orta'); setMessage('');
        onSent?.();
    };

    return (
        <View className="mx-4 mb-4 mt-1 p-4 rounded-2xl border border-white/[0.07] bg-black/20">
            <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">KONU *</Text>
            <Chips options={SUBJECTS} value={subject} onChange={setSubject} />
            <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">ÖNCELİK *</Text>
            <Chips options={PRIORITIES} value={priority} onChange={setPriority} />
            <Text className="text-gray-500 text-[10px] font-bold tracking-widest mb-2">MESAJ * (EN AZ 10 KARAKTER)</Text>
            <View className="bg-black/30 rounded-xl border border-white/10 p-4 min-h-[90px] mb-4">
                <TextInput className="text-white text-sm leading-5" value={message} onChangeText={setMessage}
                    placeholder="Detaylı bir şekilde açıklayın..." placeholderTextColor="#4b5563" multiline textAlignVertical="top" />
            </View>
            <TouchableOpacity onPress={send} disabled={sending}
                className="bg-soft-gold h-11 rounded-xl items-center justify-center">
                {sending ? <ActivityIndicator color="black" size="small" /> : (
                    <View className="flex-row items-center gap-2">
                        <Send color="black" size={15} />
                        <Text className="text-midnight font-bold text-sm">Talebi Gönder</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}
