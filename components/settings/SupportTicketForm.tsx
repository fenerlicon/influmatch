'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { createSupportTicket } from '@/app/dashboard/influencer/settings/support/actions'
import { HelpCircle, Upload, X, CheckCircle } from 'lucide-react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

interface SupportTicket {
  id: string
  subject: string
  priority: 'Düşük' | 'Orta' | 'Acil'
  status: 'open' | 'in_progress' | 'closed'
  message: string
  admin_response: string | null
  created_at: string
  updated_at: string
}

interface SupportTicketFormProps {
  onTicketCreated?: (ticket: SupportTicket) => void
}

export default function SupportTicketForm({ onTicketCreated }: SupportTicketFormProps) {
  const supabase = useSupabaseClient()
  const [subject, setSubject] = useState<'Ödeme Sorunu' | 'Teknik Hata' | 'Şikayet/Bildirim' | 'Öneri' | ''>('')
  const [priority, setPriority] = useState<'Düşük' | 'Orta' | 'Acil'>('Orta')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ ticketNumber: number } | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Dosya boyutu maksimum 5MB olmalıdır')
      return
    }

    // Validate file type (images only)
    if (!selectedFile.type.startsWith('image/')) {
      setError('Sadece görsel dosyaları yükleyebilirsiniz')
      return
    }

    setFile(selectedFile)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setFilePreview(reader.result as string)
    }
    reader.readAsDataURL(selectedFile)
  }

  const handleRemoveFile = () => {
    setFile(null)
    setFilePreview(null)
  }

  const uploadFile = async (): Promise<string | null> => {
    if (!file) return null

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `support-ticket-${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('feedback-images')
        .upload(fileName, file)

      if (uploadError) {
        console.error('File upload error:', uploadError)
        throw uploadError
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('feedback-images').getPublicUrl(fileName)
      
      return publicUrl
    } catch (err: any) {
      console.error('File upload exception:', err)
      // Provide more specific error message
      const errorMessage = err?.message || err?.error || 'Bilinmeyen hata'
      
      if (errorMessage.includes('Bucket not found') || errorMessage.includes('not found')) {
        setError('Storage bucket bulunamadı. Lütfen admin ile iletişime geçin.')
      } else if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        setError('Bu dosya zaten yüklenmiş. Lütfen farklı bir dosya seçin.')
      } else if (errorMessage.includes('Row Level Security') || errorMessage.includes('RLS') || errorMessage.includes('policy')) {
        setError('Dosya yükleme yetkisi yok. Lütfen admin ile iletişime geçin veya sayfayı yenileyin.')
      } else if (errorMessage.includes('new row violates')) {
        setError('Dosya yükleme yetkisi yok. Lütfen admin ile iletişime geçin.')
      } else {
        setError(`Dosya yüklenirken hata oluştu: ${errorMessage}. Lütfen tekrar deneyin.`)
      }
      return null
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (!subject) {
      setError('Lütfen bir konu seçin')
      return
    }

    if (!message.trim() || message.trim().length < 10) {
      setError('Mesaj en az 10 karakter olmalıdır')
      return
    }

    startTransition(async () => {
      let fileUrl: string | null = null

      // Upload file if exists
      if (file) {
        fileUrl = await uploadFile()
        // If upload fails, error is already set in uploadFile function
        if (!fileUrl) {
          return
        }
      }

      const result = await createSupportTicket({
        subject: subject as 'Ödeme Sorunu' | 'Teknik Hata' | 'Şikayet/Bildirim' | 'Öneri',
        priority,
        message: message.trim(),
        fileUrl,
      })

      if (result.success && result.ticketNumber) {
        setSuccess({ ticketNumber: result.ticketNumber })
        // Reset form
        setSubject('')
        setPriority('Orta')
        setMessage('')
        setFile(null)
        setFilePreview(null)
        
        // Notify parent component about new ticket
        if (result.ticketId && onTicketCreated) {
          // Fetch the new ticket to pass to parent
          const { data: newTicket } = await supabase
            .from('support_tickets')
            .select('id, subject, priority, status, message, admin_response, created_at, updated_at')
            .eq('id', result.ticketId)
            .single()
          
          if (newTicket) {
            onTicketCreated(newTicket as SupportTicket)
          }
        }
        
        // Clear success message after 10 seconds
        setTimeout(() => setSuccess(null), 10000)
      } else {
        setError(result.error || 'Destek talebi oluşturulamadı')
      }
    })
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-2">
          <HelpCircle className="h-5 w-5 text-soft-gold" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Yardım ve Destek</h2>
          <p className="mt-1 text-sm text-gray-400">Sorunlarınız için bizimle iletişime geçin</p>
        </div>
      </div>

      {success && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-200">Destek talebiniz alındı!</p>
              <p className="mt-1 text-xs text-emerald-300/80">Talep No: #{success.ticketNumber}</p>
              <p className="mt-2 text-xs text-emerald-300/70">
                Talebiniz en kısa sürede incelenecek ve size geri dönüş yapılacaktır.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Subject */}
        <div>
          <label htmlFor="subject" className="mb-2 block text-sm font-medium text-gray-300">
            Konu <span className="text-red-400">*</span>
          </label>
          <select
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as typeof subject)}
            disabled={isPending || uploading}
            className="w-full rounded-xl border border-white/10 bg-[#11121A] px-4 py-3 text-white transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50 disabled:cursor-not-allowed [&>option]:bg-[#11121A] [&>option]:text-white"
            required
          >
            <option value="" className="bg-[#11121A] text-gray-400">Konu seçin</option>
            <option value="Ödeme Sorunu" className="bg-[#11121A] text-white">Ödeme Sorunu</option>
            <option value="Teknik Hata" className="bg-[#11121A] text-white">Teknik Hata</option>
            <option value="Şikayet/Bildirim" className="bg-[#11121A] text-white">Şikayet/Bildirim</option>
            <option value="Öneri" className="bg-[#11121A] text-white">Öneri</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label htmlFor="priority" className="mb-2 block text-sm font-medium text-gray-300">
            Öncelik <span className="text-red-400">*</span>
          </label>
          <select
            id="priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value as typeof priority)}
            disabled={isPending || uploading}
            className="w-full rounded-xl border border-white/10 bg-[#11121A] px-4 py-3 text-white transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50 disabled:cursor-not-allowed [&>option]:bg-[#11121A] [&>option]:text-white"
            required
          >
            <option value="Düşük" className="bg-[#11121A] text-white">Düşük</option>
            <option value="Orta" className="bg-[#11121A] text-white">Orta</option>
            <option value="Acil" className="bg-[#11121A] text-white">Acil</option>
          </select>
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-300">
            Mesaj <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={isPending || uploading}
            rows={6}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            placeholder="Lütfen sorununuzu veya talebinizi detaylı bir şekilde açıklayın (en az 10 karakter)..."
            required
            minLength={10}
          />
          <p className="mt-1 text-xs text-gray-400">{message.length} / 10+ karakter</p>
        </div>

        {/* File Upload */}
        <div>
          <label htmlFor="file" className="mb-2 block text-sm font-medium text-gray-300">
            Dosya Ekle (Opsiyonel)
          </label>
          {!filePreview ? (
            <label
              htmlFor="file"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center transition hover:border-soft-gold/50 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-400">Ekran görüntüsü yüklemek için tıklayın (Max 5MB)</span>
              <input
                id="file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isPending || uploading}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative rounded-xl border border-white/10 bg-white/5 p-4">
              <button
                type="button"
                onClick={handleRemoveFile}
                disabled={isPending || uploading}
                className="absolute right-2 top-2 rounded-lg border border-white/20 bg-black/60 p-1 text-gray-400 transition hover:border-white/40 hover:text-white disabled:opacity-50"
                aria-label="Dosyayı kaldır"
              >
                <X className="h-4 w-4" />
              </button>
              <Image src={filePreview} alt="Preview" width={400} height={192} className="max-h-48 w-full rounded-lg object-contain" />
              <p className="mt-2 text-xs text-gray-400">{file?.name}</p>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || uploading || !subject || !message.trim()}
          className="w-full rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading
            ? 'Dosya yükleniyor...'
            : isPending
              ? 'Gönderiliyor...'
              : 'Destek Talebi Gönder'}
        </button>
      </form>
    </section>
  )
}

