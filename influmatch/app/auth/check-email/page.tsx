'use client'

import { Mail } from 'lucide-react'

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-24">
      <div className="mx-auto max-w-md text-center">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#151621] to-[#0C0D10] p-10 shadow-glow">
          <div className="flex justify-center">
            <div className="rounded-full bg-soft-gold/20 p-4">
              <Mail className="h-12 w-12 text-soft-gold" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-white">
            Email Adresinizi Doğrulayın
          </h1>
          <p className="mt-4 text-gray-300 leading-relaxed">
            Kayıt işleminiz başarıyla tamamlandı! Size gönderdiğimiz doğrulama emailini kontrol edin ve hesabınızı aktifleştirmek için email içindeki linke tıklayın.
          </p>
          <div className="mt-6 rounded-2xl border border-soft-gold/30 bg-soft-gold/10 p-4">
            <p className="text-sm text-soft-gold leading-relaxed">
              <strong className="text-soft-gold">💡 İpucu:</strong> Email'inizi bulamıyorsanız spam klasörünü kontrol etmeyi unutmayın. Email doğrulandıktan sonra otomatik olarak profil bilgilerinizi tamamlamak için yönlendirileceksiniz.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

