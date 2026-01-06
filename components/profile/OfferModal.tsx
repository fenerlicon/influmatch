'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { createOffer } from '@/app/profile/actions'

interface OfferModalProps {
  receiverId: string
  receiverName: string
  isViewerVerified: boolean
}

const CAMPAIGN_TYPES = ['Story', 'Reel', 'Post', 'YouTube'] as const

const initialFormState = {
  campaignName: '',
  campaignType: CAMPAIGN_TYPES[0],
  budget: '',
  message: '',
  paymentType: 'cash' as 'cash' | 'barter',
}

export default function OfferModal({ receiverId, receiverName, isViewerVerified }: OfferModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [formState, setFormState] = useState(initialFormState)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  const isDisabled = useMemo(() => {
    return !formState.campaignName || !formState.budget || isPending
  }, [formState.budget, formState.campaignName, isPending])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const handleOpen = () => {
    if (!isViewerVerified) {
      setToast({ type: 'error', message: 'Teklif göndermek için hesabınızın onaylanması gerekmektedir.' })
      return
    }
    setIsOpen(true)
  }
  const handleClose = () => {
    if (isPending) return
    setIsOpen(false)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      try {
        await createOffer({
          receiverId,
          campaignName: formState.campaignName,
          campaignType: formState.campaignType,
          budget: formState.budget,
          message: formState.message,
          paymentType: formState.paymentType,
        })
        setFormState(initialFormState)
        setIsOpen(false)
        setToast({ type: 'success', message: 'Teklifiniz gönderildi!' })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Teklif gönderilemedi.'
        setToast({ type: 'error', message })
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-2xl border border-soft-gold/50 bg-soft-gold/10 px-6 py-3 text-sm font-semibold text-soft-gold shadow-glow transition hover:border-soft-gold hover:bg-soft-gold/20"
      >
        Teklif Gönder
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-10 backdrop-blur">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0C0D10] p-6 text-white shadow-glow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Yeni Teklif</p>
                <h3 className="mt-2 text-2xl font-semibold"> {receiverName} için</h3>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-gray-300 transition hover:border-soft-gold hover:text-soft-gold"
              >
                Kapat
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <label className="block text-sm text-gray-400">
                Kampanya Başlığı
                <input
                  required
                  type="text"
                  name="campaignName"
                  value={formState.campaignName}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-soft-gold/60"
                  placeholder="Örn. Lüks Yaz Lansmanı"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm text-gray-400">
                  Kampanya Tipi
                  <select
                    name="campaignType"
                    value={formState.campaignType}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-soft-gold/60"
                  >
                    {CAMPAIGN_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-[#0C0D10] text-white">
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm text-gray-400">
                  Ödeme Yöntemi
                  <select
                    name="paymentType"
                    value={formState.paymentType}
                    onChange={handleChange}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-soft-gold/60"
                  >
                    <option value="cash" className="bg-[#0C0D10] text-white">Nakit (Para)</option>
                    <option value="barter" className="bg-[#0C0D10] text-white">Barter (Ürün)</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm text-gray-400">
                {formState.paymentType === 'barter' ? 'Ürün Piyasa Değeri (₺)' : 'Bütçe (₺)'}
                <input
                  required
                  name="budget"
                  type="number"
                  min={0}
                  step="100"
                  value={formState.budget}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-soft-gold/60"
                  placeholder={formState.paymentType === 'barter' ? 'Örn. 5000' : '25000'}
                />
              </label>

              <label className="block text-sm text-gray-400">
                Mesaj / Not
                <textarea
                  name="message"
                  rows={4}
                  value={formState.message}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-soft-gold/60"
                  placeholder="Brief detaylarını paylaşabilirsiniz."
                />
              </label>

              <button
                type="submit"
                disabled={isDisabled}
                className="w-full rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? 'Gönderiliyor...' : 'Teklifi Gönder'}
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-glow ${toast.type === 'success'
            ? 'border-soft-gold/70 bg-soft-gold/15 text-soft-gold'
            : 'border-red-400/70 bg-red-500/10 text-red-200'
            }`}
        >
          {toast.message}
        </div>
      ) : null}
    </>
  )
}

