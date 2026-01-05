'use client'

import Link from 'next/link'
import { Instagram, AlertTriangle } from 'lucide-react'

export default function InstagramVerificationBanner() {
    return (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-4 sm:px-6 lg:px-10 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-amber-500/10 blur-xl"></div>
            <div className="absolute bottom-0 left-0 -mb-4 -ml-4 h-24 w-24 rounded-full bg-amber-500/10 blur-xl"></div>

            <div className="relative mx-auto flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
                <div className="flex items-start gap-4">
                    <div className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Instagram className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-bold text-amber-500 flex items-center justify-center sm:justify-start gap-2">
                            <AlertTriangle className="h-4 w-4 sm:hidden" />
                            Instagram Hesabını Bağlaman Gerekiyor
                        </h3>
                        <p className="text-sm text-gray-300 max-w-3xl leading-relaxed">
                            Instagram hesabınızı doğrulamadan markalar size güvenemez ve işbirliğine sıcak bakmazlar.
                            <span className="text-white font-medium ml-1">Sadece kullanıcı adınızla şimdi Instagram hesabınızı bağlayın.</span>
                        </p>
                    </div>
                </div>
                <Link
                    href="/dashboard/influencer#verification-section"
                    className="flex-shrink-0 whitespace-nowrap rounded-xl bg-amber-500 px-6 py-2.5 text-sm font-bold text-black shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all hover:bg-amber-400 hover:scale-105 active:scale-95"
                >
                    Hesabı Bağla
                </Link>
            </div>
        </div>
    )
}
