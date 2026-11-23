// e-Arşiv fatura kancası (2026-11-23). Fatura sağlayıcısını (ör. Paraşüt) muhasebeci seçecek; o zamana kadar
// bu fonksiyon hiçbir şey yapmaz ve ödeme kaydı `invoice_status = 'pending'` olarak kalır (admin /admin/billing'de görür).
//
// Sağlayıcı seçilince yapılacaklar (docs/PAYMENTS.md "e-Arşiv"):
//  1. Sağlayıcının API anahtarı Vercel ortam değişkenine (ör. INVOICE_PROVIDER_API_KEY) eklenir.
//  2. Aşağıda: ödemenin kullanıcısının fatura bilgileri (ad soyad / unvan, VKN-TCKN, adres) okunur, sağlayıcıya fatura isteği gider,
//     dönen fatura numarası `payments.invoice_ref`'e, durum `issued` / `failed` olarak yazılır.
//  3. Saatlik görevde `invoice_status = 'pending'` kalanlar yeniden denenir.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PaymentRow } from '@/lib/payments/subscriptions'

export interface InvoiceResult {
  status: 'pending' | 'issued' | 'failed' | 'not_applicable'
  ref?: string | null
}

/** Başarılı her tahsilattan sonra çağrılır. Şimdilik no-op (TODO: e-Arşiv sağlayıcısı). Hata fırlatmaz. */
export async function issueInvoice(_admin: SupabaseClient, _payment: Pick<PaymentRow, 'id' | 'user_id' | 'amount' | 'currency' | 'provider'>): Promise<InvoiceResult> {
  // TODO(e-Arşiv): sağlayıcı entegrasyonu. Mağaza (Apple / Google) tahsilatlarında faturayı mağaza keser; orada 'not_applicable' olabilir (muhasebeciyle netleşecek).
  return { status: 'pending' }
}
