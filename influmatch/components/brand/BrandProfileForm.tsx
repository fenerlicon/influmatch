'use client'

import Image from 'next/image'
import { type ReactNode, useState, useTransition, useEffect, useCallback } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Building2, Globe, Instagram, Linkedin, MapPin, Upload } from 'lucide-react'
import { updateBrandProfile } from '@/app/dashboard/brand/profile/actions'
import { validateInstagram, validateLinkedIn, validateWebsite } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import BadgeSelector from '@/components/badges/BadgeSelector'

const CATEGORY_OPTIONS = ['Teknoloji', 'Giyim', 'Kozmetik', 'Hizmet', 'Ajans', 'Oyun', 'Finans']
const LOGO_BUCKET = 'avatars'

interface BrandProfileFormProps {
  initialData: {
    brandName: string
    username: string
    city: string
    bio: string
    category: string
    logoUrl: string | null
    website: string
    linkedin: string
    instagram: string
    displayedBadges?: string[]
    availableBadgeIds?: string[]
  }
}

export default function BrandProfileForm({ initialData }: BrandProfileFormProps) {
  const supabase = useSupabaseClient()
  const [formState, setFormState] = useState({
    brandName: initialData.brandName ?? '',
    username: initialData.username ?? '',
    city: initialData.city ?? '',
    bio: initialData.bio ?? '',
    category: initialData.category ?? CATEGORY_OPTIONS[0],
    website: initialData.website ?? '',
    linkedin: initialData.linkedin ?? '',
    instagram: initialData.instagram ?? '',
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logoUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [validationErrors, setValidationErrors] = useState<{
    username?: string
    website?: string
    linkedin?: string
    instagram?: string
  }>({})
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [selectedBadges, setSelectedBadges] = useState<string[]>(initialData.displayedBadges ?? [])

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.trim().length === 0) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const excludeUserId = user?.id || null

      const response = await fetch(`/api/check-username?username=${encodeURIComponent(username.trim())}&excludeUserId=${excludeUserId || ''}`)
      const data = await response.json()

      if (data.available) {
        setUsernameStatus('available')
      } else {
        setUsernameStatus('taken')
      }
    } catch (error) {
      console.error('Username check error:', error)
      setUsernameStatus('idle')
    }
  }, [supabase])

  useEffect(() => {
    if (formState.username === initialData.username) {
      // If username hasn't changed from initial, don't check
      setUsernameStatus('idle')
      return
    }

    const timeoutId = setTimeout(() => {
      checkUsername(formState.username)
    }, 500) // Debounce 500ms

    return () => clearTimeout(timeoutId)
  }, [formState.username, checkUsername, initialData.username])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    
    // Normalize username to lowercase if it's the username field
    if (name === 'username') {
      const normalized = value.toLowerCase()
      setFormState((prev) => ({ ...prev, [name]: normalized }))
      
      // Validate username format
      const validation = validateUsername(normalized)
      if (validation.isValid) {
        setValidationErrors((prev) => ({
          ...prev,
          username: undefined,
        }))
        setUsernameStatus('idle')
      } else {
        setValidationErrors((prev) => ({
          ...prev,
          username: validation.error,
        }))
        setUsernameStatus('idle') // Don't check availability if format is invalid
        return // Don't proceed with availability check
      }
    } else {
      setFormState((prev) => ({ ...prev, [name]: value }))
    }

    // Reset username status when username changes
    if (name === 'username') {
      setUsernameStatus('idle')
    }

    // Validate social links in real-time
    if (name === 'website') {
      const result = validateWebsite(value)
      setValidationErrors((prev) => ({
        ...prev,
        website: result.isValid ? undefined : result.error,
      }))
    } else if (name === 'linkedin') {
      const result = validateLinkedIn(value)
      setValidationErrors((prev) => ({
        ...prev,
        linkedin: result.isValid ? undefined : result.error,
      }))
    } else if (name === 'instagram') {
      const result = validateInstagram(value)
      setValidationErrors((prev) => ({
        ...prev,
        instagram: result.isValid ? undefined : result.error,
      }))
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    const maxSize = 5 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Lütfen PNG, JPG veya WEBP formatında bir logo yükleyin.')
      return
    }

    if (file.size > maxSize) {
      setErrorMsg('Logo maksimum 5MB olabilir.')
      return
    }

    setIsUploading(true)
    setErrorMsg(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      })
      if (uploadError) {
        throw uploadError
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(fileName)
      setLogoUrl(publicUrl)
    } catch (error) {
      console.error('Logo upload failed', error)
      setErrorMsg('Logo yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMsg(null)

    // Validate username format
    const usernameValidation = validateUsername(formState.username)
    if (!usernameValidation.isValid) {
      setValidationErrors((prev) => ({
        ...prev,
        username: usernameValidation.error,
      }))
      setErrorMsg(usernameValidation.error || 'Kullanıcı adı geçersiz.')
      return
    }

    if (usernameStatus === 'taken') {
      setErrorMsg('Lütfen müsait bir kullanıcı adı seçin.')
      return
    }
    if (usernameStatus === 'checking') {
      setErrorMsg('Kullanıcı adı kontrolü devam ediyor, lütfen bekleyin.')
      return
    }

    // Validate all social links before submitting
    const websiteResult = validateWebsite(formState.website)
    const linkedinResult = validateLinkedIn(formState.linkedin)
    const instagramResult = validateInstagram(formState.instagram)

    const errors: typeof validationErrors = {}
    if (!websiteResult.isValid) errors.website = websiteResult.error
    if (!linkedinResult.isValid) errors.linkedin = linkedinResult.error
    if (!instagramResult.isValid) errors.instagram = instagramResult.error

    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setErrorMsg('Lütfen sosyal medya linklerini düzeltin.')
      return
    }

    startTransition(async () => {
      try {
        await updateBrandProfile({
          brandName: formState.brandName,
          username: formState.username,
          city: formState.city,
          bio: formState.bio,
          category: formState.category,
          logoUrl,
          website: websiteResult.normalizedUrl || formState.website.trim() || '',
          linkedin: linkedinResult.normalizedUrl || formState.linkedin.trim() || '',
          instagram: instagramResult.normalizedUrl || formState.instagram.trim() || '',
          displayedBadges: selectedBadges,
        })
        setToast('Şirket bilgileri güncellendi.')
        setTimeout(() => setToast(null), 3000)
      } catch (error) {
        console.error('updateBrandProfile failed', error)
        setErrorMsg(error instanceof Error ? error.message : 'Profil güncellenemedi.')
      }
    })
  }

  const renderInput = (label: string, name: string, value: string, icon: ReactNode, placeholder?: string, type: string = 'text') => (
    <label className="space-y-2 text-sm text-gray-300">
      <span>{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-soft-gold">{icon}</span>
        <input
          type={type}
          name={name}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
        />
      </div>
    </label>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101117] to-[#090a0f] p-6 text-white shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Kurumsal Profil</p>
        <h1 className="mt-3 text-3xl font-semibold">Kurumsal Profil Ayarları</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">
          Markanı influencer topluluğuna güven veren bir dille tanıt. Logo, temel kimlik bilgileri ve iletişim noktaların burada yönetilir.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0C0D10] p-6 shadow-glow">
          <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Marka Kimliği</p>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#11121A] p-6">
            <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              {logoUrl ? (
                <Image src={logoUrl} alt="Şirket Logosu" fill sizes="112px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Logo yükleyin</div>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm text-white transition hover:border-soft-gold hover:text-soft-gold">
              <Upload className="h-4 w-4" />
              {isUploading ? 'Yükleniyor...' : 'Şirket Logosu (PNG/JPG)'}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
            </label>
          </div>

          {renderInput('Marka Adı', 'brandName', formState.brandName, <Building2 className="h-4 w-4" />, 'Örn: Influmatch Studios')}

          <div>
            <label className="space-y-2 text-sm text-gray-300">
              <span>Kullanıcı Adı</span>
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                validationErrors.username || usernameStatus === 'taken'
                  ? 'border-red-500/60 bg-red-500/10'
                  : usernameStatus === 'available'
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-white/10 bg-white/5'
              }`}>
                <span className="text-soft-gold"><Building2 className="h-4 w-4" /></span>
                <input
                  type="text"
                  name="username"
                  value={formState.username}
                  onChange={handleChange}
                  placeholder="@marka"
                  className="w-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none"
                />
              </div>
              {validationErrors.username && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.username}</p>
              )}
              {!validationErrors.username && usernameStatus === 'checking' && (
                <p className="mt-1 text-xs text-gray-400">Kullanıcı adı kontrol ediliyor...</p>
              )}
              {!validationErrors.username && usernameStatus === 'available' && (
                <p className="mt-1 text-xs text-emerald-400">Kullanıcı adı müsait</p>
              )}
              {!validationErrors.username && usernameStatus === 'taken' && (
                <p className="mt-1 text-xs text-red-400">Bu kullanıcı adı kullanılmakta</p>
              )}
            </label>
          </div>

          <label className="space-y-2 text-sm text-gray-300">
            <span>Sektör</span>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <select
                name="category"
                value={formState.category}
                onChange={handleChange}
                className="w-full bg-transparent text-white focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-[#1B1C24] text-white">
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0C0D10] p-6 shadow-glow">
          <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Detaylar & İletişim</p>

          <div>
            {renderInput('Web Sitesi', 'website', formState.website, <Globe className="h-4 w-4" />, 'https://')}
            {validationErrors.website && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.website}</p>
            )}
          </div>

          {renderInput('Merkez / Şehir', 'city', formState.city, <MapPin className="h-4 w-4" />, 'İstanbul, Türkiye')}

          <label className="space-y-2 text-sm text-gray-300">
            <span>Hakkımızda / Vizyon</span>
            <textarea
              name="bio"
              value={formState.bio}
              onChange={handleChange}
              rows={6}
              placeholder="Markanı ve kampanya yaklaşımını influencerlara anlat."
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-gray-500 focus:outline-none"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              {renderInput('LinkedIn', 'linkedin', formState.linkedin, <Linkedin className="h-4 w-4" />, 'https://linkedin.com/company/...')}
              {validationErrors.linkedin && (
                <p className="mt-1 text-xs text-red-300">{validationErrors.linkedin}</p>
              )}
            </div>
            <div>
              {renderInput('Instagram', 'instagram', formState.instagram, <Instagram className="h-4 w-4" />, '@kullaniciadi veya https://instagram.com/...')}
              {validationErrors.instagram && (
                <p className="mt-1 text-xs text-red-300">{validationErrors.instagram}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/10 bg-[#0C0D10] p-6 shadow-glow">
        <BadgeSelector
          userRole="brand"
          selectedBadgeIds={selectedBadges}
          availableBadgeIds={initialData.availableBadgeIds ?? []}
          onSelectionChange={setSelectedBadges}
        />
      </div>

      {errorMsg ? <p className="text-sm text-red-300">{errorMsg}</p> : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
        </button>
      </div>

      {toast ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-3 text-sm text-soft-gold shadow-glow">
          {toast}
        </div>
      ) : null}
    </form>
  )
}


