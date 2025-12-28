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

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('influmatch_giveaway_user_v1')
            if (saved) {
                setLockedName(saved)
                setName(saved)
            }
        }
    }, [])

    // Sound Effects
    const playSound = (type: 'success' | 'error' | 'checking') => {
        const sounds = {
            success: 'https://assets.mixkit.co/sfx/preview/mixkit-magic-marimba-chime-287.mp3',
            error: 'https://assets.mixkit.co/sfx/preview/mixkit-negative-answer-lose-2032.mp3',
            checking: 'https://assets.mixkit.co/sfx/preview/mixkit-revolver-chamber-spin-3135.mp3'
        }
        const audio = new Audio(sounds[type])
        audio.volume = 0.5
        audio.play().catch(() => { }) // Ignore autoplay errors
    }

    const handleDraw = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || !pin.trim()) return

        if (lockedName && name.toLowerCase().trim() !== lockedName.toLowerCase().trim()) {
            playSound('error')
            toast.error('Erişim engellendi', { description: `Bu tarayıcı ${lockedName} adına kilitlenmiştir.` })
            return
        }

        setAnimState('checking')
        playSound('checking')
        setErrorMsg('')

        // Tension build-up
        await new Promise(r => setTimeout(r, 1500))

        try {
            const response = await getDrawResult(name, pin)

            if (!response.success) {
                setAnimState('breaking')
                playSound('error')
                setTimeout(() => {
                    setErrorMsg(response.error || 'Kod hatalı! Erişim reddedildi.')
                    toast.error('Giriş Başarısız', { description: response.error || 'Hatalı kod veya isim.' })
                    setAnimState('idle')
                }, 3000)
            } else if (response.match && response.user) {
                if (!lockedName) {
                    setLockedName(response.user)
                    localStorage.setItem('influmatch_giveaway_user_v1', response.user)
                }
                setResult({ match: response.match, user: response.user })

                setTimeout(() => {
                    setAnimState('unlocking')
                    playSound('success')
                }, 100)

                setTimeout(() => {
                    setAnimState('success')
                }, 2500)
            }
        } catch (err) {
            setAnimState('idle')
            playSound('error')
            toast.error('Sistem hatası.')
        }
    }

    const resetSearch = () => {
        setResult(null)
        setPin('')
        setAnimState('idle')
        if (!lockedName) setName('')
    }

    return (
        <main className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#050506] font-sans selection:bg-yellow-500/30">
            {/* Ambient Background */}
            <div className="absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/50 via-[#050506] to-[#050506]" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-yellow-600/10 rounded-full blur-[128px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[128px] animate-pulse delay-1000" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay" />
            </div>

            {/* Secret Message Overlay */}
            {animState === 'success' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.1 }}
                    transition={{ duration: 3 }}
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none overflow-hidden"
                >
                    <h1 className="text-[12vw] font-black leading-none text-white text-center tracking-tighter opacity-50 blur-sm scale-150">
                        MUTLU{'\n'}YILLAR
                    </h1>
                </motion.div>
            )}

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center">

                {/* 3D Animation Overlay */}
                <AnimatePresence>
                    {(animState === 'checking' || animState === 'unlocking' || animState === 'breaking') && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl perspective-1000"
                        >
                            <div className="relative w-64 h-64 flex items-center justify-center">
                                {/* The Lock Device */}
                                <motion.div
                                    initial={{ scale: 0.8, rotateY: -180, opacity: 0 }}
                                    animate={{
                                        scale: 1,
                                        rotateY: 0,
                                        opacity: 1,
                                        shaking: animState === 'breaking' ? [0, 10, -10, 10, -10, 0] : 0
                                    }}
                                    transition={{ duration: 0.8, type: "spring" }}
                                    className={`relative z-20 ${animState === 'breaking' ? 'animate-shake' : ''}`}
                                >
                                    {/* Halo Effect */}
                                    <div className={`absolute inset-0 blur-3xl rounded-full opacity-40 transition-colors duration-500 scale-150 ${animState === 'breaking' ? 'bg-red-600' :
                                        animState === 'unlocking' ? 'bg-green-500' :
                                            'bg-yellow-500'
                                        }`} />

                                    {/* Main Icon */}
                                    {animState === 'unlocking' ? (
                                        <Unlock className="w-48 h-48 text-green-400 drop-shadow-[0_0_30px_rgba(74,222,128,0.5)]" strokeWidth={1} />
                                    ) : animState === 'breaking' ? (
                                        <Lock className="w-48 h-48 text-red-500 drop-shadow-[0_0_50px_rgba(239,68,68,0.6)]" strokeWidth={1} />
                                    ) : (
                                        <LockKeyhole className="w-48 h-48 text-yellow-500 drop-shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-pulse" strokeWidth={1} />
                                    )}
                                </motion.div>

                                {/* The Key (Inserts into lock) */}
                                {animState !== 'breaking' && animState !== 'unlocking' && (
                                    <motion.div
                                        initial={{ x: 200, opacity: 0, rotate: 45 }}
                                        animate={{ x: 0, opacity: 1, rotate: 0 }}
                                        transition={{ delay: 0.5, duration: 0.6, type: "spring" }}
                                        className="absolute z-30 drop-shadow-2xl"
                                    >
                                        <KeyRound className="w-24 h-24 text-white fill-white/10" strokeWidth={1.5} />
                                    </motion.div>
                                )}
                            </div>

                            {/* Status Text with Glitch Effect for Error */}
                            <div className="mt-12 h-20 text-center">
                                {animState === 'breaking' && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="space-y-2"
                                    >
                                        <h2 className="text-4xl font-bold text-red-500 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                                            ⚠️ ERİŞİM REDDEDİLDİ
                                        </h2>
                                        <p className="text-white/60 font-mono text-sm tracking-wider">
                                            GÜVENLİK PROTOKOLÜ İHLALİ
                                        </p>
                                    </motion.div>
                                )}

                                {animState === 'unlocking' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-2"
                                    >
                                        <h2 className="text-3xl font-bold text-green-400 tracking-widest uppercase">
                                            KİLİT AÇILIYOR
                                        </h2>
                                        <div className="h-1 w-32 bg-gray-800 rounded-full mx-auto overflow-hidden">
                                            <motion.div
                                                className="h-full bg-green-400"
                                                initial={{ width: 0 }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 1.5 }}
                                            />
                                        </div>
                                    </motion.div>
                                )}

                                {animState === 'checking' && (
                                    <p className="text-yellow-500/80 font-mono animate-pulse tracking-widest">
                                        DOĞRULANIYOR...
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main Interface */}
                <AnimatePresence mode="wait">
                    {animState !== 'success' ? (
                        <motion.div
                            key="input-form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)", transition: { duration: 0.5 } }}
                            className="w-full max-w-md"
                        >
                            <div className="text-center mb-10">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="inline-flex items-center justify-center p-3 mb-6 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-purple-500/20 ring-1 ring-white/10 shadow-2xl"
                                >
                                    <Sparkles className="w-6 h-6 text-yellow-400" />
                                </motion.div>
                                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white via-white/80 to-white/40 mb-4 tracking-tight">
                                    Gizli Çekiliş
                                </h1>
                                <p className="text-gray-400 leading-relaxed">
                                    {lockedName
                                        ? <span>Hoş geldin <span className="text-white font-semibold">{lockedName}</span>. Şifreni gir.</span>
                                        : "Kimliğinizi doğrulamak için bilgilerinizi girin."
                                    }
                                </p>
                            </div>

                            <form onSubmit={handleDraw} className="space-y-4">
                                <div className="space-y-2">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            {lockedName ? <Lock className="h-5 w-5 text-yellow-500" /> : <User className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />}
                                        </div>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => !lockedName && setName(e.target.value)}
                                            readOnly={!!lockedName}
                                            placeholder="İsim Girin"
                                            className={`w-full bg-white/5 border backdrop-blur-sm rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${lockedName
                                                ? 'border-yellow-500/30 cursor-not-allowed text-yellow-500/90'
                                                : 'border-white/10 focus:border-white/20 focus:ring-white/10 hover:bg-white/10'
                                                }`}
                                        />
                                    </div>

                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <KeyRound className="h-5 w-5 text-gray-500 group-focus-within:text-white transition-colors" />
                                        </div>
                                        <input
                                            type="text"
                                            value={pin}
                                            onChange={(e) => setPin(e.target.value)}
                                            placeholder="Güvenlik Kodu"
                                            maxLength={6}
                                            className="w-full bg-white/5 border border-white/10 backdrop-blur-sm rounded-xl py-4 pl-12 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-white/20 focus:ring-white/10 hover:bg-white/10 transition-all font-mono tracking-[0.2em] text-center"
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={animState !== 'idle' || !name.trim() || !pin.trim()}
                                    type="submit"
                                    className="w-full relative overflow-hidden bg-white text-black font-semibold rounded-xl py-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        Sonucu Göster
                                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                                    </span>
                                </motion.button>
                            </form>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="result-view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1 }}
                            className="relative z-50 w-full max-w-2xl"
                        >
                            {/* Cinematic Reveal Card */}
                            <div className="relative group perspective-1000">
                                <motion.div
                                    initial={{ rotateX: 90, opacity: 0 }}
                                    animate={{ rotateX: 0, opacity: 1 }}
                                    transition={{ type: "spring", stiffness: 50, damping: 20, delay: 0.2 }}
                                    className="relative bg-black/40 border border-white/10 backdrop-blur-3xl rounded-[2rem] p-12 md:p-16 text-center overflow-hidden shadow-2xl"
                                >
                                    {/* Shining Border Effect */}
                                    <div className="absolute inset-0 border border-white/20 rounded-[2rem]" />
                                    <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

                                    <motion.div
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.8 }}
                                    >
                                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-bold tracking-widest uppercase mb-8">
                                            <Sparkles className="w-3 h-3" />
                                            2025 Eşleşmesi
                                        </div>
                                    </motion.div>

                                    <div className="relative mb-12">
                                        <div className="absolute inset-0 bg-yellow-400/20 blur-[100px] animate-pulse rounded-full" />
                                        <motion.h3
                                            initial={{ scale: 0.8, opacity: 0, filter: "blur(20px)" }}
                                            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                                            transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                                            className="relative text-6xl md:text-8xl font-black text-white tracking-tight drop-shadow-2xl"
                                        >
                                            {result?.match}
                                        </motion.h3>
                                    </div>

                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 2.5 }}
                                        className="space-y-6"
                                    >
                                        <p className="text-gray-400 font-light italic text-lg max-w-md mx-auto">
                                            "Bir hediye, bin mutluluk demektir..."
                                        </p>

                                        <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-gray-700 to-transparent mx-auto" />

                                        <button
                                            onClick={resetSearch}
                                            className="text-white/40 hover:text-white text-xs tracking-widest uppercase transition-colors py-2"
                                        >
                                            Ekranı Kapat
                                        </button>
                                    </motion.div>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Global Styles for Keyframes */}
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-5px) rotate(-5deg); }
                    75% { transform: translateX(5px) rotate(5deg); }
                }
                .animate-shake {
                    animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
                }
                .perspective-1000 {
                    perspective: 1000px;
                }
            `}</style>
        </main>
    )
}
