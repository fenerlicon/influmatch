'use client'

import { useState } from 'react'
import ChangePasswordModal from './ChangePasswordModal'
import DeleteAccountModal from './DeleteAccountModal'

export default function AccountSettings() {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold text-white">Hesap Ayarları</h2>
        <p className="mt-1 text-sm text-gray-400">Hesap güvenliğinizi ve tercihlerinizi yönetin.</p>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Şifre Değiştir</p>
                <p className="mt-1 text-xs text-gray-400">Hesabınızın şifresini güncelleyin.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
              >
                Şifre Değiştir
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-200">Hesabı Sil</p>
                <p className="mt-1 text-xs text-red-300/70">Hesabınızı ve tüm verilerinizi kalıcı olarak silin.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="rounded-xl border border-red-500/60 bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-500 hover:bg-red-500/30"
              >
                Hesabı Sil
              </button>
            </div>
          </div>
        </div>
      </section>

      <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />
      <DeleteAccountModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} />
    </>
  )
}
