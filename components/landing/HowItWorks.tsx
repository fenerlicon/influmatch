'use client'

import { useState } from 'react'
import { Card, Segmented } from '@/components/ui'

// Yalnızca canlıdaki akış anlatılır (doğrulama, keşif/ilan, İşler sayfası).
const STEPS = {
  brand: [
    { title: 'Hesabını doğrula', text: 'Vergi levhası ve kurumsal e-postanla markanı onaylat.' },
    { title: 'Keşfet veya ilan aç', text: 'Kategori, şehir, etkileşim ve bütçeye göre filtrele ya da ilan yayınla.' },
    { title: 'Anlaş ve takip et', text: 'Anlaşma özeti, teslimatlar, revizeler ve ödeme teyidi tek sayfada.' },
  ],
  creator: [
    { title: 'Hesabını doğrula', text: 'Instagram veya TikTok hesabını biyografi koduyla doğrula, verilerin profiline gelsin.' },
    { title: 'Başvur ya da teklif al', text: 'Sana uygun ilanlara başvur; markalar profilini görüp doğrudan teklif göndersin.' },
    { title: 'Anlaş ve teslim et', text: 'Anlaşma özeti, taslaklar, revizeler ve ödeme teyidi tek sayfada.' },
  ],
}

export default function HowItWorks() {
  const [who, setWho] = useState<'brand' | 'creator'>('brand')
  return (
    <>
      <Segmented
        className="mb-[18px]"
        label="Kimin için"
        value={who}
        onSelect={(v) => setWho(v as 'brand' | 'creator')}
        items={[
          { value: 'brand', label: 'Markalar için' },
          { value: 'creator', label: 'İçerik üreticileri için' },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS[who].map((step, i) => (
          <Card key={step.title} padded className="p-6">
            <div className="font-display text-[40px] leading-none text-gold">{i + 1}</div>
            <h3 className="mb-1.5 mt-4 text-base font-semibold text-ink">{step.title}</h3>
            <p className="text-sm text-ink-muted">{step.text}</p>
          </Card>
        ))}
      </div>
    </>
  )
}
