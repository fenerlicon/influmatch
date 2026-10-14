'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { submitFeedback } from './actions'
import { X, Upload } from 'lucide-react'
import LandingHeader from '@/components/landing/LandingHeader'
import { Button, Card, CardBody, Eyebrow, Field, Notice, Textarea } from '@/components/ui'

export default function FeedbackPage() {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Lütfen bir görsel dosyası seçin.')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Görsel boyutu en fazla 5MB olabilir.')
      return
    }

    setImageFile(file)
    setError(null)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError('Lütfen geri bildiriminizi yazın.')
      return
    }

    let imageUrl: string | null = null

    // Upload image if provided
    if (imageFile) {
      setIsUploading(true)
      try {
        const fileExt = imageFile.name.split('.').pop()
        const fileName = `feedback-${crypto.randomUUID()}.${fileExt}`
        const { error: uploadError } = await supabase.storage
          .from('feedback-images')
          .upload(fileName, imageFile)

        if (uploadError) {
          throw uploadError
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('feedback-images').getPublicUrl(fileName)
        imageUrl = publicUrl
      } catch (err) {
        console.error('Image upload failed', err)
        setError('Görsel yüklenemedi. Lütfen tekrar deneyin.')
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }

    startTransition(async () => {
      const result = await submitFeedback({
        description,
        imageUrl,
      })

      if (result.error) {
        setError(result.error)
      } else {
        // Redirect to thank you page
        router.push('/feedback/thank-you')
      }
    })
  }

  return (
    <div className="min-h-screen bg-background text-ink">
      <LandingHeader />
      <main className="mx-auto max-w-[640px] px-4 py-10 sm:px-6 md:py-14">
        <Eyebrow>Geri bildirim</Eyebrow>
        <h1 className="mb-2 mt-3 font-display text-[36px] font-normal leading-[1.1]">Hata ve önerilerini paylaş</h1>
        <p className="mb-6 text-ink-muted">Bu bir MVP sürümü. Karşılaştığın hataları ve önerilerini ekiple paylaş.</p>

        <Card>
          <CardBody>
            <form onSubmit={handleSubmit} className="grid gap-5">
              <Field label="Geri bildirimin">
                {(props) => (
                  <Textarea
                    {...props}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    required
                    placeholder="Hata, öneri veya geri bildirimini buraya yaz…"
                  />
                )}
              </Field>

              <div className="grid gap-1.5">
                <span className="text-[12.5px] font-medium text-ink-muted">Ekran görüntüsü (isteğe bağlı)</span>
                {imagePreview ? (
                  <div className="relative rounded-xl border border-line bg-surface-2 p-3">
                    {/* Yerel önizleme (data URL); görsel optimizasyonundan geçirilmez. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imagePreview} alt="Seçilen ekran görüntüsü" className="max-h-64 w-full rounded-lg object-contain" />
                    <Button size="sm" variant="secondary" iconOnly aria-label="Görseli kaldır" onClick={handleRemoveImage} className="absolute right-2 top-2">
                      <X />
                    </Button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2 p-8 text-center transition-colors hover:border-gold/40">
                    <Upload className="mb-2 h-6 w-6 text-ink-faint" aria-hidden />
                    <span className="text-[13px] text-ink-muted">Görsel yüklemek için tıkla</span>
                    <span className="mt-1 text-xs text-ink-faint">PNG, JPG, WEBP (en fazla 5 MB)</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={handleImageSelect} />
                  </label>
                )}
              </div>

              {error && <Notice tone="danger">{error}</Notice>}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => router.back()}>Vazgeç</Button>
                <Button type="submit" variant="primary" loading={isPending || isUploading}>
                  {isUploading ? 'Yükleniyor…' : 'Gönder'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </main>
    </div>
  )
}
