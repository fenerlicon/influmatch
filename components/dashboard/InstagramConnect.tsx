'use client';

import { useState, useEffect } from 'react';
import { generateVerificationCode, verifyInstagramAccount } from '@/app/actions/social-verification';
import { BadgeCheck, Copy, Instagram, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Chip, Field, Input, Notice } from '@/components/ui';

interface InstagramConnectProps {
    userId: string;
    isVerified?: boolean;
    initialUsername?: string | null;
    lastUpdated?: string | null;
    /** Doğrulama başarılı olunca çağrılır (kayıt adımı). */
    onVerified?: () => void;
}

export default function InstagramConnect({ userId, isVerified = false, initialUsername = '', lastUpdated = null, onVerified }: InstagramConnectProps) {
    const [step, setStep] = useState<'input' | 'code' | 'success'>(isVerified ? 'success' : 'input');
    const [username, setUsername] = useState(initialUsername || '');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [agreedToConsent, setAgreedToConsent] = useState(false);

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

        let cleanUsername = username.trim();
        if (cleanUsername.includes('@')) {
            cleanUsername = cleanUsername.replace('@', '');
        }
        // Update state with cleaned version
        setUsername(cleanUsername);

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
                onVerified?.();
            } else {
                setError(result.error || 'Kod biyografide bulunamadı. Lütfen eklediğinizden emin olun.');
            }
        } catch (err: any) {
            console.error('Doğrulama hatası:', err);
            const errorMessage = err?.message || '';

            if (errorMessage.includes('not found') || errorMessage.includes('bulunamadı')) {
                setError('Kullanıcı adı Instagram\'da bulunamadı veya hesabınız gizli. Lütfen kullanıcı adınızı kontrol edip hesabınızın herkese açık olduğundan emin olun.');
            } else {
                setError('Doğrulama sırasında bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            }
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
                toast.success('Veriler güncellendi.');
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
        toast.success('Kod kopyalandı.');
    };

    const consentGiven = agreedToTerms && agreedToConsent;

    return (
        <div className="grid gap-4">
            <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-surface-3 text-ink-muted">
                    <Instagram className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink">Instagram</h3>
                    <p className="text-xs text-ink-faint">Biyografine ekleyeceğin kısa bir kodla doğrulanır; şifren istenmez.</p>
                </div>
                {step === 'success' && <Chip tone="success" className="ml-auto"><BadgeCheck aria-hidden />Doğrulandı</Chip>}
            </div>

            {step === 'input' && (
                <div className="grid gap-3">
                    <Field label="Instagram kullanıcı adı">
                        {(props) => (
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-ink-faint">@</span>
                                <Input {...props} className="pl-7" placeholder="kullaniciadi" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
                            </div>
                        )}
                    </Field>

                    <div className="grid gap-2 text-[12.5px] text-ink-muted">
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-gold" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
                            <span>
                                <a href="/legal?tab=terms" target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-[3px] hover:text-gold">
                                    Sözleşmeleri
                                </a>{' '}
                                kabul ediyorum.
                            </span>
                        </label>
                        <label className="flex cursor-pointer items-start gap-2.5">
                            <input type="checkbox" className="mt-0.5 h-4 w-4 flex-none accent-gold" checked={agreedToConsent} onChange={(e) => setAgreedToConsent(e.target.checked)} />
                            <span>Verilerimin analiz edilmesine izin veriyorum.</span>
                        </label>
                    </div>

                    <Button variant="primary" onClick={handleGenerateCode} loading={loading} disabled={!consentGiven || !username.trim()}>
                        Doğrulama kodu al
                    </Button>
                    <p className="text-xs text-ink-faint">Profil istatistiklerin hesabından çekilir, etkileşim oranın otomatik hesaplanır. Hesabın herkese açık olmalı.</p>
                </div>
            )}

            {step === 'code' && (
                <div className="grid gap-3">
                    <Notice tone="warning">Aşağıdaki kodu Instagram profilindeki biyografi alanına ekle, sonra &quot;Kontrol et&quot; de.</Notice>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2.5">
                            <code className="text-lg font-semibold tracking-wider text-ink">{verificationCode}</code>
                            <Button size="sm" variant="ghost" onClick={copyToClipboard} leftIcon={<Copy />}>Kopyala</Button>
                        </div>
                        <Button variant="primary" onClick={handleVerify} loading={loading} disabled={!consentGiven}>Kontrol et</Button>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setStep('input');
                            localStorage.removeItem(STORAGE_KEY);
                            setUsername('');
                            setVerificationCode('');
                        }}
                        className="justify-self-start text-xs text-ink-faint hover:text-ink"
                    >
                        Vazgeç ve geri dön
                    </button>
                </div>
            )}

            {step === 'success' && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[13px] text-ink-muted">Hesabın doğrulandı, verilerin profilinde.</p>
                    <div className="grid justify-items-end gap-1">
                        <Button size="sm" onClick={handleRefresh} loading={loading} disabled={!canUpdate} leftIcon={<RefreshCw />}>
                            {canUpdate ? 'Verileri güncelle' : 'Güncel'}
                        </Button>
                        {!canUpdate && <p className="text-[11px] text-ink-faint">{daysRemaining} gün sonra güncellenebilir</p>}
                    </div>
                </div>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
        </div>
    );
}
