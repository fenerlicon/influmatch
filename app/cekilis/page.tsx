'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, KeyRound, Lock, LockKeyhole, Unlock, ArrowRight, User } from 'lucide-react'
import { toast } from 'sonner'
import { getDrawResult } from './actions'

type AnimationState = 'idle' | 'checking' | 'unlocking' | 'breaking' | 'success' | 'error'

export default function GiveawayPage() {
    const [name, setName] = useState('')
    const [pin, setPin] = useState('')
    const [result, setResult] = useState<{ match: string; user: string } | null>(null)
    const [animState, setAnimState] = useState<AnimationState>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [lockedName, setLockedName] = useState<string | null>(null)

    // Check for existing session
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('influmatch_giveaway_user_v1')
            if (saved) {
                setLockedName(saved)
                setName(saved)
            }
        }
    }, [])

    const handleDraw = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !pin.trim()) return

        if (lockedName && name.toLowerCase().trim() !== lockedName.toLowerCase().trim()) {
            toast.error('Erişim engellendi', { description: `Bu tarayıcı ${lockedName} adına kilitlenmiştir.` })
            return
        }

        setAnimState('checking')
        setErrorMsg('')

        // Artificial delay for tension
        await new Promise(r => setTimeout(r, 800))

        try {
            const response = await getDrawResult(name, pin)

            if (!response.success) {
                // Wrong code or name
                setAnimState('breaking')
                setTimeout(() => {
                    setErrorMsg(response.error || 'Kod hatalı! Başkalarının bilgilerine erişmeye çalışma.')
                    toast.error('Giriş Başarısız', { description: response.error || 'Kod hatalı veya isim yanlış.' })
                    setAnimState('idle') // Return to input after animation
                }, 2500) // Wait for breaking animation
            } else if (response.match && response.user) {
                // Success
                if (!lockedName) {
                    setLockedName(response.user)
                    localStorage.setItem('influmatch_giveaway_user_v1', response.user)
                }
                setResult({ match: response.match, user: response.user })
                setAnimState('unlocking')
                // Transition to specific success view after unlock animation
                setTimeout(() => {
                    setAnimState('success')
                }, 2000)
            }
        } catch (err) {
            setAnimState('idle')
            toast.error('Beklenmedik bir hata oluştu.')
        }
    }

    const resetSearch = () => {
        setResult(null)
        setPin('')
        setAnimState('idle')
        if (!lockedName) setName('')
    }

    // Animation Variants
    const keyVariants = {
        idle: { x: 0, rotate: 0, opacity: 1 },
        checking: { x: 60, rotate: 0, transition: { duration: 0.5, ease: "easeInOut" } as any },
        unlocking: {
            x: 60,
            rotate: 90,
            transition: { duration: 0.4, delay: 0.1 }
        },
        breaking: {
            x: 60,
            rotate: [0, -10, 10, -10, 10, 0],
            transition: { duration: 0.5 }
        }
    }

    const lockVariants = {
        idle: { scale: 1, rotate: 0, color: "#9CA3AF" }, // gray-400
        checking: { scale: 1.1, color: "#FBBF24" }, // yellow-400
        unlocking: {
            scale: 1.2,
            color: "#34D399", // green-400
            transition: { duration: 0.3 }
        },
        breaking: {
            scale: [1, 1.2, 1.2, 1.1],
            rotate: [0, -5, 5, -5, 5, 0],
            color: "#EF4444", // red-500
            transition: { duration: 0.5 }
        }
    }

    return (
        <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#050506]">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-yellow-500/10 blur-[120px]" />
                <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />
                <div className="grid-overlay opacity-30" />

                {animState === 'success' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.03, scale: 1 }}
                        transition={{ duration: 2 }}
                        className="absolute inset-0 flex items-center justify-center z-0"
                    >
                        <h1 className="text-[10vw] font-black leading-none text-white text-center select-none whitespace-pre-line tracking-tighter">
                            BU BİZİM{'\n'}ARAMIZDA{'\n'}BİR SIR
                        </h1>
                    </motion.div>
                )}
            </div>

            <div className="container relative z-10 px-4 md:px-6">

                {/* Animation Overlay for Unlock/Break */}
                <AnimatePresence>
                    {(animState === 'checking' || animState === 'unlocking' || animState === 'breaking') && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl"
                        >
                            <div className="relative flex items-center justify-center gap-8 mb-8 scale-150">
                                {/* Key Graphic */}
                                <motion.div
                                    variants={keyVariants}
                                    initial="idle"
                                    animate={animState}
                                    className="relative z-10"
                                >
                                    {animState === 'breaking' ? (
                                        // Broken Key Representation
                                        <div className="relative">
                                            <motion.div
                                                initial={{ x: 0, y: 0, rotate: 0 }}
                                                animate={{ x: -20, y: 20, rotate: -45, opacity: 0 }}
                                                transition={{ delay: 0.4, duration: 0.5 }}
                                            >
                                                <KeyRound className="h-12 w-12 text-red-500" />
                                            </motion.div>
                                            <motion.div
                                                className="absolute top-0 left-0"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1, scale: [1, 2, 0] }}
                                                transition={{ delay: 0.4, duration: 0.3 }}
                                            >
                                                <div className="h-12 w-12 rounded-full border-2 border-red-500" />
                                            </motion.div>
                                        </div>
                                    ) : (
                                        <KeyRound className="h-12 w-12 text-yellow-500" />
                                    )}
                                </motion.div>

                                {/* Lock Graphic */}
                                <motion.div
                                    variants={lockVariants}
                                    initial="idle"
                                    animate={animState}
                                >
                                    {animState === 'unlocking' ? (
                                        <Unlock className="h-16 w-16" />
                                    ) : (
                                        <LockKeyhole className="h-16 w-16" />
                                    )}
                                </motion.div>
                            </div>

                            {animState === 'breaking' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-center"
                                >
                                    <p className="text-2xl font-bold text-red-500 mb-2">HATA</p>
                                    <p className="text-white/70">Kilit açılamadı.</p>
                                </motion.div>
                            )}
                            {animState === 'unlocking' && (
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-xl font-bold text-green-400"
                                >
                                    KİLİT AÇILIYOR...
                                </motion.p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="mx-auto max-w-2xl text-center">

                    {/* Header Badge */}
                    {animState !== 'success' && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-8 flex justify-center"
                        >
                            <span className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm font-medium text-yellow-500 backdrop-blur-md">
                                <Sparkles className="h-4 w-4" />
                                2025 Özel Çekilişi
                            </span>
                        </motion.div>
                    )}

                    <AnimatePresence mode="wait">
                        {animState !== 'success' ? (
                            <motion.div
                                key="input-form"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                            >
                                <h1 className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
                                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-yellow-400 to-yellow-600">
                                        Kim Çıktı?
                                    </span>
                                </h1>

                                <p className="mx-auto mb-8 max-w-lg text-lg text-gray-400">
                                    {lockedName
                                        ? `Hoş geldin ${lockedName}.`
                                        : "İsmini ve sana özel verilen kodu gir, aramızdaki sırrı öğren."
                                    }
                                </p>

                                <div className="mx-auto max-w-md">
                                    <form onSubmit={handleDraw} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl transition-all hover:bg-white/10 hover:border-white/20">
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <label className="text-xs font-medium text-gray-400 ml-1 mb-1 block text-left">İsim</label>
                                                <div className="relative">
                                                    {lockedName ? (
                                                        <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-yellow-500" />
                                                    ) : (
                                                        <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                                    )}
                                                    <input
                                                        type="text"
                                                        value={name}
                                                        onChange={(e) => !lockedName && setName(e.target.value)}
                                                        readOnly={!!lockedName}
                                                        placeholder="Adın..."
                                                        className={`w-full rounded-xl border bg-black/40 py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-1 ${lockedName
                                                                ? 'border-yellow-500/30 text-yellow-500/90 cursor-not-allowed'
                                                                : 'border-white/10 focus:border-yellow-500/50 focus:ring-yellow-500/50'
                                                            }`}
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-medium text-gray-400 ml-1 mb-1 block text-left">Güvenlik Kodu</label>
                                                <div className="relative">
                                                    <div className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 flex items-center justify-center">
                                                        <KeyRound className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={pin}
                                                        onChange={(e) => setPin(e.target.value)}
                                                        placeholder="******"
                                                        maxLength={6}
                                                        className="w-full rounded-xl border border-white/10 bg-black/40 py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 font-mono tracking-widest text-center"
                                                    />
                                                </div>
                                            </div>

                                            {errorMsg && (
                                                <motion.p
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="text-sm text-red-500 text-left px-1 font-medium"
                                                >
                                                    {errorMsg}
                                                </motion.p>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={animState !== 'idle' || !name.trim() || !pin.trim()}
                                                className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-600 px-8 py-3.5 font-semibold text-black transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-500/25 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                                            >
                                                <span className="relative z-10 flex items-center justify-center gap-2">
                                                    {animState === 'idle' ? 'Kilidi Aç' : 'Kontrol Ediliyor...'}
                                                    {animState === 'idle' && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
                                                </span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="result-view"
                                initial={{ opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
                                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="mx-auto max-w-xl relative"
                            >
                                {/* Magical Glow Background */}
                                <div className="absolute -inset-20 bg-gradient-to-r from-yellow-500/20 via-purple-500/20 to-pink-500/20 blur-3xl opacity-50 animate-pulse" />

                                <div className="relative rounded-3xl bg-black/60 border border-white/10 backdrop-blur-2xl p-12 shadow-2xl overflow-hidden">
                                    <motion.div
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        <h2 className="text-sm font-medium text-yellow-500 uppercase tracking-[0.3em] mb-6">
                                            Eşleşmen
                                        </h2>
                                    </motion.div>

                                    <motion.div
                                        initial={{ scale: 2, opacity: 0, rotate: -5 }}
                                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                        transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
                                        className="mb-8"
                                    >
                                        <h3 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-yellow-300 to-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                                            {result?.match}
                                        </h3>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 1.5 }}
                                    >
                                        <p className="text-gray-400 font-light italic">
                                            "Bu hediye kalpten gelmeli..."
                                        </p>
                                    </motion.div>

                                    <motion.button
                                        onClick={resetSearch}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 3 }}
                                        className="mt-8 text-xs text-white/30 hover:text-white transition-colors"
                                    >
                                        Çıkış Yap (Ekranı Kapat)
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Footer Warning */}
                    <motion.div
                        className="fixed bottom-4 left-0 right-0 text-center pointer-events-none"
                        animate={{ opacity: animState === 'success' ? 0 : 0.5 }}
                    >
                        <p className="text-[10px] text-white">
                            * İzinsiz giriş denemeleri kayıt altına alınmaktadır.
                        </p>
                    </motion.div>

                </div>
            </div>
        </main>
    )
}
