'use client'

import { useState } from 'react'
import { KeyRound, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, ListRow } from '@/components/ui'
import ChangePasswordModal from './ChangePasswordModal'
import DeleteAccountModal from './DeleteAccountModal'

export default function AccountSettings() {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

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

      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
      <DeleteAccountModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} />
    </>
  )
}
