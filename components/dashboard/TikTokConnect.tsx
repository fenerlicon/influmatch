
'use client'

import { BadgeCheck } from 'lucide-react'

interface TikTokConnectProps {
  userId: string
  isVerified?: boolean
  username?: string | null
}

export default function TikTokConnect({ userId, isVerified = false, username = '' }: TikTokConnectProps) {
  const handleConnect = () => {
    window.location.href = '/api/auth/tiktok/login'
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Resmi Hesap Bağlantısı</p>
        <h3 className="mt-2 text-xl font-semibold text-white">TikTok Hesabını Bağla</h3>
        <p className="mt-1 text-sm text-gray-400">
          Gerçek takipçi ve izlenme verilerini markalarla paylaşmak için hesabını bağla.
        </p>
      </div>

      {!isVerified ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-gray-300">
            <ul className="list-inside list-disc space-y-1">
              <li>Takipçi sayınız otomatik güncellenir.</li>
              <li>Video performanslarınız analiz edilir.</li>
              <li>Markalar için %100 doğrulanmış rozeti alırsınız.</li>
            </ul>
          </div>
          
          <button
            onClick={handleConnect}
            className="flex items-center justify-center gap-3 rounded-xl bg-white px-6 py-4 text-sm font-bold text-black transition hover:bg-gray-200 active:scale-95"
          >
            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
            </svg>
            TikTok ile Giriş Yap / Hesabı Bağla
          </button>
          
          <p className="text-[10px] italic text-gray-500 text-center">
            Log in with TikTok sayfasına yönlendirileceksiniz.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400 border border-green-500/20">
              <BadgeCheck className="h-6 w-6 shadow-[0_0_10px_rgba(34,197,94,0.3)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">TikTok Bağlı</h3>
                <span className="rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400 uppercase tracking-tighter">
                  Doğrulanmış
                </span>
              </div>
              <p className="text-sm text-gray-400">
                @{username} hesabı başarıyla eşleştirildi.
              </p>
            </div>
          </div>

          <button
            onClick={handleConnect}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            Hesabı Güncelle / Değiştir
          </button>
        </div>
      )}
    </div>
  )
}
