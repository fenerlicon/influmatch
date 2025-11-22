'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { submitFeedback } from './actions'
import { X, Upload, Loader2 } from 'lucide-react'

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
    <div className="min-h-screen bg-background px-4 py-10 text-white sm:px-8 lg:px-20">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-glow">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Geri Bildirim Gönder</h1>
            <p className="mt-2 text-sm text-gray-300">
              Bu bir MVP sürümüdür. Hata ve geribildirimlerinizi bizimle paylaşın.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                Geri Bildiriminiz <span className="text-red-400">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                required
                placeholder="Hata, öneri veya geri bildiriminizi buraya yazın..."
                className="w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-white placeholder:text-gray-500 outline-none transition focus:border-soft-gold resize-none"
              />
            </div>

            <div>
              <label htmlFor="image" className="block text-sm font-medium text-gray-300 mb-2">
                Ekran Görüntüsü (Opsiyonel)
              </label>
              {imagePreview ? (
                <div className="relative rounded-2xl border border-white/10 bg-[#11121A] p-4">
                  <img src={imagePreview} alt="Preview" className="max-h-64 w-full rounded-xl object-contain" />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute right-2 top-2 rounded-full border border-white/20 bg-black/60 p-2 text-white transition hover:bg-black/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-[#11121A] p-8 transition hover:border-soft-gold/40">
                  <Upload className="mb-2 h-8 w-8 text-gray-400" />
                  <span className="text-sm text-gray-400">Görsel yüklemek için tıklayın</span>
                  <span className="mt-1 text-xs text-gray-500">PNG, JPG, WEBP (Max 5MB)</span>
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 rounded-2xl border border-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={isPending || isUploading}
                className="flex-1 rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending || isUploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isUploading ? 'Yükleniyor...' : 'Gönderiliyor...'}
                  </span>
                ) : (
                  'Gönder'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

