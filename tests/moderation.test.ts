// Ret nedeni ve itiraz kuralları (lib/moderation-shared.ts, 2026-10-26).
import { describe, expect, it } from 'vitest'
import {
  MODERATION_REASONS,
  MODERATION_SUBJECT_TYPES,
  appealFileExtension,
  formatReason,
  isOwnAppealFilePath,
  parseAppealMessage,
  parseDecisionReason,
} from '@/lib/moderation-shared'

describe('ret nedeni', () => {
  it('her akışta "Diğer" sonda ve kodlar benzersiz', () => {
    for (const type of MODERATION_SUBJECT_TYPES) {
      const list = MODERATION_REASONS[type]
      expect(list[list.length - 1].code).toBe('other')
      expect(new Set(list.map((r) => r.code)).size).toBe(list.length)
      for (const r of list) expect(r.code).toMatch(/^[a-z_]{2,40}$/)
    }
  })

  it('neden seçilmeden ret yok', () => {
    expect(parseDecisionReason('account', null).ok).toBe(false)
    expect(parseDecisionReason('account', { code: 'yok' }).ok).toBe(false)
    expect(parseDecisionReason('tax_document', { code: 'missing_info' }).ok).toBe(false)
  })

  it('"Diğer" açıklama ister, diğerlerinde isteğe bağlı', () => {
    expect(parseDecisionReason('task_submission', { code: 'other', text: ' ' }).ok).toBe(false)
    const other = parseDecisionReason('task_submission', { code: 'other', text: 'Video silinmiş' })
    expect(other.ok && formatReason(other.reason)).toBe('Video silinmiş')
    const plain = parseDecisionReason('tax_document', { code: 'unreadable' })
    expect(plain.ok && formatReason(plain.reason)).toBe('Eksik / okunmayan belge')
    const withText = parseDecisionReason('account', { code: 'info_mismatch', text: '  Unvan   farklı ' })
    expect(withText.ok && formatReason(withText.reason)).toBe('Bilgiler uyuşmuyor: Unvan farklı')
  })

  it('açıklama 500 karakteri geçemez', () => {
    expect(parseDecisionReason('account', { code: 'other', text: 'a'.repeat(501) }).ok).toBe(false)
    expect(parseDecisionReason('account', { code: 'other', text: 'a'.repeat(500) }).ok).toBe(true)
  })
})

describe('itiraz', () => {
  it('metin 10–1000 karakter', () => {
    expect(parseAppealMessage('kısa').ok).toBe(false)
    expect(parseAppealMessage('a'.repeat(1001)).ok).toBe(false)
    expect(parseAppealMessage('Belgem günceldi, yeniden bakın lütfen.').ok).toBe(true)
  })

  it('ek yolu yalnızca kullanıcının kendi klasörü', () => {
    const uid = '11111111-1111-1111-1111-111111111111'
    expect(isOwnAppealFilePath(uid, `${uid}/1761475200000.pdf`)).toBe(true)
    expect(isOwnAppealFilePath(uid, `22222222-2222-2222-2222-222222222222/1761475200000.pdf`)).toBe(false)
    expect(isOwnAppealFilePath(uid, `${uid}/../x.pdf`)).toBe(false)
    expect(isOwnAppealFilePath(uid, `${uid}/1761475200000.exe`)).toBe(false)
  })

  it('ek uzantıları', () => {
    expect(appealFileExtension('JPEG')).toBe('jpg')
    expect(appealFileExtension('.pdf')).toBe('pdf')
    expect(appealFileExtension('gif')).toBeNull()
  })
})
