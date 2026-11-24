import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => null }))
vi.mock('@/lib/notify', () => ({ displayNameOf: vi.fn(), notifyUser: vi.fn() }))

describe('barter teslimat adresi doğrulaması', () => {
  it('geçerli adres', async () => {
    const { validateShipping } = await import('@/lib/collaboration-shipping')
    const r = validateShipping({ recipient_name: ' Ayşe  Yılmaz ', phone: '0532 123 45 67', address_line: 'Moda Cd. No 5 D 3', district: 'Kadıköy', city: 'İstanbul', postal_code: '34710' })
    expect(r).toEqual({
      value: { recipient_name: 'Ayşe Yılmaz', phone: '+905321234567', address_line: 'Moda Cd. No 5 D 3', district: 'Kadıköy', city: 'İstanbul', postal_code: '34710', note: null },
    })
  })
  it('eksik / hatalı alanlar', async () => {
    const { validateShipping } = await import('@/lib/collaboration-shipping')
    const base = { recipient_name: 'Ayşe', phone: '05321234567', address_line: 'Moda Cd. 5', district: 'Kadıköy', city: 'İstanbul' }
    expect('error' in validateShipping({ ...base, recipient_name: '' })).toBe(true)
    expect('error' in validateShipping({ ...base, phone: '123' })).toBe(true)
    expect('error' in validateShipping({ ...base, address_line: 'x' })).toBe(true)
    expect('error' in validateShipping({ ...base, postal_code: '3471' })).toBe(true)
    expect('error' in validateShipping(null)).toBe(true)
  })
})
