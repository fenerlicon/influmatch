import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, ActivityIndicator, Alert, RefreshControl, TextInput, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Handshake, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../lib/api';

// İş Birlikleri: kabul edilen teklifler ve ilan başvuruları. Web'deki /dashboard/collaborations ile aynı akış;
// tüm işlemler /api/mobile/collaborations üzerinden web'in sunucu kodundan geçer (lib/collaborations.ts).

const STATUS = {
    agreed: { label: 'Anlaşıldı', color: '#38bdf8' },
    in_progress: { label: 'İçerik hazırlanıyor', color: '#fbbf24' },
    published: { label: 'Yayında, onay bekliyor', color: '#c084fc' },
    completed: { label: 'Tamamlandı', color: '#34d399' },
    cancelled: { label: 'İptal edildi', color: '#f87171' },
};

const FILTERS = [
    { value: 'active', label: 'Süren' },
    { value: 'all', label: 'Tümü' },
    { value: 'completed', label: 'Tamamlanan' },
    { value: 'cancelled', label: 'İptal' },
];

const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

const StatusChip = ({ status }) => {
    const s = STATUS[status] || STATUS.agreed;
    return (
        <View className="px-2.5 py-1 rounded-full border" style={{ borderColor: `${s.color}66`, backgroundColor: `${s.color}1A` }}>
            <Text style={{ color: s.color }} className="text-[11px] font-semibold">{s.label}</Text>
        </View>
    );
};

const Avatar = ({ person, size = 44 }) => (
    <View style={{ width: size, height: size }} className="rounded-2xl bg-[#15171e] border border-white/10 overflow-hidden items-center justify-center">
        {person?.avatar_url
            ? <Image source={{ uri: person.avatar_url }} style={{ width: size, height: size }} resizeMode="cover" />
            : <Text className="text-white font-bold">{(person?.full_name || person?.username || '?').charAt(0).toUpperCase()}</Text>}
    </View>
);

const ActionButton = ({ label, color, onPress, disabled }) => (
    <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        className="px-4 py-2.5 rounded-xl border mr-2 mb-2"
        style={{ borderColor: `${color}66`, backgroundColor: `${color}1A`, opacity: disabled ? 0.5 : 1 }}
    >
        <Text style={{ color }} className="text-xs font-semibold">{label}</Text>
    </TouchableOpacity>
);

export default function CollaborationsScreen({ navigation }) {
    const [role, setRole] = useState(null);
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState('active');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [busyId, setBusyId] = useState(null);
    const [form, setForm] = useState(null); // { item, kind: 'publish' | 'cancel' }
    const [formText, setFormText] = useState('');

    const load = useCallback(async () => {
        const result = await apiRequest('collaborations');
        if (result.error) {
            Alert.alert('İş birlikleri yüklenemedi', result.error);
        } else {
            setRole(result.role);
            setItems(result.collaborations || []);
        }
        setLoading(false);
        setRefreshing(false);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const openChat = (item, roomId) => {
        const root = role === 'brand' ? 'BrandDashboard' : 'Dashboard';
        navigation.navigate(root, {
            screen: 'Mesajlar',
            params: { openRoomId: roomId, partnerName: item.other?.full_name || item.other?.username, partnerAvatar: item.other?.avatar_url },
        });
    };

    const run = async (item, action, extra = {}) => {
        setBusyId(item.id);
        const result = await apiRequest('collaborations', { method: 'POST', body: { id: item.id, action, ...extra } });
        setBusyId(null);
        if (result.error) {
            Alert.alert('İşlem yapılamadı', result.error);
            return;
        }
        setForm(null);
        setFormText('');
        if (action === 'open_room' && result.roomId) {
            openChat(item, result.roomId);
            return;
        }
        await load();
    };

    const visible = items.filter((c) =>
        filter === 'all' ? true : filter === 'active' ? ['agreed', 'in_progress', 'published'].includes(c.status) : c.status === filter,
    );

    if (loading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <StatusBar style="light" />
                <ActivityIndicator color="#D4AF37" size="large" />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-[#020617]">
            <StatusBar style="light" />
            <LinearGradient colors={['#1e1b4b', '#020617', '#020617']} className="absolute inset-0" />
            <SafeAreaView className="flex-1" edges={['top']}>
                <View className="px-6 pt-4 pb-2 flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-white/5 rounded-xl items-center justify-center border border-white/10">
                        <ArrowLeft color="white" size={20} />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-soft-gold text-xs font-bold uppercase tracking-widest">İŞ BİRLİKLERİ</Text>
                        <Text className="text-white text-2xl font-bold tracking-tight">Anlaştığınız işler</Text>
                    </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 py-2 flex-grow-0">
                    {FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f.value}
                            onPress={() => setFilter(f.value)}
                            className={`px-4 py-1.5 rounded-full border mr-2 ${filter === f.value ? 'border-soft-gold bg-soft-gold/10' : 'border-white/10'}`}
                        >
                            <Text className={`text-xs font-semibold ${filter === f.value ? 'text-soft-gold' : 'text-gray-400'}`}>{f.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {visible.length === 0 ? (
                    <View className="flex-1 items-center justify-center px-8">
                        <View className="w-16 h-16 bg-white/5 rounded-full items-center justify-center mb-4 border border-white/10">
                            <Handshake color="#4b5563" size={28} />
                        </View>
                        <Text className="text-gray-400 text-sm text-center leading-5">
                            {items.length === 0
                                ? 'Henüz iş birliğiniz yok. Bir teklif veya ilan başvurusu kabul edildiğinde burada görünür.'
                                : 'Bu filtrede iş birliği yok.'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        className="flex-1 px-6 pt-2"
                        contentContainerStyle={{ paddingBottom: 60 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#D4AF37" />}
                    >
                        {visible.map((item) => {
                            const busy = busyId === item.id;
                            const name = item.other?.full_name || (item.other?.username ? `@${item.other.username}` : 'Kullanıcı');
                            return (
                                <View key={item.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4 mb-3">
                                    <View className="flex-row items-center gap-3">
                                        <Avatar person={item.other} />
                                        <View className="flex-1">
                                            <Text className="text-white font-bold text-sm" numberOfLines={1}>{item.title}</Text>
                                            <Text className="text-gray-500 text-xs" numberOfLines={1}>
                                                {name} · {item.source === 'offer' ? 'Teklif' : 'İlan başvurusu'}
                                            </Text>
                                        </View>
                                        <StatusChip status={item.status} />
                                    </View>

                                    <Text className="text-gray-400 text-xs mt-3">Anlaşma: {formatDate(item.created_at)}</Text>
                                    {item.completed_at ? (
                                        <Text className="text-gray-400 text-xs mt-1">
                                            Tamamlandı: {formatDate(item.completed_at)}{item.auto_completed ? ' (otomatik)' : ''}
                                        </Text>
                                    ) : null}
                                    {item.cancelled_at ? (
                                        <Text className="text-gray-400 text-xs mt-1">
                                            İptal: {formatDate(item.cancelled_at)}{item.cancel_reason ? ` · ${item.cancel_reason}` : ''}
                                        </Text>
                                    ) : null}
                                    {item.auto_complete_at ? (
                                        <Text className="text-gray-400 text-xs mt-1">
                                            {role === 'brand'
                                                ? `Onaylamazsanız ${formatDate(item.auto_complete_at)} tarihinde otomatik tamamlanır.`
                                                : `Marka yanıt vermezse ${formatDate(item.auto_complete_at)} tarihinde otomatik tamamlanır.`}
                                        </Text>
                                    ) : null}
                                    {item.publish_url ? (
                                        <TouchableOpacity onPress={() => Linking.openURL(item.publish_url).catch(() => null)}>
                                            <Text className="text-soft-gold text-xs mt-2" numberOfLines={1}>{item.publish_url}</Text>
                                        </TouchableOpacity>
                                    ) : null}

                                    <Text className="text-gray-400 text-xs mt-1">
                                        Anlaşma özeti: {item.agreement_state === 'confirmed' ? 'iki taraf onayladı' : item.agreement_state === 'pending' ? 'onay bekliyor' : 'hazırlanmadı'}
                                        {item.deliverable_total > 0 ? ` · Teslimat: ${item.deliverable_published} / ${item.deliverable_total} yayınlandı` : ''}
                                    </Text>

                                    <View className="flex-row flex-wrap mt-3">
                                        <ActionButton label="Ayrıntılar ve teslimatlar" color="#D4AF37" onPress={() => navigation.navigate('CollaborationDetail', { id: item.id })} />
                                        {item.room_id
                                            ? <ActionButton label="Sohbete git" color="#e5e7eb" onPress={() => openChat(item, item.room_id)} />
                                            : item.actions.includes('open_room') && <ActionButton label="Sohbeti aç" color="#e5e7eb" disabled={busy} onPress={() => run(item, 'open_room')} />}
                                        {item.actions.includes('start') && (
                                            <ActionButton label="İçerik hazırlanıyor" color="#fbbf24" disabled={busy} onPress={() => run(item, 'start')} />
                                        )}
                                        {item.actions.includes('publish') && (
                                            <ActionButton label="Yayın linkini gir" color="#c084fc" disabled={busy} onPress={() => { setFormText(''); setForm({ item, kind: 'publish' }); }} />
                                        )}
                                        {item.actions.includes('approve') && (
                                            <ActionButton
                                                label="Onayla ve tamamla"
                                                color="#34d399"
                                                disabled={busy}
                                                onPress={() =>
                                                    Alert.alert('İş birliğini onayla', 'Yayın linkini kontrol ettiyseniz iş birliği tamamlanacak.', [
                                                        { text: 'Vazgeç', style: 'cancel' },
                                                        { text: 'Onayla', onPress: () => run(item, 'approve') },
                                                    ])
                                                }
                                            />
                                        )}
                                        {item.actions.includes('cancel') && (
                                            <ActionButton label="İptal et" color="#f87171" disabled={busy} onPress={() => { setFormText(''); setForm({ item, kind: 'cancel' }); }} />
                                        )}
                                    </View>
                                </View>
                            );
                        })}
                    </ScrollView>
                )}
            </SafeAreaView>

            <Modal animationType="slide" transparent visible={!!form} onRequestClose={() => setForm(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/70 justify-end">
                    {form && (
                        <View className="bg-[#0F1014] rounded-t-[28px] border-t border-white/10 p-6 pb-10">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-white text-lg font-bold">
                                    {form.kind === 'publish' ? 'Yayın linki' : 'İş birliğini iptal et'}
                                </Text>
                                <TouchableOpacity onPress={() => setForm(null)} className="w-9 h-9 bg-white/5 rounded-xl items-center justify-center">
                                    <X color="white" size={18} />
                                </TouchableOpacity>
                            </View>
                            <Text className="text-gray-400 text-xs mb-2">
                                {form.kind === 'publish'
                                    ? 'Instagram, TikTok veya YouTube linki. Marka onayladığında iş birliği tamamlanır.'
                                    : 'Gerekçe isteğe bağlıdır ve karşı tarafa iletilir.'}
                            </Text>
                            <TextInput
                                value={formText}
                                onChangeText={setFormText}
                                placeholder={form.kind === 'publish' ? 'https://www.instagram.com/p/...' : 'Gerekçe (isteğe bağlı)'}
                                placeholderTextColor="#6b7280"
                                autoCapitalize={form.kind === 'publish' ? 'none' : 'sentences'}
                                autoCorrect={form.kind !== 'publish'}
                                keyboardType={form.kind === 'publish' ? 'url' : 'default'}
                                multiline={form.kind === 'cancel'}
                                maxLength={500}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
                            />
                            <TouchableOpacity
                                disabled={busyId === form.item.id}
                                onPress={() =>
                                    run(form.item, form.kind, form.kind === 'publish' ? { url: formText.trim() } : { reason: formText.trim() })
                                }
                                className={`mt-4 rounded-xl py-3 items-center ${form.kind === 'publish' ? 'bg-soft-gold' : 'bg-red-500/80'}`}
                            >
                                {busyId === form.item.id
                                    ? <ActivityIndicator color="#000" />
                                    : <Text className={`font-bold ${form.kind === 'publish' ? 'text-black' : 'text-white'}`}>
                                        {form.kind === 'publish' ? 'Gönder' : 'İptal et'}
                                    </Text>}
                            </TouchableOpacity>
                        </View>
                    )}
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}
