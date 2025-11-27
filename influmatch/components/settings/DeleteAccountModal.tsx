'use client'

import { useState, useTransition } from 'react'
import { deleteAccount } from '@/app/dashboard/influencer/settings/actions'
import { X, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DeleteAccountModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const CONFIRM_TEXT = 'SİL'
  const isConfirmed = confirmText === CONFIRM_TEXT

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isConfirmed) {
      setError(`Onaylamak için "${CONFIRM_TEXT}" yazın`)
      return
    }

    startTransition(async () => {
      const result = await deleteAccount()
      
      if (result.success) {
        // Redirect to login
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-red-500/30 bg-[#0E0F15] p-6 shadow-glow"
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
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2">
            <AlertTriangle className="h-5 w-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-red-200">Hesabı Sil</h2>
            <p className="mt-1 text-sm text-red-300/70">Bu işlem geri alınamaz</p>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">
              Hesabınızı silmek istediğinizden emin misiniz? Bu işlem:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-red-300/80">
              <li>• Tüm profil bilgilerinizi kalıcı olarak silecek</li>
              <li>• Tüm mesajlarınızı ve konuşmalarınızı silecek</li>
              <li>• Tüm teklif ve başvurularınızı silecek</li>
              <li>• Bu işlem geri alınamaz</li>
            </ul>
          </div>

          <div>
            <label htmlFor="confirmText" className="mb-2 block text-sm font-medium text-gray-300">
              Onaylamak için <span className="font-mono font-bold text-red-400">{CONFIRM_TEXT}</span> yazın
            </label>
            <input
              id="confirmText"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              disabled={isPending}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition focus:border-red-500/50 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:opacity-50"
              placeholder={CONFIRM_TEXT}
              autoComplete="off"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-3">
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
            disabled={isPending || !isConfirmed}
            className="flex-1 rounded-xl border border-red-500/60 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-500 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Siliniyor...' : 'Hesabı Kalıcı Olarak Sil'}
          </button>
        </form>
      </div>
    </div>
  )
}

