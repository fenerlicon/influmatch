'use client'

import './globals.css'

import { useEffect } from 'react'

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error using a logger or console
        console.error('Global Error caught:', error)
    }, [error])

    return (
        <html lang="tr">
            <body className="bg-[#0C0D10] text-white antialiased">
                <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
                        <h2 className="text-2xl font-bold text-white">Bir şeyler ters gitti!</h2>
                        <p className="mt-2 text-gray-400">Beklenmedik bir hata oluştu.</p>
                        <p className="mt-4 rounded-lg bg-red-500/10 p-2 font-mono text-xs text-red-400">
                            {error.message || 'Bilinmeyen Hata'}
                        </p>
                        <button
                            onClick={() => reset()}
                            className="mt-6 rounded-xl bg-white text-black px-6 py-2 font-semibold hover:bg-gray-200 transition-colors"
                        >
                            Tekrar Dene
                        </button>
                    </div>
                </div>
            </body>
        </html>
    )
}
