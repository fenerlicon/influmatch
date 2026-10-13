import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Send } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { Text, Button, FilterChip, Segment, TextField } from './ui';

// Web'deki destek formuyla aynı alanlar (konu ve öncelik listeleri lib/support.ts ile aynı);
// talep web'in sunucu kodu üzerinden açılır: /api/mobile/support
const SUBJECTS = ['Ödeme Sorunu', 'Teknik Hata', 'Şikayet/Bildirim', 'Öneri'];
const PRIORITIES = ['Düşük', 'Orta', 'Acil'];

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
        <View style={{ gap: 14 }}>
            <View style={{ gap: 7 }}>
                <Text variant="small" weight="medium" tone="fg2">Konu</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {SUBJECTS.map((opt) => <FilterChip key={opt} label={opt} selected={subject === opt} onPress={() => setSubject(opt)} />)}
                </View>
            </View>
            <View style={{ gap: 7 }}>
                <Text variant="small" weight="medium" tone="fg2">Öncelik</Text>
                <Segment options={PRIORITIES.map((p) => ({ key: p, label: p }))} value={priority} onChange={setPriority} />
            </View>
            <TextField label="Mesaj" multiline height={120} value={message} onChangeText={setMessage} placeholder="Ayrıntılı açıklayın (en az 10 karakter)" />
            <Button title="Talebi gönder" icon={Send} onPress={send} loading={sending} block />
        </View>
    );
}
