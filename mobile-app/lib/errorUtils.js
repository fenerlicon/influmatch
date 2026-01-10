export function getTurkishErrorMessage(error) {
    if (!error) return 'Bilinmeyen bir hata oluştu.';
    const msg = (error.message || '').toLowerCase();

    // Auth & Generic
    if (msg.includes('invalid login credentials')) return 'E-posta adresi veya şifre hatalı.';
    if (msg.includes('email not confirmed')) return 'Giriş yapmadan önce e-posta adresinizi doğrulamanız gerekiyor.';
    if (msg.includes('user not found')) return 'Kullanıcı bulunamadı.';
    if (msg.includes('invalid email')) return 'Geçersiz e-posta formatı.';
    if (msg.includes('network')) return 'Bağlantı hatası. İnternetinizi kontrol edin.';
    if (msg.includes('rate limit')) return 'Çok fazla deneme yaptınız. Lütfen bekleyin.';

    // Register
    if (msg.includes('user already registered') || msg.includes('already registered')) return 'Bu e-posta adresi zaten kullanımda.';
    if (msg.includes('password should be') || msg.includes('weak password')) return 'Şifreniz çok zayıf (en az 6 karakter olmalı).';

    // Verification
    if (msg.includes('token has expired')) return 'Doğrulama kodunun süresi dolmuş.';
    if (msg.includes('invalid token')) return 'Geçersiz doğrulama kodu.';

    // Fallback
    return 'Bir hata oluştu. Lütfen bilgilerinizi kontrol edip tekrar deneyin.';
}
