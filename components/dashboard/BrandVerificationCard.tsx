'use client'

import { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Link from 'next/link'

interface BrandVerificationCardProps {
  userId: string
  initialVerificationStatus?: 'pending' | 'verified' | 'rejected'
}

export default function BrandVerificationCard({
  userId,
  initialVerificationStatus = 'pending',
}: BrandVerificationCardProps) {
  const supabase = useSupabaseClient()
  const [verificationStatus, setVerificationStatus] = useState(initialVerificationStatus)
  const showVerificationCard = verificationStatus === 'pending'

  // users tablosu realtime yayınında değil (gizli kolonlar sızmasın diye); bu yüzden durum,
  // sekmeye geri dönüldüğünde yeniden okunur. Admin onayı sayfa yenilenmeden de görünür.
  useEffect(() => {
    if (verificationStatus !== 'pending') return
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      const { data } = await supabase.from('users').select('verification_status').eq('id', userId).maybeSingle()
      const next = data?.verification_status as 'pending' | 'verified' | 'rejected' | undefined
      if (next) setVerificationStatus(next)
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [userId, supabase, verificationStatus])

  if (!showVerificationCard) {
    return null
  }

  return (
    <div className="rounded-3xl border border-yellow-500/30 bg-yellow-500/10 p-6">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-yellow-200">Hesap Doğrulama Kılavuzu</h3>
          <p className="mt-2 text-sm text-yellow-100/90">
            Hesabının daha hızlı onaylanması için profil bilgilerini eksiksiz doldur ve en az 1 adet sosyal
            medya hesabı ekle.
          </p>
          <Link
            href="/dashboard/brand/profile"
            className="mt-3 inline-block rounded-xl border border-yellow-400/60 bg-yellow-500/20 px-4 py-2 text-sm font-semibold text-yellow-200 transition hover:border-yellow-400 hover:bg-yellow-500/30"
          >
            Profil Ayarlarına Git
          </Link>
        </div>
      </div>
    </div>
  )
}

