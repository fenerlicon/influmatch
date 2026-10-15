'use client';

import { useState, useEffect } from 'react';
import { generateTikTokVerificationCode, verifyTikTokAccount } from '@/app/actions/social-verification';
import { BadgeCheck, Copy, Music2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Chip, Field, Input, Notice } from '@/components/ui';

interface TikTokConnectProps {
    userId: string;
    isVerified?: boolean;
    username?: string | null;
    /** Verilirse doğrulama sonrası sayfa yenilenmez, bu fonksiyon çağrılır (kayıt adımı). */
    onVerified?: () => void;
}

export default function TikTokConnect({ userId, isVerified = false, username = '', onVerified }: TikTokConnectProps) {
    const [step, setStep] = useState<'input' | 'code' | 'success'>(isVerified ? 'success' : 'input');
    const [tiktokUsername, setTiktokUsername] = useState(username || '');
    const [verificationCode, setVerificationCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [agreedToConsent, setAgreedToConsent] = useState(false);

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
                if (onVerified) onVerified();
                else window.location.reload(); // Reload to refresh the stats UI
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
        toast.success('Kod kopyalandı.');
    };

    const consentGiven = agreedToTerms && agreedToConsent;

    return (
        <div className="grid gap-4">
            <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-surface-3 text-ink-muted">
                    <Music2 className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold text-ink">TikTok</h3>
                    <p className="text-xs text-ink-faint">Biyografine ekleyeceğin kısa bir kodla doğrulanır; şifren istenmez.</p>
                </div>
                {step === 'success' && <Chip tone="success" className="ml-auto"><BadgeCheck aria-hidden />Doğrulandı</Chip>}
            </div>

            {step === 'input' && (
                <div className="grid gap-3">
                    <Field label="TikTok kullanıcı adı">
                        {(props) => (
                            <div className="relative">
                                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13.5px] text-ink-faint">@</span>
                                <Input {...props} className="pl-7" placeholder="kullaniciadi" value={tiktokUsername} onChange={(e) => setTiktokUsername(e.target.value)} autoComplete="off" />
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

                    <Button variant="primary" onClick={handleGenerateCode} loading={loading} disabled={!consentGiven || !tiktokUsername.trim()}>
                        Doğrulama kodu al
                    </Button>
                    <p className="text-xs text-ink-faint">TikTok verilerin profilinde listelenir. Hesabın herkese açık olmalı.</p>
                </div>
            )}

            {step === 'code' && (
                <div className="grid gap-3">
                    <Notice tone="warning">Aşağıdaki kodu TikTok profilindeki biyografi alanına ekle, sonra &quot;Doğrula&quot; de.</Notice>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-line-strong bg-surface-2 px-3.5 py-2.5">
                            <code className="text-lg font-semibold tracking-wider text-ink">{verificationCode}</code>
                            <Button size="sm" variant="ghost" onClick={copyToClipboard} leftIcon={<Copy />}>Kopyala</Button>
                        </div>
                        <Button variant="primary" onClick={handleVerify} loading={loading} disabled={!consentGiven}>Doğrula</Button>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setStep('input');
                            localStorage.removeItem(STORAGE_KEY);
                            setTiktokUsername('');
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
                    <p className="text-[13px] text-ink-muted">
                        {tiktokUsername ? `@${tiktokUsername} doğrulandı, verilerin profilinde.` : 'Hesabın doğrulandı, verilerin profilinde.'}
                    </p>
                    <Button size="sm" onClick={handleVerify} loading={loading} leftIcon={<RefreshCw />}>Verileri yenile</Button>
                </div>
            )}

            {error && <Notice tone="danger">{error}</Notice>}
        </div>
    );
}
