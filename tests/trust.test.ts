import { describe, expect, it } from 'vitest'
import {
  COMMITMENT_TEXT,
  PAYMENT_REMINDER_DAYS,
  RECEIPT_REMINDER_DAYS,
  TRUST_BADGE_RULES,
  dueReminderStep,
  isDeliveryOnTime,
  isOwnProofPath,
  isPaymentOnTime,
  istanbulDate,
  lateCountText,
  nondeliveryAvailableAt,
  onTimeDeliveryEligible,
  onTimePaymentEligible,
  paymentProgress,
  paymentReminderBase,
  proofExtension,
  validatePaymentDueDate,
  workFinishedAt,
} from '@/lib/collaboration-trust-shared'
import { escapeHtml, renderCollaborationRecordHtml, type CollaborationRecord } from '@/lib/collaboration-record'

const day = (iso: string, plusDays = 0, hour = 9) => new Date(Date.parse(`${iso}T00:00:00Z`) + plusDays * 86_400_000 + hour * 3_600_000)

describe('taahhüt metni', () => {
  it('kullanıcının verdiği metinle aynı', () => {
    expect(COMMITMENT_TEXT).toBe(
      'Bu iş birliğinin tüm yazışma, onay ve teslim kayıtları saklanır. Ödeme yapılmazsa influencer bu kayıtları yasal süreçte kullanabilir; ödeme yapmayan markaların hesabı askıya alınır.',
    )
  })
})

describe('ödeme vadesi', () => {
  const today = '2026-11-23'
  it('nakitte zorunlu, barter da isteğe bağlı', () => {
    expect(validatePaymentDueDate('', { required: true, previous: null, today })).toEqual({ error: 'Ödeme vadesini (son ödeme tarihi) girin.' })
    expect(validatePaymentDueDate(null, { required: false, previous: null, today })).toEqual({ value: null })
  })
  it('geçmiş ya da çok ileri tarih reddedilir; değişmeyen eski vade kabul', () => {
    expect('error' in validatePaymentDueDate('2026-11-01', { required: true, previous: null, today })).toBe(true)
    expect('error' in validatePaymentDueDate('2031-01-01', { required: true, previous: null, today })).toBe(true)
    expect(validatePaymentDueDate('2026-11-01', { required: true, previous: '2026-11-01', today })).toEqual({ value: '2026-11-01' })
    expect(validatePaymentDueDate('2026-12-15', { required: true, previous: null, today })).toEqual({ value: '2026-12-15' })
    expect('error' in validatePaymentDueDate('2026-02-30', { required: true, previous: null, today })).toBe(true)
  })
})

describe('hatırlatma takvimi', () => {
  it('başlangıç: vade ile işin bitişinden geç olanı; iş bitmediyse yok', () => {
    expect(paymentReminderBase('2026-12-01', null)).toBeNull()
    expect(paymentReminderBase('2026-12-01', '2026-11-20T10:00:00Z')).toBe('2026-12-01T00:00:00.000Z')
    expect(paymentReminderBase('2026-11-10', '2026-11-20T10:00:00Z')).toBe('2026-11-20T10:00:00.000Z')
    expect(paymentReminderBase(null, '2026-11-20T10:00:00Z')).toBe('2026-11-20T10:00:00.000Z')
  })

  it('iş bitişi: tamamlanma ile bütün teslimatların onayından erken olanı', () => {
    expect(workFinishedAt(null, null)).toBeNull()
    expect(workFinishedAt('2026-11-20T00:00:00Z', '2026-11-18T00:00:00Z')).toBe('2026-11-18T00:00:00.000Z')
  })

  it('marka 0 / 3 / 7 / 14. gün; geç kalan görev yalnızca güncel adımı gönderir', () => {
    expect(PAYMENT_REMINDER_DAYS).toEqual([0, 3, 7, 14])
    const base = '2026-12-01T00:00:00.000Z'
    expect(dueReminderStep(base, day('2026-11-30'), PAYMENT_REMINDER_DAYS, [])).toBeNull()
    expect(dueReminderStep(base, day('2026-12-01'), PAYMENT_REMINDER_DAYS, [])).toBe(0)
    expect(dueReminderStep(base, day('2026-12-02'), PAYMENT_REMINDER_DAYS, [0])).toBeNull()
    expect(dueReminderStep(base, day('2026-12-04'), PAYMENT_REMINDER_DAYS, [0])).toBe(3)
    expect(dueReminderStep(base, day('2026-12-10'), PAYMENT_REMINDER_DAYS, [0])).toBe(7)
    expect(dueReminderStep(base, day('2026-12-20'), PAYMENT_REMINDER_DAYS, [0, 3, 7])).toBe(14)
    expect(dueReminderStep(base, day('2026-12-30'), PAYMENT_REMINDER_DAYS, [0, 3, 7, 14])).toBeNull()
    // Hiç gönderilmemişse ve 10. gündeyse yalnızca 7. gün adımı (0 ve 3 atlanır).
    expect(dueReminderStep(base, day('2026-12-11'), PAYMENT_REMINDER_DAYS, [])).toBe(7)
  })

  it('influencer teyit hatırlatması 2 / 5 / 10. gün', () => {
    expect(RECEIPT_REMINDER_DAYS).toEqual([2, 5, 10])
    const paidAt = '2026-12-01T08:00:00.000Z'
    expect(dueReminderStep(paidAt, day('2026-12-02', 0, 9), RECEIPT_REMINDER_DAYS, [])).toBeNull()
    expect(dueReminderStep(paidAt, day('2026-12-03', 0, 9), RECEIPT_REMINDER_DAYS, [])).toBe(2)
    expect(dueReminderStep(paidAt, day('2026-12-06', 0, 9), RECEIPT_REMINDER_DAYS, [2])).toBe(5)
    expect(dueReminderStep(paidAt, day('2026-12-12', 0, 9), RECEIPT_REMINDER_DAYS, [2, 5])).toBe(10)
  })

  it('ödeme durumu', () => {
    expect(paymentProgress(null, null)).toBe('none')
    expect(paymentProgress(null, '2026-11-20T00:00:00Z')).toBe('awaiting_brand')
    expect(paymentProgress({ brand_paid_at: 'x', influencer_received_at: null }, null)).toBe('awaiting_influencer')
    expect(paymentProgress({ brand_paid_at: 'x', influencer_received_at: 'y' }, null)).toBe('confirmed')
  })
})

describe('zamanında ödeme / teslim', () => {
  it('ödeme vadesi günü dahil', () => {
    expect(isPaymentOnTime('2026-12-01', '2026-12-01')).toBe(true)
    expect(isPaymentOnTime('2026-12-02', '2026-12-01')).toBe(false)
    expect(isPaymentOnTime('2026-12-02', null)).toBeNull()
  })

  it('teslim günü Türkiye saatiyle gün sonuna kadar', () => {
    expect(istanbulDate(Date.parse('2026-12-01T20:59:00Z'))).toBe('2026-12-01')
    expect(istanbulDate(Date.parse('2026-12-01T21:01:00Z'))).toBe('2026-12-02')
    expect(isDeliveryOnTime({ due_date: '2026-12-01', approved_at: '2026-12-01T20:30:00Z', published_at: null })).toBe(true)
    expect(isDeliveryOnTime({ due_date: '2026-12-01', approved_at: null, published_at: '2026-12-01T21:30:00Z' })).toBe(false)
    expect(isDeliveryOnTime({ due_date: '2026-12-01', approved_at: '2026-12-03T10:00:00Z', published_at: '2026-11-30T10:00:00Z' })).toBe(true)
    expect(isDeliveryOnTime({ due_date: null, approved_at: '2026-12-01T10:00:00Z', published_at: null })).toBeNull()
  })

  it('teslim edilmedi bildirimi teslim tarihi + 3 gün sonra, onaylanmamışsa', () => {
    expect(nondeliveryAvailableAt({ due_date: '2026-12-01', status: 'pending' })).toBe('2026-12-05T00:00:00.000Z')
    expect(nondeliveryAvailableAt({ due_date: '2026-12-01', status: 'approved' })).toBeNull()
    expect(nondeliveryAvailableAt({ due_date: null, status: 'pending' })).toBeNull()
  })
})

describe('rozet kuralları', () => {
  it('Zamanında Ödeme', () => {
    expect(TRUST_BADGE_RULES.onTimePayment.minCollaborations).toBe(3)
    expect(onTimePaymentEligible({ confirmed: 3, withDueDate: 3, onTime: 3, upheldDisputes: 0 })).toBe(true)
    expect(onTimePaymentEligible({ confirmed: 2, withDueDate: 2, onTime: 2, upheldDisputes: 0 })).toBe(false)
    expect(onTimePaymentEligible({ confirmed: 10, withDueDate: 10, onTime: 8, upheldDisputes: 0 })).toBe(false)
    expect(onTimePaymentEligible({ confirmed: 10, withDueDate: 10, onTime: 9, upheldDisputes: 0 })).toBe(true)
    expect(onTimePaymentEligible({ confirmed: 10, withDueDate: 10, onTime: 10, upheldDisputes: 1 })).toBe(false)
    // Vadesiz eski kayıtlar oranı oluşturmaz.
    expect(onTimePaymentEligible({ confirmed: 5, withDueDate: 1, onTime: 1, upheldDisputes: 0 })).toBe(false)
  })

  it('Zamanında Teslim', () => {
    expect(onTimeDeliveryEligible({ completed: 3, withDueDate: 5, onTime: 5, upheldDisputes: 0 })).toBe(true)
    expect(onTimeDeliveryEligible({ completed: 3, withDueDate: 10, onTime: 8, upheldDisputes: 0 })).toBe(false)
    expect(onTimeDeliveryEligible({ completed: 2, withDueDate: 5, onTime: 5, upheldDisputes: 0 })).toBe(false)
    expect(onTimeDeliveryEligible({ completed: 5, withDueDate: 0, onTime: 0, upheldDisputes: 0 })).toBe(false)
    expect(onTimeDeliveryEligible({ completed: 5, withDueDate: 5, onTime: 5, upheldDisputes: 1 })).toBe(false)
  })

  it('gecikme satırı yalnızca sayım', () => {
    expect(lateCountText('payment', 1, 4)).toBe('4 vadeli ödemeden 1 tanesi gecikti')
    expect(lateCountText('delivery', 0, 0)).toBe('Tarihli teslimat kaydı yok')
  })
})

describe('kanıt dosyası', () => {
  const uid = '11111111-1111-4111-8111-111111111111'
  const did = '22222222-2222-4222-8222-222222222222'
  it('yalnızca kendi klasörü ve anlaşmazlığı', () => {
    expect(isOwnProofPath(uid, did, `${uid}/${did}/1732300000000.pdf`)).toBe(true)
    expect(isOwnProofPath(uid, did, `${did}/${uid}/1732300000000.pdf`)).toBe(false)
    expect(isOwnProofPath(uid, did, `${uid}/${did}/../x.pdf`)).toBe(false)
    expect(isOwnProofPath(uid, did, `${uid}/${did}/1732300000000.exe`)).toBe(false)
    expect(proofExtension('JPEG')).toBe('jpg')
    expect(proofExtension('gif')).toBeNull()
  })
})

describe('iş birliği kaydı', () => {
  it('HTML kaçışı ve yazdırma CSS', () => {
    expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe('&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;')
    const record: CollaborationRecord = {
      generatedAt: '2026-11-23T10:00:00Z',
      generatedFor: 'Marka A',
      collaboration: {
        id: '33333333-3333-4333-8333-333333333333',
        title: '<b>Kış</b>',
        status: 'Tamamlandı',
        source: 'Teklif',
        createdAt: '2026-11-01T10:00:00Z',
        publishedAt: null,
        completedAt: '2026-11-20T10:00:00Z',
        autoCompleted: false,
        cancelledAt: null,
        cancelReason: null,
        publishUrl: 'javascript:alert(1)',
      },
      brand: { id: 'b', name: 'Marka A', username: 'markaa', role: 'brand' },
      influencer: { id: 'i', name: 'Ayşe', username: 'ayse', role: 'influencer' },
      agreement: null,
      deliverables: [],
      payment: null,
      commitmentAcceptedAt: null,
      disputes: [],
      reminders: [],
      messages: [{ at: '2026-11-02T10:00:00Z', sender: 'Ayşe', text: '<img src=x onerror=alert(1)>', system: false }],
      messagesTruncated: false,
    }
    const html = renderCollaborationRecordHtml(record)
    expect(html).toContain('@media print')
    expect(html).toContain('&lt;b&gt;Kış&lt;/b&gt;')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('href="javascript:')
  })
})
