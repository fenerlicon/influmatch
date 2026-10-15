'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAccount } from '@/app/dashboard/influencer/settings/actions'
import PasswordInput from '@/components/auth/PasswordInput'
import { Button, Field, Input, Modal, Notice } from '@/components/ui'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

const CONFIRM_TEXT = 'SİL'

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const isConfirmed = confirmText === CONFIRM_TEXT

  const close = () => {
    if (isPending) return
    setConfirmText('')
    setPassword('')
    setError(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!isConfirmed) {
      setError(`Onaylamak için "${CONFIRM_TEXT}" yazın`)
      return
    }
    if (!password) {
      setError('Şifrenizi girin')
      return
    }
    startTransition(async () => {
      const result = await deleteAccount(password)
      if (result.success) {
        if (result.redirect) {
          router.push(result.redirect)
          router.refresh()
        } else {
          router.push('/login')
        }
      } else {
        setError(result.error || 'Hesap silinemedi')
      }
    })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      dismissible={!isPending}
      size="sm"
      title="Hesabı sil"
      description="Bu işlem geri alınamaz."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close} disabled={isPending} data-autofocus>Vazgeç</Button>
          <Button variant="danger" size="sm" type="submit" form="delete-account" loading={isPending} disabled={!isConfirmed || !password}>
            Hesabı sil
          </Button>
        </>
      }
    >
      <form id="delete-account" onSubmit={handleSubmit} className="grid gap-4">
        <ul className="grid gap-1 text-[13px] text-ink-muted">
          <li>• Tüm verileriniz kalıcı olarak silinecektir.</li>
          <li>• Profiliniz artık görüntülenemeyecektir.</li>
          <li>• Aktif Spotlight üyeliğiniz varsa hesabınızla birlikte sona erer.</li>
        </ul>
        <Field label={`Onaylamak için "${CONFIRM_TEXT}" yazın`}>
          {(props) => (
            <Input {...props} value={confirmText} onChange={(e) => setConfirmText(e.target.value.toLocaleUpperCase('tr-TR'))} disabled={isPending} placeholder={CONFIRM_TEXT} autoComplete="off" />
          )}
        </Field>
        <Field label="Şifreniz">
          {(props) => (
            <PasswordInput {...props} value={password} onChange={(e) => setPassword(e.target.value)} disabled={isPending} placeholder="Mevcut şifreniz" autoComplete="current-password" />
          )}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  )
}
