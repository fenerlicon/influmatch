'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Lock, Mail, UserCheck, ShieldAlert, ArrowRight } from 'lucide-react'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'

interface BrandLockScreenProps {
  status?: 'pending' | 'rejected'
}

export default function BrandLockScreen({ status = 'pending' }: BrandLockScreenProps) {
  const router = useRouter()
  const { signOut } = useSupabaseAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut()
      router.replace('/login')
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const isPending = status === 'pending'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521]/90 to-[#0C0D10]/95 p-8 backdrop-blur-md shadow-glow">
        
        {/* Glow Effects */}
        {isPending ? (
          <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-soft-gold/10 blur-3xl pointer-events-none"></div>
        ) : (
          <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-red-500/10 blur-3xl pointer-events-none"></div>
        )}
        <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-[#1e2030]/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center gap-6">
          {/* Main Icon */}
          <div className={`rounded-full p-5 ring-1 ${
            isPending 
              ? 'bg-soft-gold/10 ring-soft-gold/30 shadow-[0_0_20px_rgba(212,175,55,0.15)]' 
              : 'bg-red-500/10 ring-red-500/30'
          }`}>
            {isPending ? (
              <Lock className="h-10 w-10 text-soft-gold" />
            ) : (
              <ShieldAlert className="h-10 w-10 text-red-500" />
            )}
          </div>

          {/* Heading */}
          <div className="space-y-3">
            <h2 className="text-2xl font-bold text-white tracking-wide">
              {isPending ? 'Hesap Onayı Bekleniyor' : 'Erişim Engellendi'}
            </h2>
            <p className="text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
              {isPending 
                ? 'Influencer vitrinini, detaylı istatistikleri ve iş birliği tekliflerini görüntülemek için hesabınızın yönetici tarafından onaylanması gerekmektedir. Güvenli bir topluluk sağlamak adına markaları manuel olarak onaylıyoruz.'
                : 'Hesabınız onaylanmamış veya kullanım koşullarına aykırı hareket nedeniyle askıya alınmıştır. Ayrıntılar için destek ekibimiz ile iletişime geçebilirsiniz.'}
            </p>
          </div>

          {/* Verification Steps Visual (Only for Pending) */}
          {isPending && (
            <div className="w-full rounded-2xl bg-white/5 border border-white/5 p-5 text-left space-y-4 my-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-soft-gold">Onay Süreci</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                    <UserCheck className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-medium text-gray-200">Hesap Kaydı & Profil Kurulumu (Tamamlandı)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-soft-gold/20 text-soft-gold">
                    <span className="h-1.5 w-1.5 rounded-full bg-soft-gold"></span>
                  </div>
                  <span className="text-xs font-medium text-gray-200">Yönetici İncelemesi & Onay (Bekleniyor)</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="w-full space-y-3 pt-2">
            {isPending ? (
              <Link
                href="/dashboard/brand/profile"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 py-3 text-sm font-semibold text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.15)] transition hover:border-soft-gold hover:bg-soft-gold/20"
              >
                <span>Profil Ayarlarına Git</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <a
                href="mailto:destek@influmatch.net"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                <Mail className="h-4 w-4" />
                <span>İletişime Geç (destek@influmatch.net)</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
