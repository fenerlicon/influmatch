// Barter teslimat adresi (2026-11-24; web components/dashboard/ShippingCard.tsx ile aynı kurallar).
// Influencer girer; marka yalnızca anlaşma özeti iki tarafça onaylandıktan sonra görür (sunucu: lib/collaboration-shipping.ts).
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { apiRequest } from '../lib/api';
import { formatPhone } from '../constants/phone';
import { SHIPPING_BRAND_LOCKED_NOTE, SHIPPING_INFLUENCER_NOTE, SHIPPING_LIMITS } from '../constants/shipping';
import { Section, Card, Text, Button, TextField, Notice, Sheet } from './ui';

function AddressText({ a }) {
    return (
        <View style={{ gap: 2 }}>
            <Text weight="medium">{a.recipient_name}</Text>
            <Text variant="small" tone="fg2">{a.address_line}</Text>
            <Text variant="small" tone="fg2">{a.district} / {a.city}{a.postal_code ? ` · ${a.postal_code}` : ''}</Text>
            <Text variant="small" tone="fg2">{formatPhone(a.phone)}</Text>
            {a.note ? <Text variant="caption" tone="fg3">Not: {a.note}</Text> : null}
        </View>
    );
}

export default function ShippingSection({ collaborationId, shipping, isBrand, onSaved }) {
    const [sheet, setSheet] = useState(null);
    const [busy, setBusy] = useState(false);
    if (!shipping) return null;
    const saved = !isBrand && shipping.address && !shipping.suggested ? shipping.address : null;

    const open = () => {
        const a = shipping.address || {};
        setSheet({
            recipient_name: a.recipient_name || '', phone: a.phone ? formatPhone(a.phone) : '', address_line: a.address_line || '',
            district: a.district || '', city: a.city || '', postal_code: a.postal_code || '', note: a.note || '',
        });
    };

    const save = async () => {
        setBusy(true);
        const result = await apiRequest(`collaborations/${collaborationId}/shipping`, { method: 'POST', body: sheet });
        setBusy(false);
        if (!result?.success) return Alert.alert('Kaydedilemedi', result?.error || 'Tekrar dene.');
        setSheet(null);
        onSaved?.();
    };

    const field = (key, label, props = {}) => (
        <TextField label={label} value={sheet[key]} onChangeText={(v) => setSheet((s) => ({ ...s, [key]: v }))} {...props} />
    );

    return (
        <Section title="Teslimat adresi">
            <Card style={{ gap: 10 }}>
                <Text variant="small" tone="fg3">{isBrand ? 'Barter iş birliği: ürünün gönderileceği adres.' : SHIPPING_INFLUENCER_NOTE}</Text>
                {isBrand ? (
                    shipping.lockedForBrand ? <Notice tone="info" text={SHIPPING_BRAND_LOCKED_NOTE} />
                        : shipping.address ? <AddressText a={shipping.address} />
                            : <Text variant="small" tone="fg2">Influencer henüz teslimat adresini eklemedi.</Text>
                ) : saved ? (
                    <>
                        <AddressText a={saved} />
                        {shipping.canEdit ? <Button title="Düzenle" variant="secondary" size="sm" onPress={open} /> : null}
                    </>
                ) : shipping.canEdit ? (
                    <Button title={shipping.suggested ? 'Önceki adresimi kullan / düzenle' : 'Adres ekle'} icon={MapPin} size="sm" onPress={open} />
                ) : (
                    <Text variant="small" tone="fg2">Adres eklenmedi.</Text>
                )}
            </Card>
            <Sheet visible={!!sheet} onClose={() => (busy ? null : setSheet(null))} title="Teslimat adresi" scroll>
                {sheet ? (
                    <>
                        {field('recipient_name', 'Alıcı adı soyadı', { maxLength: SHIPPING_LIMITS.recipientMax, autoComplete: 'name' })}
                        {field('phone', 'Telefon', { keyboardType: 'phone-pad', placeholder: '0532 123 45 67', maxLength: 20 })}
                        {field('address_line', 'Açık adres', { multiline: true, height: 80, maxLength: SHIPPING_LIMITS.addressMax, placeholder: 'Mahalle, cadde / sokak, no, daire' })}
                        {field('district', 'İlçe', { maxLength: SHIPPING_LIMITS.districtMax })}
                        {field('city', 'İl', { maxLength: SHIPPING_LIMITS.cityMax })}
                        {field('postal_code', 'Posta kodu (isteğe bağlı)', { keyboardType: 'number-pad', maxLength: 5 })}
                        {field('note', 'Not (isteğe bağlı)', { maxLength: SHIPPING_LIMITS.noteMax })}
                        <Button title="Adresi kaydet" onPress={save} loading={busy} block />
                    </>
                ) : null}
            </Sheet>
        </Section>
    );
}
