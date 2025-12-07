'use client'

import { CheckCircle, Lock, ShieldCheck, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function VerificationPromoCard() {
    return (
        <div className="relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-[#0B0C10] p-8 md:p-12">
            {/* Background Gradients */}
            <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-soft-gold/10 blur-[100px]" />
            <div className="absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-soft-gold/5 blur-[100px]" />

            <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-8">
                {/* Left Content */}
                <div className="max-w-xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 mb-6">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            ONAYLI HESAP
                        </span>
                    </div>

                    <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl">
                        Güvenilirliğinizi <br />
                        <span className="text-soft-gold">Kanıtlayın</span>
                    </h2>

                    <p className="mt-6 text-lg text-gray-400 leading-relaxed">
                        Onaylı hesap rozeti ile markaların ve diğer kullanıcıların
                        güvenini kazanın. Profilinizi doğrulayarak daha fazla işbirliği
                        fırsatı yakalayın.
                    </p>

                    <div className="mt-8 flex flex-wrap items-center gap-6">
                        <Link
                            href="/settings/verification"
                            className="group inline-flex items-center gap-2 rounded-xl bg-soft-gold px-6 py-3.5 text-sm font-bold text-[#101117] transition-all hover:bg-soft-gold/90 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                        >
                            Hemen Doğrula
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>

                        <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                            <Lock className="h-4 w-4" />
                            Güvenli İşlem
                        </div>
                    </div>
                </div>

                {/* Right Visual - Tilted Card */}
                <div className="relative flex items-center justify-center lg:justify-end">
                    <motion.div
                        initial={{ rotateY: -10, rotateX: 5, scale: 0.95 }}
                        animate={{ rotateY: -10, rotateX: 5, scale: 0.95 }}
                        whileHover={{ rotateY: 0, rotateX: 0, scale: 1, transition: { duration: 0.4 } }}
                        className="relative w-full max-w-md transform perspective-1000"
                        style={{ transformStyle: 'preserve-3d' }}
                    >
                        {/* The Glass Card */}
                        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1A1B23]/90 p-6 shadow-2xl backdrop-blur-xl ring-1 ring-white/5">

                            {/* Card Header: Avatar & Name */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="h-14 w-14 rounded-full border-2 border-purple-500/50 bg-[#252630]" />
                                    <div className="space-y-2">
                                        <div className="h-3 w-32 rounded-full bg-white/10" />
                                        <div className="h-2 w-20 rounded-full bg-white/5" />
                                    </div>
                                </div>
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/20">
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                        ONAYLI
                                    </span>
                                </div>
                            </div>

                            {/* Stats Rows */}
                            <div className="space-y-3">
                                {/* Stat 1 */}
                                <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                                    <span className="text-sm text-gray-400">Takipçiler</span>
                                    <span className="font-bold text-white">10K+</span>
                                </div>
                                {/* Stat 2 */}
                                <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                                    <span className="text-sm text-gray-400">Etkileşim</span>
                                    <span className="font-bold text-emerald-400">%5.2</span>
                                </div>
                                {/* Stat 3 */}
                                <div className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                                    <span className="text-sm text-gray-400">Beğeniler</span>
                                    <span className="font-bold text-white">2.5K</span>
                                </div>
                            </div>

                            {/* Decorative Glow */}
                            <div className="absolute top-0 right-0 -mr-12 -mt-12 h-48 w-48 rounded-full bg-purple-500/20 blur-[60px]" />
                        </div>

                        {/* Shadow Card Behind */}
                        <div className="absolute inset-0 -z-10 translate-y-4 translate-x-4 transform rounded-2xl bg-black/40 blur-xl" />
                    </motion.div>
                </div>
            </div>
        </div>
    )
}
