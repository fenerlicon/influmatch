'use client'

export default function VerificationWarningCard() {
    const handleScroll = () => {
        const section = document.getElementById('verification-section')
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    }

    return (
        <div
            onClick={handleScroll}
            className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-10 text-center shadow-glow transition hover:border-white/20 hover:bg-white/10 cursor-pointer"
        >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.78 4.78 4 4 0 0 1-6.74 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.74Z" /><path d="m9 12 2 2 4-4" /></svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Verileriniz Doğrulanmadı</h3>
            <p className="mt-2 text-sm text-gray-400 max-w-xs">
                Profil istatistiklerinizi ve yapay zeka analizlerini görmek için Instagram hesabınızı doğrulayın.
            </p>
            <button className="mt-6 rounded-full bg-soft-gold/20 px-6 py-2.5 text-sm font-semibold text-soft-gold transition hover:bg-soft-gold/30">
                Doğrulamayı Başlat
            </button>
        </div>
    )
}
