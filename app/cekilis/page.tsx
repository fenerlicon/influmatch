'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Gift, Sparkles, PartyPopper, Search, User } from 'lucide-react'
import { toast } from 'sonner'
import { getDrawResult } from './actions'

export default function GiveawayPage() {
    const [name, setName] = useState('')
    const [result, setResult] = useState<{ match: string; user: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleDraw = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return

        setLoading(true)
        setError('')

        try {
            const response = await getDrawResult(name)

            if (!response.success && response.error) {
                setError(response.error)
                toast.error(response.error)
            } else if (response.success && response.match && response.user) {
                setResult({ match: response.match, user: response.user })
                toast.success(`Hoş geldin ${response.user}!`, {
                    description: 'Eşleşmen başarıyla getirildi.'
                })
            }
        } catch (err) {
            setError('Beklenmedik bir hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const resetSearch = () => {
        setResult(null)
        setName('')
        setError('')
    }

    return (
        <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#050506]">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-yellow-500/10 blur-[120px]" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />
                <div className="grid-overlay opacity-30" />
            </div>

            <div className="container relative z-10 px-4 md:px-6">
                <div className="mx-auto max-w-2xl text-center">

                    {/* Header Badge */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="mb-8 flex justify-center"
                    >
                        <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-500 backdrop-blur-md">
                            <Sparkles className="h-4 w-4" />
                            2025 Özel Çekilişi
                        </span>
                    </motion.div>

                    {/* Main Content */}
                    <AnimatePresence mode="wait">
                        {!result ? (
                            <motion.div
                                key="input-section"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.5 }}
                            >
                                <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
                                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600">
                                        Kim Çıktı?
                                    </span>
                                </h1>

                                <p className="mx-auto mb-8 max-w-lg text-lg text-gray-400">
                                    İsmini aşağıdaki kutuya yaz ve bu yıl kime hediye alacağını hemen öğren!
                                </p>

                                <div className="mx-auto max-w-md">
                                    <form onSubmit={handleDraw} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-white/20">
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <label htmlFor="name" className="sr-only">İsminiz</label>
                                                <div className="relative">
                                                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                                    <input
                                                        id="name"
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) => setName(e.target.value)}
                                                        placeholder="İsminizi girin..."
                                                        className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                                                    />
                                                </div>
                                            </div>

                                            {error && (
                                                <p className="text-sm text-red-500 text-left px-1 font-medium">
                                                    {error}
                                                </p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={loading || !name.trim()}
                                                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 px-8 py-3.5 font-semibold text-black transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-500/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                            >
                                                <span className="relative z-10 flex items-center justify-center gap-2">
                                                    {loading ? 'Aranıyor...' : 'Eşleşmeyi Gör'}
                                                    {!loading && <Search className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                                                </span>
                                                <div className="absolute inset-0 bg-white/20 transition-transform duration-300 group-hover:translate-x-full" />
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="result-section"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ type: "spring", duration: 0.6 }}
                                className="mx-auto max-w-lg"
                            >
                                <div className="relative overflow-hidden rounded-3xl border border-yellow-500/30 bg-gradient-to-b from-yellow-500/10 to-transparent p-1">
                                    <div className="absolute inset-0 bg-yellow-500/5 blur-xl" />
                                    <div className="relative rounded-[22px] bg-[#0A0A0C] p-8 md:p-12">

                                        <div className="mb-8 flex justify-center">
                                            <div className="relative">
                                                <div className="absolute -inset-4 rounded-full bg-yellow-500/20 blur-lg animate-pulse" />
                                                <div className="relative rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 p-6 shadow-xl shadow-yellow-500/20">
                                                    <Gift className="h-12 w-12 text-black" />
                                                </div>
                                                <PartyPopper className="absolute -right-8 -top-4 h-12 w-12 rotate-12 text-yellow-500 animate-bounce" />
                                            </div>
                                        </div>

                                        <h2 className="mb-2 text-lg font-medium text-gray-400 uppercase tracking-widest">
                                            Hediye Alacağın Kişi
                                        </h2>

                                        <div className="mb-8 overflow-hidden rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
                                            <motion.div
                                                initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                                transition={{ delay: 0.3, duration: 0.8 }}
                                            >
                                                <span className="block text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-300 to-yellow-500 md:text-5xl">
                                                    {result.match}
                                                </span>
                                            </motion.div>
                                        </div>

                                        <p className="mb-8 text-gray-500 text-sm">
                                            Bu bir sır, çaktırma! 🤫
                                        </p>

                                        <button
                                            onClick={resetSearch}
                                            className="text-sm text-gray-500 hover:text-white transition-colors underline decoration-dotted"
                                        >
                                            Başka biri için sorgula
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.5, delay: 0.4 }}
                        className="mt-8 text-center"
                    >
                        <p className="text-xs text-white">
                            * Sonuçlar otomatik olarak belirlenmiştir ve değiştirilemez.
                        </p>
                    </motion.div>
                </div>
            </div>
        </main>
    )
}
