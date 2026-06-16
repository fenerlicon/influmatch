import { AlertTriangle, Clock } from 'lucide-react'

interface TikTokConnectProps {
  userId: string
  isVerified?: boolean
  username?: string | null
}

export default function TikTokConnect({ userId, isVerified = false, username = '' }: TikTokConnectProps) {
  return (
    <div className="w-full relative overflow-hidden rounded-3xl border border-yellow-500/10 bg-gradient-to-br from-white/[0.02] to-transparent p-6 sm:p-8">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full bg-yellow-500/5 blur-2xl animate-pulse" />

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Resmi Hesap Bağlantısı</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-500">
            <Clock className="h-3 w-3" />
            Bakımda
          </span>
        </div>
        <h3 className="mt-3 text-xl font-semibold text-white/90">TikTok Hesabını Bağla</h3>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">
          TikTok API altyapımız güncelleme ve yapılandırma çalışmaları nedeniyle geçici bir süre bakımdadır.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Informative alert box */}
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5 text-sm text-gray-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500/80 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white/90">Neler Geliyor?</p>
              <ul className="mt-2 list-inside list-disc space-y-1.5 text-gray-400">
                <li>Takipçi ve beğeni sayılarının anlık senkronizasyonu</li>
                <li>Video izlenme ve etkileşim oranlarının otomatik analizi</li>
                <li>Profilinizde doğrulanmış TikTok rozetiyle öne çıkma</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Disabled TikTok button */}
        <button
          disabled
          className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 px-6 py-4 text-sm font-semibold text-gray-500 cursor-not-allowed transition"
        >
          <svg className="h-5 w-5 fill-current opacity-30" viewBox="0 0 24 24">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.13-1.47V18c0 1.94-.93 3.88-2.82 4.74-1.89.86-4.2.78-6.12-.21-1.92-.99-3.32-3.13-3.34-5.32-.02-2.19 1.34-4.39 3.25-5.46 1.17-.65 2.52-.93 3.86-.81V15c-.82-.12-1.7.07-2.41.52-.71.45-1.22 1.25-1.25 2.09-.03.84.4 1.68 1.05 2.18.65.5 1.53.64 2.34.42 1.4-.38 2.02-1.81 2.02-3.14V.02h.43z"/>
          </svg>
          TikTok Entegrasyonu Çok Yakında
        </button>

        <p className="text-[10px] italic text-gray-500 text-center">
          Alt yapı çalışmaları tamamlandığında TikTok hesap doğrulama sistemi otomatik olarak açılacaktır.
        </p>
      </div>
    </div>
  )
}
