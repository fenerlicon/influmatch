import { describe, expect, it } from 'vitest'
import {
  founderNoticeLink,
  founderWindowOpen,
  istanbulLocalToIso,
  isoToIstanbulLocal,
  normalizeFounderCutoff,
} from '@/lib/founder-badge-shared'

describe('Kurucu Üye son tarihi', () => {
  it('belirlenmemiş son tarihte rozet verilir', () => {
    expect(founderWindowOpen(null)).toBe(true)
  })

  it('son tarihten önce verilir, sonra verilmez', () => {
    const cutoff = '2026-12-24T21:00:00.000Z'
    expect(founderWindowOpen(cutoff, Date.parse('2026-12-24T20:59:59Z'))).toBe(true)
    expect(founderWindowOpen(cutoff, Date.parse('2026-12-24T21:00:00Z'))).toBe(false)
    expect(founderWindowOpen(cutoff, Date.parse('2027-01-10T00:00:00Z'))).toBe(false)
  })

  it('ayar değeri doğrulanır', () => {
    expect(normalizeFounderCutoff(null)).toBeNull()
    expect(normalizeFounderCutoff('')).toBeNull()
    expect(normalizeFounderCutoff('tarih değil')).toBeNull()
    expect(normalizeFounderCutoff(42)).toBeNull()
    expect(normalizeFounderCutoff('2026-12-25T00:00:00+03:00')).toBe('2026-12-24T21:00:00.000Z')
  })

  it('admin formu Türkiye saatiyle çalışır', () => {
    expect(istanbulLocalToIso('2026-12-25T00:00')).toBe('2026-12-24T21:00:00.000Z')
    expect(isoToIstanbulLocal('2026-12-24T21:00:00.000Z')).toBe('2026-12-25T00:00')
    expect(istanbulLocalToIso('25.12.2026')).toBeNull()
    expect(isoToIstanbulLocal(null)).toBe('')
  })

  it('bildirim bağlantısı role göre', () => {
    expect(founderNoticeLink('brand')).toBe('/dashboard/brand/badges')
    expect(founderNoticeLink('influencer')).toBe('/dashboard/influencer/badges')
  })
})
