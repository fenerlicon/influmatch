'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const faqs = [
    {
        question: "Influmatch tam olarak nedir?",
        answer: "Influmatch, markalar ile influencer'ları yapay zeka teknolojisi kullanarak en doğru şekilde bir araya getiren yeni nesil bir influencer marketing platformudur. Geleneksel ajans süreçlerini ortadan kaldırarak, hızlı, veriye dayalı ve güvenilir iş birlikleri kurmanızı sağlar."
    },
    {
        question: "Platform nasıl çalışır?",
        answer: "Süreç çok basit: Markalar kampanya oluşturur ve kriterlerini belirler. Yapay zeka algoritmamız, bu kriterlere en uygun influencer'ları eşleştirir. Influencer'lar ise kendilerine uygun kampanyalara başvurabilir veya doğrudan davet alabilirler. Anlaşma sağlandığında süreç platform üzerinden şeffaf bir şekilde yönetilir."
    },
    {
        question: "Spotlight Üyeliği ne işe yarar?",
        answer: "Spotlight, hem markalar hem de influencer'lar için geliştirilmiş premium bir üyelik modelidir. Spotlight üyeleri, arama sonuçlarında en üst sıralarda yer alır, detaylı profil/rakip analizlerine erişir, 'AI Koç' özelliğini kullanabilir ve gelişmiş filtreleme seçeneklerinden yararlanır. Kısacası, görünürlüğünüzü ve başarınızı katlar."
    },
    {
        question: "Ödemeler ve güvenlik nasıl sağlanıyor?",
        answer: "Influmatch, markalarla influencer'ları bir araya getiren bir eşleştirme platformudur. Platformumuz üzerinden anlaşma sağladığınızda, ödeme koşullarını ve yöntemini tamamen kendi aranızda belirlersiniz. Biz aracı olmaz veya komisyon almayız, böylece kazancınızın tamamı size kalır."
    },
    {
        question: "Sadece Instagram mı var?",
        answer: "Şu anda ana odak noktamız Instagram entegrasyonudur. Ancak çok yakında TikTok ve YouTube platformları da Influmatch ekosistemine dahil edilecektir. Tüm platformlardaki varlığınızı tek bir yerden yönetebileceksiniz."
    },
    {
        question: "Üye olmak ücretli mi?",
        answer: "Influmatch'e üye olmak ve profil oluşturmak tamamen ücretsizdir. Influencerlar için kampanyalara başvurmak, markalar için ise temel kampanya oluşturmak ücretsizdir. Sadece gelişmiş özellikler ve daha fazla görünürlük için Spotlight paketlerini tercih edebilirsiniz."
    }
]

export default function FAQSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    return (
        <section id="sss" className="relative py-24 sm:py-32 overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#0B0C10] via-[#11121A] to-[#0B0C10]" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-soft-gold/5 rounded-full blur-[120px] -z-10" />

            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl text-center mb-16">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-soft-gold">
                        AKLINIZDAKİ SORULAR
                    </h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Sıkça Sorulan <span className="text-transparent bg-clip-text bg-gradient-to-r from-soft-gold to-white">Sorular</span>
                    </p>
                    <p className="mt-4 text-lg text-gray-400">
                        Platformumuz hakkında merak ettiğiniz her şeyi burada bulabilirsiniz.
                    </p>
                </div>

                <div className="mx-auto max-w-3xl divide-y divide-white/10 rounded-3xl border border-white/10 bg-white/5 p-2 sm:p-8 backdrop-blur-sm">
                    {faqs.map((faq, index) => (
                        <div key={index} className="group">
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="flex w-full items-start justify-between py-6 text-left"
                            >
                                <span className={`text-base font-semibold leading-7 transition-colors ${openIndex === index ? 'text-soft-gold' : 'text-white group-hover:text-soft-gold'
                                    }`}>
                                    {faq.question}
                                </span>
                                <span className="ml-6 flex h-7 items-center">
                                    {openIndex === index ? (
                                        <Minus className="h-4 w-4 text-soft-gold" />
                                    ) : (
                                        <Plus className="h-4 w-4 text-gray-400 group-hover:text-white" />
                                    )}
                                </span>
                            </button>
                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="pb-6 pr-12 text-base leading-7 text-gray-400">
                                            {faq.answer}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
