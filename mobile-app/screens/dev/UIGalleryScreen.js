import React, { useState } from 'react';
import { View } from 'react-native';
import { Bell, Mail, Lock, Search, Sparkles, Inbox, Copy, SlidersHorizontal, Plus, Instagram, BadgeCheck, House, Briefcase, Megaphone, MessageCircle, UserRound } from 'lucide-react-native';
import {
    TabBar,
    Screen, LargeHeader, Logo, Section, Text, Button, IconButton, Card, ListGroup, ListRow, IconBox, StatCard,
    KeyValue, EmptyState, Avatar, NameWithTick, TextField, SearchBar, Toggle, Checkbox, Segment, UnderlineTabs,
    Chip, FilterChip, ChipRow, Notice, ProgressBar, StepBar, Timeline, Ring, Sheet,
} from '../../components/ui';

// Gerçek TabBar bileşenini sahte gezinme durumuyla çizer
function TabBarPreview({ tabs }) {
    const [index, setIndex] = useState(0);
    const routes = tabs.map(([name]) => ({ key: name, name }));
    const descriptors = Object.fromEntries(tabs.map(([name, icon, badge]) => [name, { options: { tabIcon: icon, tabBarBadge: badge } }]));
    const navigation = { emit: () => ({ defaultPrevented: false }), navigate: (name) => setIndex(routes.findIndex((r) => r.name === name)) };
    return <TabBar state={{ index, routes }} descriptors={descriptors} navigation={navigation} />;
}

// Yalnızca geliştirme: simülatörde http://localhost:8081/?ui=1 ile açılan bileşen vitrini (design/mobile/index.html karşılığı).
export default function UIGalleryScreen() {
    const [seg, setSeg] = useState('offers');
    const [tab, setTab] = useState('profile');
    const [on, setOn] = useState(true);
    const [agree, setAgree] = useState(false);
    const [sheet, setSheet] = useState(false);
    const [chip, setChip] = useState('beauty');

    return (
        <Screen
            scroll
            header={<LargeHeader title="Bileşenler" left={<Logo />} right={<IconButton icon={Bell} dot accessibilityLabel="Bildirimler" />} />}
        >
            <Notice tone="warning" title="Fiyat kartın boş" text="Markalar fiyatlarını görmek ister." more={1} />
            <Notice tone="gold" icon={Inbox} title="4 yeni başvuru" text="Yaz serisi cilt bakımı" />

            <Card>
                <View className="flex-row items-center" style={{ gap: 14 }}>
                    <Ring value={80} />
                    <View className="flex-1">
                        <Text variant="eyebrow">Hesap durumu</Text>
                        <Text weight="semibold" style={{ fontSize: 16 }}>Sıradaki adım: fiyat kartı</Text>
                        <Text variant="small" tone="fg2">Markalar başlangıç fiyatlarını görmek ister.</Text>
                    </View>
                </View>
                <View className="mt-3.5"><StepBar total={5} done={4} current={4} /></View>
                <View className="mt-3.5"><Button title="Fiyat kartını doldur" block /></View>
            </Card>

            <Section title="Butonlar">
                <Button title="Ana eylem" block />
                <View className="flex-row" style={{ gap: 10 }}>
                    <View className="flex-1"><Button title="İkincil" variant="secondary" block /></View>
                    <View className="flex-1"><Button title="Sade" variant="ghost" block /></View>
                </View>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    <Button title="Küçük" size="md" variant="secondary" />
                    <Button title="Kopyala" size="sm" variant="secondary" icon={Copy} />
                    <Button title="Reddet" size="md" variant="danger" />
                    <Button title="Yeni ilan" size="md" icon={Plus} />
                </View>
                <Button title="Yükleniyor" loading block />
            </Section>

            <Section title="Seçim">
                <Segment value={seg} onChange={setSeg} options={[{ key: 'offers', label: 'Teklifler', count: 2 }, { key: 'active', label: 'Aktif', count: 3 }, { key: 'done', label: 'Tamamlanan' }]} />
                <ChipRow>
                    <FilterChip label="Filtre" icon={SlidersHorizontal} />
                    {[['beauty', 'Güzellik'], ['fashion', 'Moda'], ['food', 'Yemek'], ['travel', 'Seyahat']].map(([k, l]) => (
                        <FilterChip key={k} label={l} selected={chip === k} onPress={() => setChip(k)} />
                    ))}
                </ChipRow>
                <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                    <Chip label="Nötr" /><Chip label="Yeni" tone="gold" /><Chip label="Doğrulandı" tone="success" />
                    <Chip label="Bekliyor" tone="warning" dot /><Chip label="Reddedildi" tone="danger" /><Chip label="Görüşülüyor" tone="info" />
                </View>
            </Section>

            <View className="-mx-4"><UnderlineTabs value={tab} onChange={setTab} options={[{ key: 'profile', label: 'Profil' }, { key: 'rate', label: 'Fiyat kartı' }, { key: 'badges', label: 'Rozetler' }]} /></View>

            <Section title="Form">
                <TextField label="E-posta" icon={Mail} placeholder="ornek@mail.com" />
                <TextField label="Şifre" icon={Lock} placeholder="••••••••" secureTextEntry hint="En az 8 karakter" />
                <TextField label="Bütçe" prefix="₺" placeholder="0" keyboardType="numeric" error="Bütçe girin" />
                <TextField label="Mesaj" multiline placeholder="Markaya notun" />
                <SearchBar placeholder="İlan veya marka ara" />
                <View className="flex-row items-center justify-between"><Text>Pazarlığa açığım</Text><Toggle value={on} onValueChange={setOn} /></View>
                <Checkbox checked={agree} onChange={setAgree}><Text variant="small" tone="fg2">Kullanım koşullarını okudum, kabul ediyorum.</Text></Checkbox>
            </Section>

            <Section title="Liste" action="Tümü">
                <ListGroup>
                    <ListRow left={<Avatar name="Deniz Aksoy" />} title={<NameWithTick name="Deniz Aksoy" verified />} subtitle="48,2B · Güzellik" chevron onPress={() => {}} />
                    <ListRow left={<IconBox icon={Sparkles} tone="gold" />} title="Spotlight" subtitle="Keşfette öne çık" chevron onPress={() => {}} />
                    <ListRow left={<IconBox icon={Instagram} tone="success" />} title="Instagram" subtitle="Doğrulandı" right={<Chip label="Doğrulandı" tone="success" />} />
                </ListGroup>
            </Section>

            <View className="flex-row" style={{ gap: 10 }}>
                <StatCard label="Takipçi" value="48,2B" />
                <StatCard label="Etkileşim" value="%4,1" />
                <StatCard label="İş" value="12" />
            </View>

            <Card>
                <Timeline stage={2} />
                <View className="mt-3"><ProgressBar value={37} /></View>
                <View className="mt-2">
                    <KeyValue label="Ücret" value="₺8.000" />
                    <KeyValue label="Revize hakkı" value="1 / 2 kaldı" last />
                </View>
            </Card>

            <Card accent>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Avatar name="Luna Kozmetik" square size="lg" />
                    <View className="flex-1">
                        <Text variant="title">Vurgulu kart</Text>
                        <Text variant="title" italic tone="champagne">italik vurgu</Text>
                    </View>
                    <BadgeCheck size={20} color="#7FA6DB" />
                </View>
            </Card>

            <Card padded={false}>
                <EmptyState icon={Inbox} title="Henüz teklif yok" text="Profilin ve fiyat kartın tamamsa markalar seni daha kolay bulur." action={<Button title="Profili tamamla" size="md" variant="secondary" />} />
            </Card>

            <Section title="Alt sekme çubuğu — influencer">
                <View className="-mx-4"><TabBarPreview tabs={[['Ana Sayfa', House], ['İşler', Briefcase, 2], ['İlanlar', Megaphone], ['Mesajlar', MessageCircle, 3], ['Profil', UserRound]]} /></View>
            </Section>
            <Section title="Alt sekme çubuğu — marka">
                <View className="-mx-4"><TabBarPreview tabs={[['Ana Sayfa', House], ['Keşfet', Search], ['İlanlar', Megaphone], ['İşler', Briefcase, 1], ['Mesajlar', MessageCircle, 2]]} /></View>
            </Section>

            <Button title="Bottom sheet aç" variant="secondary" icon={Search} block onPress={() => setSheet(true)} />
            <Sheet visible={sheet} onClose={() => setSheet(false)} title="Başvur" headerRight={<Text variant="small" tone="gold">Şablondan</Text>}>
                <TextField label="Markaya notun" multiline placeholder="Kısa bir not yaz" />
                <TextField label="Teklif ettiğin ücret" prefix="₺" placeholder="8.000" keyboardType="numeric" />
                <Button title="Başvuruyu gönder" block onPress={() => setSheet(false)} />
            </Sheet>
        </Screen>
    );
}
