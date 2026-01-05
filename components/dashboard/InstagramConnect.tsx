'use client';

import { useState, useEffect } from 'react';
import { generateVerificationCode, verifyInstagramAccount } from '@/app/actions/social-verification';
import { BadgeCheck } from 'lucide-react';
import { USER_AGREEMENT, PRIVACY_POLICY, EXPLICIT_CONSENT } from '@/lib/legal-constants';
import LegalModal from '@/components/ui/LegalModal';

interface InstagramConnectProps {
    userId: string;
    isVerified?: boolean;
    initialUsername?: string | null;
    lastUpdated?: string | null;
}

export default function InstagramConnect({ userId, isVerified = false, initialUsername = '', lastUpdated = null }: InstagramConnectProps) {
    const [step, setStep] = useState<'input' | 'code' | 'success'>(isVerified ? 'success' : 'input');
    const [username, setUsername] = useState(initialUsername || '');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [agreedToConsent, setAgreedToConsent] = useState(false);
    const [modalState, setModalState] = useState({ isOpen: false, title: '', content: '' });

    const STORAGE_KEY = `instagram_verification_state_${userId}`;
    const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes

    // Load state from localStorage on mount
    useEffect(() => {
        if (isVerified) return; // Don't load if already verified

        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            try {
                const { step: savedStep, username: savedUsername, verificationCode: savedCode, timestamp } = JSON.parse(savedState);
                const now = new Date().getTime();

                if (now - timestamp < EXPIRY_TIME) {
                    if (savedStep) setStep(savedStep);
                    if (savedUsername) setUsername(savedUsername);
                    if (savedCode) setVerificationCode(savedCode);
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            } catch (e) {
                console.error('Error parsing saved verification state:', e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [userId, isVerified]);

    // Save state to localStorage whenever relevant state changes
    useEffect(() => {
        if (step === 'success' || isVerified) {
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        if (step === 'code' && verificationCode) {
            const stateToSave = {
                step,
                username,
                verificationCode,
                timestamp: new Date().getTime()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        }
    }, [step, username, verificationCode, userId, isVerified]);

    const openModal = (title: string, content: string) => {
        setModalState({ isOpen: true, title, content });
    };

    // Calculate time since last update
    // Calculate time since last update
    const calculateTimeRemaining = () => {
        if (!lastUpdated) return { canUpdate: true, daysRemaining: 0 };

        const lastUpdateDate = new Date(lastUpdated);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - lastUpdateDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const cooldownDays = 7;

        if (diffDays >= cooldownDays) {
            return { canUpdate: true, daysRemaining: 0 };
        } else {
            return { canUpdate: false, daysRemaining: cooldownDays - diffDays };
        }
    };

    const { canUpdate, daysRemaining } = calculateTimeRemaining();

    const handleGenerateCode = async () => {
        if (!username) return setError('Lütfen bir kullanıcı adı girin.');

        let cleanUsername = username;
        if (username.includes('@')) {
            cleanUsername = username.replace('@', '');
            setUsername(cleanUsername);
        }

        setLoading(true);
        setError('');

        try {
            const result = await generateVerificationCode(userId, cleanUsername);

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
            const result = await verifyInstagramAccount(userId);

            if (result.success) {
                setStep('success');
                localStorage.removeItem(STORAGE_KEY);
            } else {
                setError(result.error || 'Kod biyografide bulunamadı. Lütfen eklediğinizden emin olun.');
            }
        } catch (err) {
            setError('Doğrulama sırasında bağlantı hatası.');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        if (!canUpdate) return;

        setLoading(true);
        setError('');
        try {
            const result = await verifyInstagramAccount(userId);
            if (result.success) {
                alert("Veriler başarıyla güncellendi!");
                window.location.reload();
            } else {
                setError(result.error || 'Güncelleme başarısız.');
            }
        } catch (err) {
            setError('Güncelleme sırasında hata oluştu.');
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
            {/* Header - Only show if not success to save space, or make it minimal */}
            {step !== 'success' && (
                <div className="mb-6">
                    <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Hesap Doğrulama</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">Instagram Hesabını Bağla</h3>
                    <p className="mt-1 text-sm text-gray-400">
                        Analizli profiller vitrininde görünmek için hesabını doğrula.
                    </p>
                </div>
            )}

            {step === 'input' && (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-300 mb-1">Instagram Kullanıcı Adı</label>
                        <div className="relative rounded-xl shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">@</span>
                            </div>
                            <input
                                type="text"
                                className="block w-full rounded-xl border-white/10 bg-white/5 pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:border-soft-gold focus:ring-soft-gold sm:text-sm transition"
                                placeholder="kullaniciadi"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleGenerateCode}
                        disabled={loading}
                        className="rounded-xl bg-soft-gold px-6 py-3 text-sm font-semibold text-black transition hover:bg-soft-gold/90 disabled:opacity-50 whitespace-nowrap"
                    >
                        {loading ? '...' : 'Doğrulama Kodu Al'}
                    </button>
                </div>
            )}

            {step === 'code' && (
                <div className="space-y-4">
                    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-4">
                        <p className="text-sm text-yellow-200">
                            Aşağıdaki kodu Instagram profilindeki <strong>Biyografi (Bio)</strong> alanına ekle.
                        </p>
                    </div>

                    {/* Legal Checkboxes & Disclaimer */}
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-1">
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
                                        Kullanıcı Sözleşmesi'ni
                                    </button>
                                    {' '}ve{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            openModal('Gizlilik Politikası', PRIVACY_POLICY);
                                        }}
                                        className="text-soft-gold hover:underline"
                                    >
                                        Gizlilik Politikasını
                                    </button>
                                    {' '}okudum, kabul ediyorum.
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
                                    Kişisel verilerimin{' '}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            openModal('Açık Rıza Metni', EXPLICIT_CONSENT);
                                        }}
                                        className="text-soft-gold hover:underline"
                                    >
                                        Açık Rıza Metni
                                    </button>
                                    {' '}kapsamında analiz edilmesine izin veriyorum.
                                </span>
                            </label>
                        </div>

                        {/* Disclaimer Text */}
                        <p className="max-w-[200px] text-right text-[10px] italic text-gray-400 leading-relaxed hidden md:block">
                            Influmatch sosyal medya hesap şifrelerinizi istemez. Sosyal mecralarda aldığınız etkileşimleri markalarla paylaşmak için sizden onay alır.
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                            <code className="text-lg font-bold text-white tracking-wider">
                                {verificationCode}
                            </code>
                            <button
                                onClick={copyToClipboard}
                                className="text-xs font-medium text-soft-gold hover:text-soft-gold/80"
                            >
                                Kopyala
                            </button>
                        </div>

                        <button
                            onClick={handleVerify}
                            disabled={loading || !agreedToTerms || !agreedToConsent}
                            className="rounded-xl bg-green-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {loading ? 'Kontrol...' : 'Kontrol Et'}
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            setStep('input');
                            localStorage.removeItem(STORAGE_KEY);
                            setUsername('');
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
                                <h3 className="text-lg font-semibold text-white">Instagram Bağlı</h3>
                                <span className="rounded-full border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                                    Analizli Profil
                                </span>
                            </div>
                            <p className="text-sm text-gray-400">
                                Hesabın doğrulandı ve verilerin güncel.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={loading || !canUpdate}
                            className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${canUpdate
                                ? 'bg-white/10 text-white hover:bg-white/20 hover:text-soft-gold'
                                : 'bg-white/5 text-gray-500'
                                }`}
                        >
                            {loading ? 'Güncelleniyor...' : canUpdate ? 'Verileri Güncelle' : 'Güncel'}
                        </button>
                        {!canUpdate && (
                            <p className="text-[10px] text-gray-500">
                                {daysRemaining} gün sonra güncellenebilir
                            </p>
                        )}
                    </div>
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

            <div className="mt-6 flex justify-end md:hidden">
                <p className="max-w-md text-right text-[10px] italic text-gray-400 leading-relaxed">
                    Influmatch sosyal medya hesap şifrelerinizi istemez. Sosyal mecralarda aldığınız etkileşimleri markalarla paylaşmak için sizden onay alır.
                </p>
            </div>
        </div>
    );
}
