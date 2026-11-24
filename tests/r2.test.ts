// R2 imzalı adresleri ve sohbet / teslimat referansları (2026-11-24).
import { beforeAll, describe, expect, it } from 'vitest'

const ROOM = '11111111-1111-1111-1111-111111111111'
const USER = '22222222-2222-2222-2222-222222222222'

describe('R2', () => {
  beforeAll(() => {
    process.env.R2_ACCOUNT_ID = 'acc'
    process.env.R2_ACCESS_KEY_ID = 'AKID'
    process.env.R2_SECRET_ACCESS_KEY = 'secret'
    process.env.R2_BUCKET = 'influmatch'
  })

  it('yükleme adresi boyut ve türle imzalanır', async () => {
    const { createR2UploadUrl } = await import('@/lib/r2')
    const url = new URL((await createR2UploadUrl(`chat/${ROOM}/${USER}/1_a.webp`, 'image/webp', 1234))!)
    expect(url.host).toBe('acc.r2.cloudflarestorage.com')
    expect(url.pathname).toBe(`/influmatch/chat/${ROOM}/${USER}/1_a.webp`)
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host')
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900')
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('güvensiz anahtar imzalanmaz', async () => {
    const { createR2UploadUrl, createR2ViewUrl } = await import('@/lib/r2')
    expect(await createR2UploadUrl('../x', 'image/webp', 10)).toBeNull()
    expect(await createR2ViewUrl('a//b')).toBeNull()
    expect(await createR2UploadUrl('chat/a.webp', 'image/webp', 0)).toBeNull()
  })

  it('indirme adresi attachment başlığı taşır', async () => {
    const { createR2ViewUrl } = await import('@/lib/r2')
    const url = new URL((await createR2ViewUrl('deliverables/x/y/1_a.mp4', { downloadName: 'a b.mp4' }))!)
    expect(url.searchParams.get('response-content-disposition')).toBe('attachment; filename="a_b.mp4"')
  })
})

describe('sohbet görseli referansı', () => {
  it('r2 biçimi tanınır, oda ve gönderen çıkar', async () => {
    const { parseChatImageUrl, chatAttachmentR2Key, chatR2KeyParts } = await import('@/lib/chat-image')
    const ref = `r2://chat/${ROOM}/${USER}/1700000000_abc.webp`
    expect(parseChatImageUrl(`![image](${ref})`)).toBe(ref)
    expect(chatR2KeyParts(chatAttachmentR2Key(ref)!)).toEqual({ roomId: ROOM, senderId: USER })
    expect(parseChatImageUrl(`![image](r2://chat/${ROOM}/${USER}/../x.webp)`)).toBeNull()
    expect(parseChatImageUrl(`![image](r2://avatars/${ROOM}/x.webp)`)).toBeNull()
  })

  it('tam boy dosya referansı', async () => {
    const { parseChatImageUrl, chatAttachmentR2Key, chatAttachmentFullKey } = await import('@/lib/chat-image')
    const ref = `r2://chat/${ROOM}/${USER}/1700000000_abc.webp?full=jpg`
    expect(parseChatImageUrl(`![image](${ref})`)).toBe(ref)
    expect(chatAttachmentR2Key(ref)).toBe(`chat/${ROOM}/${USER}/1700000000_abc.webp`)
    expect(chatAttachmentFullKey(ref)).toBe(`chat/${ROOM}/${USER}/1700000000_abc_full.jpg`)
    expect(chatAttachmentFullKey(`r2://chat/${ROOM}/${USER}/1700000000_abc.webp`)).toBeNull()
    expect(parseChatImageUrl(`![image](r2://chat/${ROOM}/${USER}/1_a.webp?full=exe)`)).toBeNull()
  })
})

describe('teslimat dosyası referansı', () => {
  it('yalnızca beklenen biçim', async () => {
    const { parseDeliverableFileRef, deliverableFileKind } = await import('@/lib/deliverable-files-shared')
    const ref = `r2://deliverables/${ROOM}/${USER}/1700000000_abc.mov`
    expect(parseDeliverableFileRef(ref)).toMatchObject({ collaborationId: ROOM, uploaderId: USER, extension: 'mov' })
    expect(deliverableFileKind(ref)).toBe('video')
    expect(parseDeliverableFileRef('https://drive.google.com/file')).toBeNull()
    expect(parseDeliverableFileRef(`r2://chat/${ROOM}/${USER}/1_a.webp`)).toBeNull()
  })
})
