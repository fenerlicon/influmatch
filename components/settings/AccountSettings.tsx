'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Cookie, Download, KeyRound, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, ListRow } from '@/components/ui'
import { COOKIE_PREFERENCES_EVENT } from '@/lib/consent-shared'
import ChangePasswordModal from './ChangePasswordModal'
import DeleteAccountModal from './DeleteAccountModal'

export default function AccountSettings() {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // "Verilerimi indir" (KVKK erişim hakkı): /api/account/export, mobil ile aynı kod; 10 dakikada bir.
  const downloadData = async () => {
    setIsExporting(true)
    try {
      const response = await fetch('/api/account/export', { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        toast.error(body?.error || 'Veriler indirilemedi. Lütfen tekrar deneyin.')
        return
      }
      const fileName = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? 'influmatch-verilerim.json'
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      toast.error('Veriler indirilemedi. Bağlantını kontrol et.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Güvenlik" description="Şifreni güncelle ya da hesabını kapat." />
        <ListRow>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-ink">Şifre</p>
            <p className="text-xs text-ink-faint">Mevcut şifreni doğrulayıp yenisini belirlersin.</p>
          </div>
          <Button size="sm" leftIcon={<KeyRound />} onClick={() => setIsPasswordModalOpen(true)}>Şifre değiştir</Button>
        </ListRow>
        <ListRow>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-danger">Hesabı sil</p>
            <p className="text-xs text-ink-faint">Hesabın ve tüm verilerin kalıcı olarak silinir.</p>
          </div>
          <Button size="sm" variant="danger" leftIcon={<Trash2 />} onClick={() => setIsDeleteModalOpen(true)}>Hesabı sil</Button>
        </ListRow>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Verilerin"
          description={
            <>
              Hesabındaki verilerin kopyasını indir, çerez tercihini değiştir.{' '}
              <Link href="/legal?tab=privacy" className="text-ink underline underline-offset-2 hover:text-gold">
                Gizlilik
              </Link>
            </>
          }
        />
        <ListRow>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-ink">Verilerimi indir</p>
            <p className="text-xs text-ink-faint">Profil, teklif, iş birliği, yazdığın mesajlar ve diğer kayıtların (JSON dosyası).</p>
          </div>
          <Button size="sm" leftIcon={<Download />} onClick={downloadData} loading={isExporting}>İndir</Button>
        </ListRow>
        <ListRow>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] text-ink">Çerez tercihleri</p>
            <p className="text-xs text-ink-faint">İsteğe bağlı ölçüm araçlarına verdiğin izni değiştir.</p>
          </div>
          <Button size="sm" leftIcon={<Cookie />} onClick={() => window.dispatchEvent(new Event(COOKIE_PREFERENCES_EVENT))}>Değiştir</Button>
        </ListRow>
      </Card>

      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
      <DeleteAccountModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} />
    </>
  )
}
