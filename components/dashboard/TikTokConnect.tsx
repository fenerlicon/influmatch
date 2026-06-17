'use client';

import { useState, useEffect } from 'react';
import { generateTikTokVerificationCode, verifyTikTokAccount } from '@/app/actions/social-verification';
import { BadgeCheck, Play } from 'lucide-react';
import { USER_AGREEMENT, PRIVACY_POLICY, EXPLICIT_CONSENT } from '@/lib/legal-constants';
import LegalModal from '@/components/ui/LegalModal';

interface TikTokConnectProps {
    userId: string;
    isVerified?: boolean;
    username?: string | null;
}

export default function TikTokConnect({ userId, isVerified = false, username = '' }: TikTokConnectProps) {
    const [step, setStep] = useState<'input' | 'code' | 'success'>(isVerified ? 'success' : 'input');
    const [tiktokUsername, setTiktokUsername] = useState(username || '');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [agreedToConsent, setAgreedToConsent] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, title: '', content: '' });

    const STORAGE_KEY = `tiktok_verification_state_${userId}`;
    const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes

    useEffect(() => {
        if (isVerified) return;

        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            try {
                const { step: savedStep, username: savedUsername, verificationCode: savedCode, timestamp } = JSON.parse(savedState);
                const now = new Date().getTime();

                if (now - timestamp < EXPIRY_TIME) {
                    if (savedStep) setStep(savedStep);
                    if (savedUsername) setTiktokUsername(savedUsername);
                    if (savedCode) setVerificationCode(savedCode);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {
                console.error('Error parsing saved TikTok verification state:', e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [userId, isVerified]);

    useEffect(() => {
        if (step === 'success' || isVerified) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        if (step === 'code' && verificationCode) {
            const stateToSave = {
                step,
                username: tiktokUsername,
                verificationCode,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        }
    }, [step, tiktokUsername, verificationCode, userId, isVerified]);

    const openModal = (title: string, content: string) => {
        setModalState({ isOpen: true, title, content });
    };

    const handleGenerateCode = async () => {
        if (!tiktokUsername) return setError('Lütfen bir TikTok kullanıcı adı girin.');

        let cleanUsername = tiktokUsername.trim();
        if (cleanUsername.includes('@')) {
            cleanUsername = cleanUsername.replace('@', '');
        }
        setTiktokUsername(cleanUsername);

        setLoading(true);
        setError('');

        try {
            const result = await generateTikTokVerificationCode(userId, cleanUsername);

            if (result.success && result.code) {
                setVerificationCode(result.code);
                setStep('code');
            } else {
                setError(result.error || 'Kod üretilemedi.');
            }
        } catch (err) {
            setError('Kod üretilirken bir hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        setLoading(true);
        setError('');

        try {
            const result = await verifyTikTokAccount(userId);

            if (result.success) {
                setStep('success');
                localStorage.removeItem(STORAGE_KEY);
                window.location.reload(); // Reload to refresh the stats UI
            } else {
                setError(result.error || 'Kod biyografide bulunamadı. Lütfen eklediğinizden emin olun.');
            }
        } catch (err: any) {
            setError(err.message || 'Doğrulama sırasında bir hata oluştu. Lütfen tekrar deneyin.');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(verificationCode);
        alert("Kod kopyalandı!");
    };

    return (
        <div className="w-full">
            {/* Header */}
            <div className="mb-6">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Hesap Doğrulama</p>
                <h3 className="mt-2 text-xl font-semibold text-white">TikTok Hesabını Bağla</h3>
                <p className="mt-1 text-sm text-gray-400">
                    TikTok erişim verilerinizi profilinizde listelemek ve markaların sizi bulmasını sağlamak için doğrulayın.
                </p>
            </div>

            {step === 'input' && (
                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        disabled={true}
                        className="w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-sm font-bold text-gray-500 border border-white/10 bg-white/5 cursor-not-allowed mb-2 shadow-lg"
                    >
                        <Play className="h-5 w-5 fill-current opacity-50" />
                        TikTok OAuth ile Doğrudan Bağla (Çok Yakında)
                    </button>

                    <div className="relative flex items-center gap-4 my-4 opacity-50">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">veya manuel doğrula</span>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm text-gray-300">
                        <ul className="list-inside list-disc space-y-1">
                            <li>TikTok izlenme ve beğeni verileriniz listelenir.</li>
                            <li>Tasarımda TikTok neon teması aktifleşir.</li>
                            <li>Markalar sizi TikTok aramalarında da bulabilir.</li>
                        </ul>
                    </div>

                    <div className="flex-1 mt-4">
                        <label className="block text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider text-[10px]">TikTok Kullanıcı Adı</label>
                        <div className="relative rounded-xl shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">@</span>
                            </div>
                            <input
                                type="text"
                                className="block w-full rounded-xl border-white/10 bg-[#11121A] pl-9 pr-4 py-4 text-white placeholder-gray-500 focus:border-soft-gold focus:ring-1 focus:ring-soft-gold sm:text-sm transition"
                                placeholder="tiktok_kullaniciadi"
                                value={tiktokUsername}
                                onChange={(e) => setTiktokUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (!agreedToTerms || !agreedToConsent) {
                                alert('Lütfen devam etmeden önce sözleşmeleri kabul edin.');
                                document.getElementById('tiktok-legal-section')?.scrollIntoView({ behavior: 'smooth' });
                                return;
                            }
                            handleGenerateCode();
                        }}
                        disabled={loading}
                        className={`w-full rounded-xl px-6 py-4 text-sm font-bold transition active:scale-95 transition-all mt-2 ${
                            (!agreedToTerms || !agreedToConsent)
                            ? 'bg-gray-800 text-gray-400 border border-white/5 opacity-70'
                            : 'bg-white text-black hover:bg-gray-200'
                        }`}
                    >
                        {loading ? 'Lütfen Bekleyin...' : 'Doğrulama Kodu Al'}
                    </button>

                    <div id="tiktok-legal-section" className="mt-4 px-1 scroll-mt-20">
                        <div className="space-y-3">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/10 bg-white/5 transition-all checked:border-soft-gold checked:bg-soft-gold hover:border-soft-gold/50"
                                        checked={agreedToTerms}
                                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                                    />
                                    <BadgeCheck className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 transition-opacity peer-checked:opacity-100" />
                                </div>
                                <span className="text-xs text-gray-400 group-hover:text-gray-300">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            openModal('Kullanıcı Sözleşmesi', USER_AGREEMENT);
                                        }}
                                        className="text-soft-gold hover:underline"
                                    >
                                        Sözleşmeleri
                                    </button>
                                    {' '}kabul ediyorum.
                                </span>
                            </label>

                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-white/10 bg-white/5 transition-all checked:border-soft-gold checked:bg-soft-gold hover:border-soft-gold/50"
                                        checked={agreedToConsent}
                                        onChange={(e) => setAgreedToConsent(e.target.checked)}
                                    />
                                    <BadgeCheck className="pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 text-black opacity-0 transition-opacity peer-checked:opacity-100" />
                                </div>
                                <span className="text-xs text-gray-400 group-hover:text-gray-300">
                                    Verilerimin analiz edilmesine izin veriyorum.
                                </span>
                            </label>
                        </div>
                    </div>
                </div>
            )}

            {step === 'code' && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                        <p className="text-sm text-yellow-200">
                            Aşağıdaki doğrulama kodunu TikTok profilinizin <strong>Biyografi (Bio)</strong> alanına ekleyin. Ardından "Doğrula" butonuna basarak işlemi tamamlayın.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <code className="text-lg font-bold text-white tracking-wider">
                                {verificationCode}
                            </code>
                            <button
                                type="button"
                                onClick={copyToClipboard}
                                className="text-xs font-medium text-soft-gold hover:text-soft-gold/80"
                             >
                                Kopyala
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleVerify}
                            disabled={loading || !agreedToTerms || !agreedToConsent}
                            className="rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setStep('input');
                            localStorage.removeItem(STORAGE_KEY);
                            setTiktokUsername('');
                            setVerificationCode('');
                        }}
                        className="text-xs text-gray-500 hover:text-gray-300"
                    >
                        Vazgeç ve Geri Dön
                    </button>
                </div>
            )}

            {step === 'success' && (
                <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
                            <BadgeCheck className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-white">TikTok Bağlı</h3>
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                                    Resmi Doğrulanmış
                                </span>
                            </div>
                            <p className="text-sm text-gray-400">
                                TikTok hesabınız (@{tiktokUsername}) başarıyla doğrulandı ve verileri çekildi.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleVerify}
                        disabled={loading}
                        className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/20 transition"
                    >
                        {loading ? 'Güncelleniyor...' : 'Verileri Yenile'}
                    </button>
                </div>
            )}

            {error && (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                    {error}
                </div>
            )}

            <LegalModal
                isOpen={modalState.isOpen}
                onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                title={modalState.title}
                content={modalState.content}
            />
        </div>
    );
}
