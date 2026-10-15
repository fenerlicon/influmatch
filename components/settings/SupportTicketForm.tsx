'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { createSupportTicket } from '@/app/dashboard/influencer/settings/support/actions'
import { Upload, X } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Field, Notice, Select, Textarea } from '@/components/ui'
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
  const [success, setSuccess] = useState<{ ticketCode: string } | null>(null)
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

      if (result.success && result.ticketCode) {
        setSuccess({ ticketCode: result.ticketCode })
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

  const busy = isPending || uploading

  return (
    <Card>
      <CardHeader title="Destek talebi oluştur" description="Sorununu yaz; ekip yanıtladığında burada ve e-postada görürsün." />
      <CardBody>
        {success && (
          <Notice tone="success" className="mb-4">
            Talebin alındı (No: #{success.ticketCode}). En kısa sürede yanıtlanacak.
          </Notice>
        )}
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Konu">
              {(props) => (
                <Select {...props} value={subject} onChange={(e) => setSubject(e.target.value as typeof subject)} disabled={busy} required>
                  <option value="">Konu seçin</option>
                  <option value="Ödeme Sorunu">Ödeme sorunu</option>
                  <option value="Teknik Hata">Teknik hata</option>
                  <option value="Şikayet/Bildirim">Şikayet / bildirim</option>
                  <option value="Öneri">Öneri</option>
                </Select>
              )}
            </Field>
            <Field label="Öncelik">
              {(props) => (
                <Select {...props} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} disabled={busy} required>
                  <option value="Düşük">Düşük</option>
                  <option value="Orta">Orta</option>
                  <option value="Acil">Acil</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Mesaj" hint={`${message.length} karakter · en az 10`}>
            {(props) => (
              <Textarea
                {...props}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={busy}
                rows={6}
                placeholder="Sorununu ya da talebini ayrıntılı anlat…"
                required
                minLength={10}
              />
            )}
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] text-ink-muted">Ekran görüntüsü (isteğe bağlı)</p>
            {!filePreview ? (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-[13px] text-ink-muted transition-colors hover:border-gold/50 hover:text-ink">
                <Upload className="h-4 w-4" aria-hidden />
                Görsel seç (en fazla 5 MB)
                <input type="file" accept="image/*" onChange={handleFileChange} disabled={busy} className="sr-only" />
              </label>
            ) : (
              <div className="relative rounded-xl border border-line bg-surface-2 p-3">
                <Button variant="ghost" size="sm" iconOnly aria-label="Dosyayı kaldır" onClick={handleRemoveFile} disabled={busy} className="absolute right-2 top-2">
                  <X />
                </Button>
                <Image src={filePreview} alt="Seçilen görsel" width={400} height={192} className="max-h-48 w-full rounded-lg object-contain" />
                <p className="mt-2 truncate text-xs text-ink-faint">{file?.name}</p>
              </div>
            )}
          </div>
          {error && <Notice tone="danger">{error}</Notice>}
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={busy} disabled={!subject || !message.trim()}>
              {uploading ? 'Dosya yükleniyor…' : 'Talebi gönder'}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
