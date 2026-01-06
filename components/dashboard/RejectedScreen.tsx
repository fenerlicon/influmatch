'use client'

import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function RejectedScreen() {
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

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0C10] p-4 text-center">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-red-500/20 bg-[#151621] p-8 shadow-[0_0_50px_-10px_rgba(220,38,38,0.3)]">
                {/* Background Glow */}
                <div className="absolute -top-20 -left-20 h-40 w-40 rounded-full bg-red-500/10 blur-3xl"></div>
                <div className="absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-red-500/10 blur-3xl"></div>

                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="rounded-full bg-red-500/10 p-4 ring-1 ring-red-500/30">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-12 w-12 text-red-500"
                        >
                            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-white">Hesabınız Askıya Alındı</h1>
                        <p className="text-gray-400">
                            Hesabınız yönetici tarafından reddedilmiş veya kullanım koşullarına aykırı hareket nedeniyle askıya alınmıştır.
                        </p>
                    </div>

                    <div className="w-full space-y-3">
                        <a
                            href="mailto:destek@influmatch.net"
                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                            >
                                <rect width="20" height="16" x="2" y="4" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                            İtiraz İçin İletişime Geç
                        </a>

                        <button
                            type="button"
                            onClick={handleSignOut}
                            disabled={isLoading}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-3 text-sm font-semibold text-gray-400 transition hover:bg-white/5 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Çıkış Yapılıyor...' : 'Çıkış Yap'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
