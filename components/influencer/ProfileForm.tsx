'use client'

import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile } from '@/app/dashboard/influencer/profile/actions'
import { validateInstagram, validateTikTok, validateYouTube, validateKick, validateTwitter, validateTwitch } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import BadgeSelector from '@/components/badges/BadgeSelector'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '@/utils/categories'
const AVATAR_BUCKET = 'avatars'

interface ProfileFormProps {
  initialData: {
    fullName: string
    username: string
    city: string
    bio: string
    category: string
    avatarUrl: string | null
    socialLinks: Record<string, string | null>
    displayedBadges?: string[]
    availableBadgeIds?: string[]
    socialLinksLastUpdated?: string | null
  }
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id)
    })
  }, [supabase])

  const [formState, setFormState] = useState({
    fullName: initialData.fullName ?? '',
    username: initialData.username ?? '',
    city: initialData.city ?? '',
    bio: initialData.bio ?? '',
    category: initialData.category ?? INFLUENCER_CATEGORY_KEYS[0],
    instagram: initialData.socialLinks?.instagram ?? '',
    tiktok: initialData.socialLinks?.tiktok ?? '',
    youtube: initialData.socialLinks?.youtube ?? '',
    kick: initialData.socialLinks?.kick ?? '',
    twitter: initialData.socialLinks?.twitter ?? '',
    twitch: initialData.socialLinks?.twitch ?? '',
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [validationErrors, setValidationErrors] = useState<{
    username?: string
    instagram?: string
    tiktok?: string
    youtube?: string
    kick?: string
    twitter?: string
    twitch?: string
  }>({})
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [selectedBadges, setSelectedBadges] = useState<string[]>(initialData.displayedBadges ?? [])
  const [isEditing, setIsEditing] = useState(false)

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
    if (name === 'instagram') {
      const result = validateInstagram(value)
      setValidationErrors((prev) => ({
        ...prev,
        instagram: result.isValid ? undefined : result.error,
      }))
    } else if (name === 'tiktok') {
      const result = validateTikTok(value)
      setValidationErrors((prev) => ({
        ...prev,
        tiktok: result.isValid ? undefined : result.error,
      }))
    } else if (name === 'youtube') {
      const result = validateYouTube(value)
      setValidationErrors((prev) => ({
        ...prev,
        youtube: result.isValid ? undefined : result.error,
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSize = 5 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Lütfen JPG, PNG veya WEBP formatında bir görsel yükleyin.')
      return
    }

    if (file.size > maxSize) {
      setErrorMsg('Dosya boyutu en fazla 5MB olabilir.')
      return
    }

    setIsUploading(true)
    setErrorMsg(null)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `${fileName}`
      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, file, {
        upsert: true,
      })
      if (uploadError) {
        throw uploadError
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath)
      setAvatarUrl(publicUrl)
    } catch (error) {
      console.error('Avatar upload failed', error)
      setErrorMsg('Avatar yüklenemedi. Lütfen tekrar deneyin.')
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
    const instagramResult = validateInstagram(formState.instagram)
    const tiktokResult = validateTikTok(formState.tiktok)
    const youtubeResult = validateYouTube(formState.youtube)
    const kickResult = validateKick(formState.kick)
    const twitterResult = validateTwitter(formState.twitter)
    const twitchResult = validateTwitch(formState.twitch)

    const errors: typeof validationErrors = {}
    if (!instagramResult.isValid) errors.instagram = instagramResult.error
    if (!tiktokResult.isValid) errors.tiktok = tiktokResult.error
    if (!youtubeResult.isValid) errors.youtube = youtubeResult.error
    if (!kickResult.isValid) errors.kick = kickResult.error
    if (!twitterResult.isValid) errors.twitter = twitterResult.error
    if (!twitchResult.isValid) errors.twitch = twitchResult.error

    setValidationErrors(errors)

    if (Object.keys(errors).length > 0) {
      setErrorMsg('Lütfen sosyal medya linklerini düzeltin.')
      return
    }

    startTransition(async () => {
      try {
        const result = await updateProfile({
          fullName: formState.fullName.trim(),
          username: formState.username.trim(),
          previousUsername: initialData.username,
          city: formState.city.trim(),
          bio: formState.bio.trim(),
          category: formState.category,
          avatarUrl,
          socialLinks: {
            instagram: instagramResult.normalizedUrl || null,
            tiktok: tiktokResult.normalizedUrl || null,
            youtube: youtubeResult.normalizedUrl || null,
            kick: kickResult.normalizedUrl || null,
            twitter: twitterResult.normalizedUrl || null,
            twitch: twitchResult.normalizedUrl || null,
          },
          displayedBadges: selectedBadges,
        })
        
        if (result?.success) {
          setToast('Profil başarıyla güncellendi.')
          setIsEditing(false) // Exit edit mode after successful save
          // Don't refresh - form state is already correct
          // The revalidatePath in the action will handle cache invalidation
        } else {
          throw new Error('Profil güncellenemedi.')
        }
      } catch (error) {
        console.error('updateProfile failed', error)
        setErrorMsg(error instanceof Error ? error.message : 'Profil güncellenemedi.')
      }
    })
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Profil Ayarları</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Bilgilerini güncelle</h1>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-3">
            {formState.username && (
              <Link
                href={`/profile/${formState.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                Kartımı Gör
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-soft-gold/60 bg-soft-gold/10 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20"
            >
              Profili Düzenle
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-32 w-32 overflow-hidden rounded-3xl border border-white/10 bg-[#11121A]">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" fill sizes="128px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  Avatar seç
                </div>
              )}
            </div>
            <label className="inline-flex cursor-pointer items-center rounded-2xl border border-white/10 px-4 py-2 text-sm font-medium text-white transition hover:border-soft-gold hover:text-soft-gold">
              {isUploading ? 'Yükleniyor...' : 'Avatar Yükle'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
            </label>
          </div>

          <div className="flex-1 space-y-5">
            <div>
              <label className="text-sm text-gray-300">Ad Soyad</label>
              <input
                type="text"
                name="fullName"
                value={formState.fullName}
                onChange={handleChange}
                disabled={!isEditing}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-50"
                required
              />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm text-gray-300">Kullanıcı Adı</label>
                <input
                  type="text"
                  name="username"
                  value={formState.username}
                  onChange={handleChange}
                  disabled={!isEditing || (initialData.username && initialData.username.trim() !== '')}
                  className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    validationErrors.username || usernameStatus === 'taken'
                      ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                      : usernameStatus === 'available'
                        ? 'border-emerald-500/60 bg-emerald-500/10 focus:border-emerald-500'
                        : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
                  }`}
                  required
                />
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
              </div>
              <div>
                <label className="text-sm text-gray-300">Şehir</label>
                <select
                  name="city"
                  value={formState.city}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Şehir seçin</option>
                  {TURKISH_CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm text-gray-300">Kategori</label>
              <select
                name="category"
                value={formState.category}
                onChange={handleChange}
                disabled={!isEditing}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {INFLUENCER_CATEGORY_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {INFLUENCER_CATEGORIES[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-gray-300">Biyografi</label>
          <textarea
            name="bio"
            rows={4}
            value={formState.bio}
            onChange={handleChange}
            disabled={!isEditing}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Kendinden kısaca bahset..."
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <BadgeSelector
            userRole="influencer"
            selectedBadgeIds={selectedBadges}
            availableBadgeIds={initialData.availableBadgeIds ?? []}
            onSelectionChange={setSelectedBadges}
            userId={userId}
          />
        </div>

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

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="text-sm text-gray-300">Instagram</label>
            <input
              type="text"
              name="instagram"
              value={formState.instagram}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="@kullaniciadi veya https://instagram.com/..."
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.instagram
                  ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                  : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
              }`}
            />
            {validationErrors.instagram && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.instagram}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-300">TikTok</label>
            <input
              type="text"
              name="tiktok"
              value={formState.tiktok}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="@kullaniciadi veya https://tiktok.com/@..."
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.tiktok
                  ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                  : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
              }`}
            />
            {validationErrors.tiktok && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.tiktok}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-300">YouTube</label>
            <input
              type="text"
              name="youtube"
              value={formState.youtube}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="@kullaniciadi veya https://youtube.com/@..."
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.youtube
                  ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                  : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
              }`}
            />
            {validationErrors.youtube && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.youtube}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-300">Kick</label>
            <input
              type="text"
              name="kick"
              value={formState.kick}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="@kullaniciadi veya https://kick.com/..."
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.kick
                  ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                  : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
              }`}
            />
            {validationErrors.kick && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.kick}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-300">Twitter/X</label>
            <input
              type="text"
              name="twitter"
              value={formState.twitter}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="@kullaniciadi veya https://twitter.com/..."
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.twitter
                  ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                  : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
              }`}
            />
            {validationErrors.twitter && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.twitter}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-300">Twitch</label>
            <input
              type="text"
              name="twitch"
              value={formState.twitch}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="@kullaniciadi veya https://twitch.tv/..."
              className={`mt-2 w-full rounded-2xl border px-4 py-3 text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
                validationErrors.twitch
                  ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                  : 'border-white/10 bg-[#11121A] focus:border-soft-gold'
              }`}
            />
            {validationErrors.twitch && (
              <p className="mt-1 text-xs text-red-300">{validationErrors.twitch}</p>
            )}
          </div>
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
                  fullName: initialData.fullName ?? '',
                  username: initialData.username ?? '',
                  city: initialData.city ?? '',
                  bio: initialData.bio ?? '',
                  category: initialData.category ?? INFLUENCER_CATEGORY_KEYS[0],
                  instagram: initialData.socialLinks?.instagram ?? '',
                  tiktok: initialData.socialLinks?.tiktok ?? '',
                  youtube: initialData.socialLinks?.youtube ?? '',
                  kick: initialData.socialLinks?.kick ?? '',
                  twitter: initialData.socialLinks?.twitter ?? '',
                  twitch: initialData.socialLinks?.twitch ?? '',
                })
                setAvatarUrl(initialData.avatarUrl ?? null)
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
              {isPending ? 'Kaydediliyor...' : 'Profili Kaydet'}
            </button>
          </div>
        )}
      </form>

      {toast ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-4 py-2 text-sm text-soft-gold shadow-glow">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

