'use client';

import Link from 'next/link';
import { ShieldCheck, TrendingUp, Lock } from 'lucide-react';

export default function VerificationCTA() {
    return (
        <section className="py-20 relative overflow-hidden">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/5 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-12 backdrop-blur-sm shadow-2xl relative overflow-hidden">

                    {/* Decorative Glow */}
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-soft-gold/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-6">
                                <ShieldCheck className="w-3 h-3 mr-2" />
                                Güvenilir Profil Rozeti
                            </div>

                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                Verilerinizi Doğrulayın, <br />
                                <span className="text-soft-gold">Güven Kazanın</span>
                            </h2>

                            <p className="text-gray-300 mb-8 text-lg leading-relaxed">
                                Markalar doğrulanmış verilere güvenir. Instagram, TikTok ve YouTube hesaplarınızı bağlayarak istatistiklerinizi şeffaf bir şekilde sergileyin ve daha fazla iş birliği fırsatı yakalayın.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    href="/dashboard/influencer"
                                    className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-soft-gold text-black font-bold hover:bg-white transition-colors duration-200"
                                >
                                    Hemen Doğrula
                                    <TrendingUp className="w-4 h-4 ml-2" />
                                </Link>

                                <div className="flex items-center px-6 py-3 text-gray-400 text-sm">
                                    <Lock className="w-4 h-4 mr-2" />
                                    Verileriniz güvende
                                </div>
                            </div>
                        </div>

                        <div className="relative">
                            {/* Abstract Visual Representation of Verification */}
                            <div className="relative z-10 bg-[#11121A] border border-white/10 rounded-2xl p-6 shadow-xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5">
                                            <div className="w-full h-full bg-gray-800 rounded-full border-2 border-black" />
                                        </div>
                                        <div>
                                            <div className="h-3 w-24 bg-gray-700 rounded mb-2" />
                                            <div className="h-2 w-16 bg-gray-800 rounded" />
                                        </div>
                                    </div>
                                    <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold flex items-center">
                                        <ShieldCheck className="w-3 h-3 mr-1" />
                                        Doğrulanmış
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-gray-400 text-sm">Takipçi</span>
                                        <span className="text-white font-bold">124K</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-gray-400 text-sm">Etkileşim</span>
                                        <span className="text-green-400 font-bold">4.8%</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                                        <span className="text-gray-400 text-sm">Ort. Beğeni</span>
                                        <span className="text-white font-bold">12.5K</span>
                                    </div>
                                </div>
                            </div>

                            {/* Background Card Effect */}
                            <div className="absolute inset-0 bg-soft-gold/5 rounded-2xl transform -rotate-3 scale-95 z-0" />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
