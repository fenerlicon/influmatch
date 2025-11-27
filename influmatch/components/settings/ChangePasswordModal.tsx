'use client'

import { useState, useTransition } from 'react'
import { changePassword } from '@/app/dashboard/influencer/settings/actions'
import { X, Eye, EyeOff, Lock } from 'lucide-react'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
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
        setSuccess(true)
        setTimeout(() => {
          onClose()
          setCurrentPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setError(null)
          setSuccess(false)
        }, 2000)
      } else {
        setError(result.error || 'Şifre değiştirilemedi')
      }
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0E0F15] p-6 shadow-glow"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-gray-400 transition hover:border-white/50 hover:bg-black/80 hover:text-white"
          aria-label="Kapat"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-2">
            <Lock className="h-5 w-5 text-soft-gold" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Şifre Değiştir</h2>
            <p className="mt-1 text-sm text-gray-400">Hesap güvenliğiniz için şifrenizi güncelleyin</p>
          </div>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm font-medium text-emerald-200">Şifre başarıyla değiştirildi!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-gray-300">
                Mevcut Şifre
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white placeholder-gray-500 transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50"
                  placeholder="Mevcut şifrenizi girin"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
                >
                  {showCurrentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-gray-300">
                Yeni Şifre
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white placeholder-gray-500 transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50"
                  placeholder="Yeni şifrenizi girin (min. 6 karakter)"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-300">
                Yeni Şifre (Tekrar)
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isPending}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-white placeholder-gray-500 transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50"
                  placeholder="Yeni şifrenizi tekrar girin"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:opacity-50"
              >
                {isPending ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

