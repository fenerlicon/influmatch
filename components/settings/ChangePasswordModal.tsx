'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { changePassword } from '@/app/dashboard/influencer/settings/actions'
import PasswordInput from '@/components/auth/PasswordInput'
import { Button, Field, Modal, Notice } from '@/components/ui'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const close = () => {
    if (isPending) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tüm alanlar doldurulmalıdır')
      return
    }
    if (newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalıdır')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifreler eşleşmiyor')
      return
    }
    if (currentPassword === newPassword) {
      setError('Yeni şifre mevcut şifre ile aynı olamaz')
      return
    }

    startTransition(async () => {
      const result = await changePassword(currentPassword, newPassword)
      if (result.success) {
        toast.success('Şifren güncellendi.')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        onClose()
      } else {
        setError(result.error || 'Şifre değiştirilemedi')
      }
    })
  }

  return (
    <Modal
      open={isOpen}
      onClose={close}
      dismissible={!isPending}
      size="sm"
      title="Şifre değiştir"
      description="Mevcut şifreni doğrulayıp yeni şifreni belirle."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={close} disabled={isPending}>Vazgeç</Button>
          <Button variant="primary" size="sm" type="submit" form="change-password" loading={isPending}>Şifreyi güncelle</Button>
        </>
      }
    >
      <form id="change-password" onSubmit={handleSubmit} className="grid gap-4">
        <Field label="Mevcut şifre">
          {(props) => <PasswordInput {...props} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />}
        </Field>
        <Field label="Yeni şifre" hint="En az 6 karakter">
          {(props) => <PasswordInput {...props} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />}
        </Field>
        <Field label="Yeni şifre (tekrar)" error={confirmPassword && newPassword !== confirmPassword ? 'Şifreler eşleşmiyor.' : undefined}>
          {(props) => <PasswordInput {...props} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />}
        </Field>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  )
}
