import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, Share, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { decode } from 'base64-arraybuffer';
import { Trophy, Link2, ImageUp, Gift, Lock, Copy, Share2, Clock } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { TASK_PROOF_BUCKET, TASK_PROOF_MAX_BYTES, TASK_STATE_CHIPS } from '../constants/tasks';
import { Screen, StackHeader, Text, Button, Card, Chip, EmptyState, Notice, ProgressBar, TextField, colors } from '../components/ui';

const formatDate = (value) =>
    value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
const formatCount = (n) => (typeof n === 'number' ? n.toLocaleString('tr-TR') : '—');

function TaskCard({ task, inviteLink, onDone }) {
    const [postUrl, setPostUrl] = useState('');
    const [busy, setBusy] = useState(false);
    const chip = TASK_STATE_CHIPS[task.state] || TASK_STATE_CHIPS.available;
    const canAct = task.state === 'available' || task.state === 'ready';
    const latest = task.latest;

    const send = async (input) => {
        setBusy(true);
        const result = await apiRequest('tasks', { method: 'POST', body: { action: 'submit', taskId: task.id, ...input } });
        setBusy(false);
        if (result.error) return Alert.alert('Gönderilemedi', result.error);
        setPostUrl('');
        Alert.alert('Gönderildi', result.status === 'measuring' ? 'Bekleme süresi dolunca izlenme ölçülecek.' : 'İncelemeye alındı.');
        onDone();
    };

    // Kovaya doğrudan yükleme kapalı: sunucu imzalı yükleme adresi verir (web ile aynı).
    const pickProof = async () => {
        try {
            const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaType.Images, quality: 0.8, base64: true });
            if (picked.canceled || !picked.assets?.[0]?.base64) return;
            const bytes = decode(picked.assets[0].base64);
            if (bytes.byteLength > TASK_PROOF_MAX_BYTES) return Alert.alert('Görsel çok büyük', 'Görsel en fazla 5 MB olabilir.');
            setBusy(true);
            const upload = await apiRequest('tasks', { method: 'POST', body: { action: 'upload-url', extension: 'jpg' } });
            if (upload.error || !upload.path || !upload.token) {
                setBusy(false);
                return Alert.alert('Yüklenemedi', upload.error || 'Lütfen tekrar dene.');
            }
            const { error } = await supabase.storage.from(TASK_PROOF_BUCKET).uploadToSignedUrl(upload.path, upload.token, bytes, { contentType: 'image/jpeg' });
            if (error) {
                setBusy(false);
                return Alert.alert('Yüklenemedi', 'Görsel yüklenemedi. Lütfen tekrar dene.');
            }
            await send({ proofPath: upload.path });
        } catch (e) {
            setBusy(false);
            Alert.alert('Yüklenemedi', e?.message || 'Lütfen tekrar dene.');
        }
    };

    return (
        <Card style={{ gap: 10 }}>
            <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
                <Text weight="semibold" style={{ flex: 1 }}>{task.title}</Text>
                <Chip label={chip.label} tone={chip.tone} />
            </View>
            {task.description ? <Text variant="small" tone="fg2">{task.description}</Text> : null}
            <View className="flex-row"><Chip label={task.reward} tone="gold" icon={Gift} /></View>
            {task.maxRounds > 1 ? <Text variant="caption" tone="fg3">Tur: {task.approvedRounds} / {task.maxRounds} tamamlandı</Text> : null}

            {task.progress?.length && task.state !== 'completed'
                ? task.progress.map((p) => (
                    <View key={p.label} style={{ gap: 4 }}>
                        <View className="flex-row justify-between">
                            <Text variant="small" tone={p.met ? 'fg' : 'fg2'}>{p.label}</Text>
                            <Text variant="small" tone="fg2" style={{ fontVariant: ['tabular-nums'] }}>{p.current} / {p.target}</Text>
                        </View>
                        <ProgressBar value={Math.round((p.current / Math.max(1, p.target)) * 100)} tone={p.met ? 'success' : 'gold'} />
                    </View>
                ))
                : null}

            {task.kind === 'promo_video' && task.requiredViews != null && task.state !== 'completed' ? (
                <Text variant="small" tone="fg2">Hedef: {task.holdDays}. günde en az {formatCount(task.requiredViews)} izlenme.</Text>
            ) : null}

            {task.state === 'blocked' && task.blockedReason ? <Notice tone="warning" icon={Lock} text={task.blockedReason} /> : null}
            {task.state === 'measuring' && latest ? (
                <Notice tone="info" icon={Clock} title="Ölçüm bekleniyor" text={`${formatDate(latest.measureDueAt)} sonrasında ölçülecek (gerekli: ${formatCount(latest.requiredViews)}). Gönderiyi silme.`} />
            ) : null}
            {task.state === 'in_review' && latest ? <Notice tone="info" title="İncelemede" text={latest.checkNote || 'Gönderin admin incelemesinde.'} /> : null}
            {latest?.status === 'rejected' && canAct ? (
                <Notice tone="warning" title="Son gönderim onaylanmadı" text={latest.reviewNote || latest.checkNote || 'Yeni bir gönderimle tekrar deneyebilirsin.'} />
            ) : null}

            {canAct && task.evidence === 'post_url' ? (
                <View style={{ gap: 8 }}>
                    <TextField
                        label="Gönderi bağlantısı"
                        placeholder="https://www.instagram.com/reel/..."
                        value={postUrl}
                        onChangeText={setPostUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                    />
                    <Button title="Gönder" icon={Link2} onPress={() => send({ postUrl })} loading={busy} disabled={!postUrl.trim()} block />
                </View>
            ) : null}
            {canAct && task.evidence === 'proof_image' ? (
                <View style={{ gap: 8 }}>
                    {inviteLink ? <Text variant="small" tone="fg2">Story'ye eklenecek bağlantı: {inviteLink}</Text> : null}
                    <Button title="Ekran görüntüsü yükle" icon={ImageUp} onPress={pickProof} loading={busy} block />
                </View>
            ) : null}
            {task.state === 'ready' && task.evidence === 'auto' ? (
                <Button title="Ödülü talep et" icon={Gift} onPress={() => send({})} loading={busy} block />
            ) : null}
            {task.endsAt && task.state !== 'completed' ? <Text variant="caption" tone="fg3">Son tarih: {formatDate(task.endsAt)}</Text> : null}
        </Card>
    );
}

// Görevler (2026-10-18): kurallar sunucuda (/api/mobile/tasks, lib/tasks.ts); web /dashboard/tasks ile aynı.
export default function TasksScreen({ navigation }) {
    const [overview, setOverview] = useState(null);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        const result = await apiRequest('tasks');
        setRefreshing(false);
        if (result.error) {
            setError(result.error);
            setOverview((prev) => prev || { tasks: [], rewards: [] });
            return;
        }
        setError(null);
        setOverview(result.overview);
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    const invite = overview?.invite;
    const copy = async (text) => {
        try {
            await Clipboard.setStringAsync(text);
            Alert.alert('Kopyalandı');
        } catch {
            Alert.alert('Kopyalanamadı');
        }
    };

    return (
        <Screen
            scroll
            keyboard
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            header={<StackHeader title="Görevler" onBack={() => navigation.goBack()} />}
        >
            <Text variant="small" tone="fg2">Görevleri tamamla, ödül kazan. Ödüller incelemeden sonra bekleyen ödüllerine eklenir ve satış başlayınca hesabına işlenir.</Text>
            {error ? <Text tone="danger" variant="small">{error}</Text> : null}
            {overview === null ? (
                <ActivityIndicator color={colors.gold} />
            ) : (
                <>
                    {overview.verified === false ? <Notice tone="warning" title="Hesabın henüz onaylanmadı" text="Görev gönderimi hesabın onaylandıktan sonra açılır." /> : null}
                    {overview.promoPeriod && overview.audience === 'creator' ? (
                        <Notice tone="gold" title="0₺ döneminde mavi tik" text="Mevcut şartlara ek olarak tanıtım videosu görevi ve en az 1 tamamlanan iş birliği gerekir." />
                    ) : null}

                    {invite ? (
                        <Card style={{ gap: 10 }}>
                            <Text weight="semibold">Davet kodun</Text>
                            <Text variant="small" tone="fg2">{invite.total} kişi kodunla kaydoldu, {invite.verified} kişinin hesabı onaylandı.</Text>
                            <Text style={{ fontSize: 20, letterSpacing: 2 }} weight="semibold">{invite.code}</Text>
                            <View className="flex-row" style={{ gap: 8 }}>
                                <View className="flex-1"><Button title="Kopyala" variant="secondary" size="md" icon={Copy} onPress={() => copy(invite.link)} block /></View>
                                <View className="flex-1">
                                    <Button
                                        title="Paylaş"
                                        variant="secondary"
                                        size="md"
                                        icon={Share2}
                                        onPress={() => Share.share({ message: `Influmatch'e davet kodumla katıl: ${invite.link}` }).catch(() => null)}
                                        block
                                    />
                                </View>
                            </View>
                        </Card>
                    ) : null}

                    {(overview.tasks || []).length === 0 ? (
                        <Card padded={false}>
                            <EmptyState icon={Trophy} title="Şu an açık görev yok" text="Yeni görevler açıldığında burada görünecek." />
                        </Card>
                    ) : (
                        overview.tasks.map((task) => <TaskCard key={task.id} task={task} inviteLink={invite?.link || null} onDone={load} />)
                    )}

                    <Card style={{ gap: 8 }}>
                        <Text weight="semibold">Ödüllerim</Text>
                        <Text variant="caption" tone="fg3">Satış başlayınca hesabına işlenir. İndirim kodu ilk ay indirimiyle birleşmez; büyük olan geçerli olur.</Text>
                        {(overview.rewards || []).length === 0 ? (
                            <Text variant="small" tone="fg2">Henüz ödül yok.</Text>
                        ) : (
                            overview.rewards.map((r) => (
                                <View key={r.id} className="flex-row items-center justify-between py-2 border-t border-line" style={{ gap: 8 }}>
                                    <View className="flex-1">
                                        <Text variant="small">{r.text}</Text>
                                        <Text variant="caption" tone="fg3">{r.taskTitle}{r.code ? ` · Kod: ${r.code}` : ''}</Text>
                                    </View>
                                    <Chip label={r.statusLabel} tone={r.status === 'applied' ? 'success' : r.status === 'pending' ? 'warning' : 'neutral'} />
                                </View>
                            ))
                        )}
                    </Card>
                </>
            )}
        </Screen>
    );
}
