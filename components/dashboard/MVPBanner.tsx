'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function MVPBanner() {
    return (
        <div className="border-b border-indigo-500/30 bg-indigo-500/10 px-4 py-3 sm:px-6 lg:px-10">
            <div className="mx-auto flex items-center justify-center gap-3 text-sm text-indigo-200">
                <AlertTriangle className="h-4 w-4 text-indigo-400" />
                <p className="font-medium">
                    Bu bir <span className="font-bold text-white">MVP</span> (Minimum Viable Product) sürümüdür.{' '}
                    <Link href="/feedback" className="underline underline-offset-4 hover:text-white transition-colors">
                        Hata ve geribildirimlerinizi bizimle paylaşın.
                    </Link>
                </p>
            </div>
        </div>
    )
}
