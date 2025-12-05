'use client'

import Image from 'next/image'
import { type ReactNode, useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Building2, Globe, Instagram, Linkedin, MapPin, Upload, FileText, Info, Edit2, X, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { updateBrandProfile } from '@/app/dashboard/brand/profile/actions'
import { validateInstagram, validateLinkedIn, validateWebsite, validateKick, validateTwitter, validateTwitch } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import BadgeSelector from '@/components/badges/BadgeSelector'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import { BRAND_CATEGORIES, BRAND_CATEGORY_KEYS } from '@/utils/categories'
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
    kick?: string
    twitter?: string
    twitch?: string
    displayedBadges?: string[]
    availableBadgeIds?: string[]
    companyLegalName?: string
    taxId?: string
    taxIdVerified?: boolean | null
    socialLinksLastUpdated?: string | null
  }
}

export default function BrandProfileForm({ initialData }: BrandProfileFormProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id)
    })
  }, [supabase])

  const [formState, setFormState] = useState({
    brandName: initialData.brandName ?? '',
    username: initialData.username ?? '',
    city: initialData.city ?? '',
    bio: initialData.bio ?? '',
    category: initialData.category ?? BRAND_CATEGORY_KEYS[0],
    website: initialData.website ?? '',
    linkedin: initialData.linkedin ?? '',
    instagram: initialData.instagram ?? '',
    kick: initialData.kick ?? '',
    twitter: initialData.twitter ?? '',
    twitch: initialData.twitch ?? '',
    companyLegalName: initialData.companyLegalName ?? '',
    taxId: initialData.taxId ?? '',
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
    kick?: string
    twitter?: string
    twitch?: string
  }>({})
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [selectedBadges, setSelectedBadges] = useState<string[]>(initialData.displayedBadges ?? [])
  const [isEditing, setIsEditing] = useState(false)
  const [isEditingCorporate, setIsEditingCorporate] = useState(false)

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
    } else if (name === 'kick') {
      const result = validateKick(value)
      setValidationErrors((prev) => ({
        ...prev,
        kick: result.isValid ? undefined : result.error,
      }))
    } else if (name === 'twitter') {
      const result = validateTwitter(value)
      setValidationErrors((prev) => ({
        ...prev,
        twitter: result.isValid ? undefined : result.error,
      }))
    } else if (name === 'twitch') {
      const result = validateTwitch(value)
      setValidationErrors((prev) => ({
        ...prev,
        twitch: result.isValid ? undefined : result.error,
      }))
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    const maxSize = 5 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Sadece PNG, JPEG ve WEBP formatları desteklenmektedir.')
      return
    }

    if (file.size > maxSize) {
      setErrorMsg('Dosya boyutu 5MB\'dan küçük olmalıdır.')
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
      setErrorMsg('Logo yüklenirken bir hata oluştu.')
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
      setErrorMsg(usernameValidation.error || 'Bu kullanıcı adı alınmış.')
      return
    }

    if (usernameStatus === 'taken') {
      setErrorMsg('Bu kullanıcı adı alınmış.')
      return
    }
    if (usernameStatus === 'checking') {
      setErrorMsg('Kullanıcı adı kontrol ediliyor...')
      return
    }

    // Validate all social links before submitting
    const websiteResult = validateWebsite(formState.website)
    const linkedinResult = validateLinkedIn(formState.linkedin)
    const instagramResult = validateInstagram(formState.instagram)
    const kickResult = validateKick(formState.kick)
    const twitterResult = validateTwitter(formState.twitter)
    const twitchResult = validateTwitch(formState.twitch)

    const errors: typeof validationErrors = {}
    if (!websiteResult.isValid) errors.website = websiteResult.error
    if (!linkedinResult.isValid) errors.linkedin = linkedinResult.error
    if (!instagramResult.isValid) errors.instagram = instagramResult.error
    if (!kickResult.isValid) errors.kick = kickResult.error
    if (!twitterResult.isValid) errors.twitter = twitterResult.error
    if (!twitchResult.isValid) errors.twitch = twitchResult.error

    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setErrorMsg('Lütfen sosyal medya linklerinizi kontrol edin.')
      return
    }

    // Check if at least one social media account or website is provided
    const hasAtLeastOneSocial =
      (websiteResult.isValid && (websiteResult.normalizedUrl || formState.website.trim())) ||
      (linkedinResult.isValid && (linkedinResult.normalizedUrl || formState.linkedin.trim())) ||
      (instagramResult.isValid && (instagramResult.normalizedUrl || formState.instagram.trim())) ||
      (kickResult.isValid && (kickResult.normalizedUrl || formState.kick?.trim())) ||
      (twitterResult.isValid && (twitterResult.normalizedUrl || formState.twitter?.trim())) ||
      (twitchResult.isValid && (twitchResult.normalizedUrl || formState.twitch?.trim()))

    if (!hasAtLeastOneSocial) {
      setErrorMsg('En az bir sosyal medya hesabı veya web sitesi girmelisiniz.')
      return
    }

    startTransition(async () => {
      try {
        const result = await updateBrandProfile({
          brandName: formState.brandName,
          username: formState.username,
          city: formState.city,
          bio: formState.bio,
          category: formState.category,
          logoUrl,
          website: websiteResult.normalizedUrl || formState.website.trim() || '',
          linkedin: linkedinResult.normalizedUrl || formState.linkedin.trim() || '',
          instagram: instagramResult.normalizedUrl || formState.instagram.trim() || '',
          kick: kickResult.normalizedUrl || null,
          twitter: twitterResult.normalizedUrl || null,
          twitch: twitchResult.normalizedUrl || null,
          displayedBadges: selectedBadges,
          companyLegalName: formState.companyLegalName.trim() || null,
          taxId: formState.taxId.trim() || null,
        })

        if (result?.success) {
          setToast('Profil başarıyla güncellendi!')
          setTimeout(() => setToast(null), 3000)
          setIsEditing(false) // Exit edit mode after successful save
          // Don't refresh - form state is already correct
          // The revalidatePath in the action will handle cache invalidation
        } else {
          throw new Error('Profil güncellenemedi.')
        }
      } catch (error) {
        console.error('updateBrandProfile failed', error)
        setErrorMsg(error instanceof Error ? error.message : 'Profil güncellenemedi.')
      }
    })
  }

  const renderInput = (label: string, name: string, value: string, icon: ReactNode, placeholder?: string, disabled?: boolean, type: string = 'text') => (
    <label className="space-y-2 text-sm text-gray-300">
      <span>{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-soft-gold">{icon}</span>
        <input
          type={type}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={disabled !== undefined ? disabled : !isEditing}
          placeholder={placeholder}
          className="w-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </label>
  )

  const renderCitySelect = (label: string, name: string, value: string, icon: ReactNode) => (
    <label className="space-y-2 text-sm text-gray-300">
      <span>{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <span className="text-soft-gold">{icon}</span>
        <select
          name={name}
          value={value}
          onChange={handleChange}
          disabled={!isEditing}
          className="w-full bg-transparent text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Şehir Seçin</option>
          {TURKISH_CITIES.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>
    </label>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#101117] to-[#090a0f] p-6 text-white shadow-glow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Kurumsal Profil</p>
            <h1 className="mt-3 text-3xl font-semibold">Kurumsal Profil Ayarları</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-300">
              Markanı influencer topluluğuna güven veren bir dille tanıt. Logo, temel kimlik bilgileri ve iletişim noktaların burada yönetilir.
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-soft-gold/60 bg-soft-gold/10 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
            >
              Profili Düzenle
            </button>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0C0D10] p-6 shadow-glow">
          <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Şirket Logosu</p>
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#11121A] p-6">
            <div className="relative h-28 w-28 overflow-hidden rounded-3xl border border-white/10 bg-black/30">
              {logoUrl ? (
                <Image src={logoUrl} alt="Şirket Logosu" fill sizes="112px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Logo yükleyin</div>
              )}
            </div>
            <label className={`inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-2 text-sm text-white transition ${isEditing
              ? 'cursor-pointer hover:border-soft-gold hover:text-soft-gold'
              : 'cursor-not-allowed opacity-50'
              }`}>
              <Upload className="h-4 w-4" />
              {isUploading ? 'Yükleniyor...' : 'Logo Yükle'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
                disabled={isUploading || !isEditing}
              />
            </label>
          </div>

          {renderInput('Marka Adı', 'brandName', formState.brandName, <Building2 className="h-4 w-4" />, 'Örn: Influmatch Studios')}

          <div>
            <label className="space-y-2 text-sm text-gray-300">
              <span>Kullanıcı Adı</span>
              <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${validationErrors.username || usernameStatus === 'taken'
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
                  disabled={!isEditing || (initialData.username && initialData.username.trim() !== '') ? true : undefined}
                  placeholder="@marka"
                  className="w-full bg-transparent text-white placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              {initialData.username && initialData.username.trim() !== '' && (
                <p className="mt-1 text-xs text-gray-400">Kullanıcı adı bir kez belirlendikten sonra değiştirilemez.</p>
              )}
              {validationErrors.username && (
                <p className="mt-1 text-xs text-red-400">{validationErrors.username}</p>
              )}
              {!validationErrors.username && !initialData.username && usernameStatus === 'checking' && (
                <p className="mt-1 text-xs text-gray-400">Kullanıcı adı kontrol ediliyor...</p>
              )}
              {!validationErrors.username && !initialData.username && usernameStatus === 'available' && (
                <p className="mt-1 text-xs text-emerald-400">Kullanıcı adı müsait</p>
              )}
              {!validationErrors.username && !initialData.username && usernameStatus === 'taken' && (
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
                disabled={!isEditing}
                className="w-full bg-transparent text-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              >
                {BRAND_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key} className="bg-[#1B1C24] text-white">
                    {BRAND_CATEGORIES[key]}
                  </option>
                ))}
              </select>
            </div>
          </label>
        </div>

        <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0C0D10] p-6 shadow-glow">
          <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">DETAYLAR</p>

          <div>
            {renderInput('Web Sitesi', 'website', formState.website, <Globe className="h-4 w-4" />, 'www.ornek.com')}
            {validationErrors.website && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.website}</p>
            )}
          </div>

          {renderCitySelect('Şehir', 'city', formState.city, <MapPin className="h-4 w-4" />)}

          <label className="space-y-2 text-sm text-gray-300">
            <span>Hakkında</span>
            <textarea
              name="bio"
              value={formState.bio}
              onChange={handleChange}
              disabled={!isEditing}
              rows={6}
              placeholder="Markanız hakkında kısa bir bilgi..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-white placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          {initialData.socialLinksLastUpdated && (() => {
            const lastUpdated = new Date(initialData.socialLinksLastUpdated)
            const now = new Date()
            const daysSinceLastUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24))
            const daysRemaining = 30 - daysSinceLastUpdate

            if (daysRemaining > 0) {
              return (
                <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 mb-5">
                  <p className="text-sm text-yellow-200">
                    <strong>Bilgi:</strong> Sosyal medya hesaplarınızı 30 günde sadece 1 kez değiştirebilirsiniz.
                    {daysRemaining > 0 && (
                      <span className="ml-1"> {daysRemaining} gün sonra tekrar değiştirebilirsiniz.</span>
                    )}
                  </p>
                </div>
              )
            }
            return null
          })()}

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
            <div>
              {renderInput('Kick', 'kick', formState.kick, <Globe className="h-4 w-4" />, '@kullaniciadi veya https://kick.com/...')}
              {validationErrors.kick && (
                <p className="mt-1 text-xs text-red-300">{validationErrors.kick}</p>
              )}
            </div>
            <div>
              {renderInput('Twitter/X', 'twitter', formState.twitter, <Globe className="h-4 w-4" />, '@kullaniciadi veya https://twitter.com/...')}
              {validationErrors.twitter && (
                <p className="mt-1 text-xs text-red-300">{validationErrors.twitter}</p>
              )}
            </div>
            <div>
              {renderInput('Twitch', 'twitch', formState.twitch, <Globe className="h-4 w-4" />, '@kullaniciadi veya https://twitch.tv/...')}
              {validationErrors.twitch && (
                <p className="mt-1 text-xs text-red-300">{validationErrors.twitch}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Kurumsal Kimlik Section */}
      <div className="space-y-5 rounded-3xl border border-white/10 bg-[#0C0D10] p-6 shadow-glow">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">Kurumsal Kimlik</p>
              {!isEditingCorporate && (
                <button
                  type="button"
                  onClick={() => setIsEditingCorporate(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-soft-gold/40 bg-soft-gold/10 px-3 py-1.5 text-xs font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Düzenle
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-400">
              Bu bilgileri dolduran markalar, güvenlik kontrolünden sonra <span className="text-soft-gold">"Resmi İşletme"</span> rozeti kazanır ve influencerlar tarafından daha çok tercih edilir.
            </p>
          </div>
        </div>

        {renderInput(
          'Resmi Şirket Unvanı',
          'companyLegalName',
          formState.companyLegalName,
          <FileText className="h-4 w-4" />,
          'Opsiyonel',
          !isEditingCorporate ? true : undefined
        )}

        {renderInput(
          'Vergi Numarası',
          'taxId',
          formState.taxId,
          <FileText className="h-4 w-4" />,
          'Vergi numaranızı girin',
          !isEditingCorporate ? true : undefined
        )}

        {/* Vergi Numarası Durumu */}
        {formState.taxId && formState.taxId.trim() && (
          <div className={`mt-2 rounded-xl border p-3 ${initialData.taxIdVerified
            ? 'border-emerald-500/40 bg-emerald-500/10'
            : 'border-yellow-500/40 bg-yellow-500/10'
            }`}>
            <div className="flex items-center gap-2">
              {initialData.taxIdVerified ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-emerald-300">Doğrulandı</span>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs font-semibold text-yellow-300">Onay Bekliyor</span>
                </>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {initialData.taxIdVerified
                ? 'Vergi numaranız doğrulandı.'
                : 'Vergi numaranız inceleniyor.'}
            </p>
          </div>
        )}

        {isEditingCorporate && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={async () => {
                setErrorMsg(null)
                startTransition(async () => {
                  try {
                    const result = await updateBrandProfile({
                      brandName: formState.brandName,
                      username: formState.username,
                      city: formState.city,
                      bio: formState.bio,
                      category: formState.category,
                      logoUrl,
                      website: formState.website.trim() || '',
                      linkedin: formState.linkedin.trim() || '',
                      instagram: formState.instagram.trim() || '',
                      kick: formState.kick?.trim() || null,
                      twitter: formState.twitter?.trim() || null,
                      twitch: formState.twitch?.trim() || null,
                      displayedBadges: selectedBadges,
                      companyLegalName: formState.companyLegalName.trim() || null,
                      taxId: formState.taxId.trim() || null,
                    })
                    if (!result.success) {
                      setErrorMsg((result as any).error || 'Güncelleme başarısız.')
                    } else {
                      setToast('Kurumsal bilgiler güncellendi!')
                      setIsEditingCorporate(false)
                      router.refresh()
                    }
                  } catch (error) {
                    console.error('Update failed:', error)
                    setErrorMsg('Güncelleme başarısız.')
                  }
                })
              }}
              disabled={isPending}
              className="flex-1 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditingCorporate(false)
                setFormState((prev) => ({
                  ...prev,
                  companyLegalName: initialData.companyLegalName ?? '',
                  taxId: initialData.taxId ?? '',
                }))
                setErrorMsg(null)
              }}
              disabled={isPending}
              className="rounded-2xl border border-gray-500/60 bg-gray-500/10 px-4 py-3 text-sm font-semibold text-gray-300 transition hover:border-gray-500 hover:bg-gray-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              İptal
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-soft-gold/20 bg-soft-gold/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-soft-gold flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-soft-gold mb-1">Neden bu bilgileri paylaşmalıyım?</p>
              <p className="text-gray-400">
                Bu bilgileri dolduran markalar, güvenlik kontrolünden sonra <span className="text-soft-gold">"Resmi İşletme"</span> rozeti kazanır ve influencerlar tarafından daha çok tercih edilir.
              </p>
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
          userId={userId}
        />
      </div>

      {errorMsg ? <p className="text-sm text-red-300">{errorMsg}</p> : null}

      {isEditing && (
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => {
              setIsEditing(false)
              // Reset form to initial data
              setFormState({
                brandName: initialData.brandName ?? '',
                username: initialData.username ?? '',
                city: initialData.city ?? '',
                bio: initialData.bio ?? '',
                category: initialData.category ?? BRAND_CATEGORY_KEYS[0],
                website: initialData.website ?? '',
                linkedin: initialData.linkedin ?? '',
                instagram: initialData.instagram ?? '',
                kick: initialData.kick ?? '',
                twitter: initialData.twitter ?? '',
                twitch: initialData.twitch ?? '',
                companyLegalName: initialData.companyLegalName ?? '',
                taxId: initialData.taxId ?? '',
              })
              setLogoUrl(initialData.logoUrl ?? null)
              setSelectedBadges(initialData.displayedBadges ?? [])
              setErrorMsg(null)
              setValidationErrors({})
              setUsernameStatus('idle')
            }}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      )}

      {toast ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-2xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-3 text-sm text-soft-gold shadow-glow">
          {toast}
        </div>
      ) : null}
    </form>
  )
}
