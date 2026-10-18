'use client'

import { compressImage } from '@/lib/image-compress'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import Image from 'next/image'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { updateProfile } from '@/app/dashboard/influencer/profile/actions'
import { validateInstagram, validateTikTok, validateYouTube, validateKick, validateTwitter, validateTwitch } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import BadgeSelector from '@/components/badges/BadgeSelector'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '@/utils/categories'
import { toast } from 'sonner'
import { ExternalLink, ImagePlus, Pencil, ShieldCheck } from 'lucide-react'
import { Button, ButtonLink, buttonClasses, Card, CardBody, CardHeader, Chip, Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { cn } from '@/utils/cn'

const CREATOR_TYPES: { value: 'influencer' | 'ugc' | 'both'; label: string; desc: string }[] = [
  { value: 'influencer', label: 'Influencer', desc: 'Kendi kitlem var' },
  { value: 'ugc', label: 'UGC kreatörü', desc: 'Markalara özel içerik' },
  { value: 'both', label: 'Her ikisi', desc: 'Hem kitle hem üretim' },
]
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
    creatorType?: 'influencer' | 'ugc' | 'both'
    displayedBadges?: string[]
    availableBadgeIds?: string[]
    socialLinksLastUpdated?: string | null
  }
  connectedPlatforms?: string[]
}

export default function ProfileForm({ initialData, connectedPlatforms = [] }: ProfileFormProps) {
  const supabase = useSupabaseClient()
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
    creatorType: initialData.creatorType ?? 'influencer',
    instagram: initialData.socialLinks?.instagram ?? '',
    tiktok: initialData.socialLinks?.tiktok ?? '',
    youtube: initialData.socialLinks?.youtube ?? '',
    kick: initialData.socialLinks?.kick ?? '',
    twitter: initialData.socialLinks?.twitter ?? '',
    twitch: initialData.socialLinks?.twitch ?? '',
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialData.avatarUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)
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

  // Watch for TikTok Success/Error redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === 'tiktok_connected') {
      toast.success('TikTok hesabın bağlandı.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('success') === 'instagram_connected') {
      toast.success('Instagram hesabın bağlandı.')
      window.history.replaceState({}, '', window.location.pathname)
    } else if (params.get('error')) {
      const error = params.get('error')
      setErrorMsg(`Hata: ${error}`)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleCreatorTypeChange = (value: 'influencer' | 'ugc' | 'both') => {
    setFormState((prev) => ({ ...prev, creatorType: value }))
  }

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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Oturum bulunamadı')
      // Profil fotoğrafı yüklemeden önce küçültülür (512 px, WebP): kartlarda ve mesajlarda hızlı açılır.
      const compressed = await compressImage(file, { maxSide: 512, skipBelowBytes: 80 * 1024 })
      // Kullanıcı klasörü: depo kuralı ve hesap silmede dosya temizliği bu yola dayanır.
      const filePath = `${user.id}/${crypto.randomUUID()}.${compressed.extension}`
      const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, compressed.file, {
        upsert: true,
        cacheControl: '31536000',
        contentType: compressed.file.type || file.type,
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

    // Check if at least one social media account is provided
    const hasAtLeastOneSocial =
      (instagramResult.isValid && (instagramResult.normalizedUrl || formState.instagram.trim())) ||
      (tiktokResult.isValid && (tiktokResult.normalizedUrl || formState.tiktok.trim())) ||
      (youtubeResult.isValid && (youtubeResult.normalizedUrl || formState.youtube.trim())) ||
      (kickResult.isValid && (kickResult.normalizedUrl || formState.kick.trim())) ||
      (twitterResult.isValid && (twitterResult.normalizedUrl || formState.twitter.trim())) ||
      (twitchResult.isValid && (twitchResult.normalizedUrl || formState.twitch.trim()))

    if (!hasAtLeastOneSocial) {
      setErrorMsg('En az 1 adet sosyal medya hesabı bilgisi girmeniz gerekmektedir.')
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
          creatorType: formState.creatorType as any,
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
          toast.success('Profil güncellendi.')
          setIsEditing(false) // Exit edit mode after successful save
          // Don't refresh - form state is already correct
          // The revalidatePath in the action will handle cache invalidation
        } else {
          setErrorMsg(result?.error || 'Profil güncellenemedi.')
        }
      } catch (error) {
        console.error('updateProfile failed', error)
        setErrorMsg(error instanceof Error ? error.message : 'Profil güncellenemedi.')
      }
    })
  }

  const resetForm = () => {
    setIsEditing(false)
    setFormState({
      fullName: initialData.fullName ?? '',
      username: initialData.username ?? '',
      city: initialData.city ?? '',
      bio: initialData.bio ?? '',
      category: initialData.category ?? INFLUENCER_CATEGORY_KEYS[0],
      creatorType: initialData.creatorType ?? 'influencer',
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
  }

  const usernameLocked = Boolean(initialData.username && initialData.username.trim() !== '')
  const usernameHint = usernameLocked
    ? 'Kullanıcı adı bir kez belirlendikten sonra değiştirilemez.'
    : usernameStatus === 'checking' ? 'Kontrol ediliyor…'
      : usernameStatus === 'available' ? 'Kullanılabilir'
        : undefined
  const usernameError = validationErrors.username || (!usernameLocked && usernameStatus === 'taken' ? 'Bu kullanıcı adı kullanılıyor' : undefined)

  // Sosyal bağlantılar (30 günde bir değiştirilebilir; doğrulanmış hesap kilitli)
  const daysRemaining = initialData.socialLinksLastUpdated
    ? 30 - Math.floor((Date.now() - new Date(initialData.socialLinksLastUpdated).getTime()) / 86_400_000)
    : 0
  const SOCIALS = [
    { name: 'instagram', label: 'Instagram', placeholder: '@kullaniciadi veya instagram.com/…' },
    { name: 'tiktok', label: 'TikTok', placeholder: '@kullaniciadi veya tiktok.com/@…' },
    { name: 'youtube', label: 'YouTube', placeholder: '@kanal veya youtube.com/@…' },
    { name: 'kick', label: 'Kick', placeholder: 'kick.com/…' },
    { name: 'twitter', label: 'Twitter / X', placeholder: '@kullaniciadi' },
    { name: 'twitch', label: 'Twitch', placeholder: 'twitch.tv/…' },
  ] as const

  return (
    <Card>
      <CardHeader
        title="Profil bilgileri"
        description="Markalar seni keşifte ve profilinde bu bilgilerle görür."
        action={
          !isEditing ? (
            <div className="flex flex-wrap gap-2">
              {formState.username && (
                <ButtonLink href={`/profile/${formState.username}`} target="_blank" rel="noopener noreferrer" size="sm" leftIcon={<ExternalLink />}>
                  Profilimi gör
                </ButtonLink>
              )}
              <Button size="sm" variant="primary" onClick={() => setIsEditing(true)} leftIcon={<Pencil />}>
                Düzenle
              </Button>
            </div>
          ) : undefined
        }
      />
      <CardBody>
        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex flex-col items-center gap-3">
              <div className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-2xl border border-line-strong bg-surface-2 text-ink-faint">
                {avatarUrl ? <Image src={avatarUrl} alt="Profil fotoğrafı" fill sizes="112px" className="object-cover" /> : <ImagePlus className="h-6 w-6" aria-hidden />}
              </div>
              <label className={buttonClasses({ size: 'sm', className: !isEditing || isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer' })}>
                {isUploading ? 'Yükleniyor…' : 'Fotoğraf yükle'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleAvatarUpload} disabled={isUploading || !isEditing} />
              </label>
            </div>

            <div className="grid flex-1 content-start gap-4">
              <Field label="Ad soyad">
                {(props) => <Input {...props} name="fullName" value={formState.fullName} onChange={handleChange} disabled={!isEditing} required />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Kullanıcı adı" error={usernameError} hint={usernameError ? undefined : usernameHint}>
                  {(props) => (
                    <Input {...props} name="username" value={formState.username} onChange={handleChange} disabled={!isEditing || usernameLocked} required />
                  )}
                </Field>
                <Field label="Şehir">
                  {(props) => (
                    <Select {...props} name="city" value={formState.city} onChange={handleChange} disabled={!isEditing}>
                      <option value="">Şehir seçin</option>
                      {TURKISH_CITIES.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
              <Field label="Kategori">
                {(props) => (
                  <Select {...props} name="category" value={formState.category} onChange={handleChange} disabled={!isEditing}>
                    {INFLUENCER_CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>{INFLUENCER_CATEGORIES[key]}</option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </div>

          <div className="grid gap-1.5">
            <span className="text-[12.5px] font-medium text-ink-muted" id="creator-type">İçerik üretici türü</span>
            <div role="radiogroup" aria-labelledby="creator-type" className="grid grid-cols-3 gap-2">
              {CREATOR_TYPES.map((type) => {
                const on = formState.creatorType === type.value
                return (
                  <button
                    key={type.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!isEditing}
                    onClick={() => handleCreatorTypeChange(type.value)}
                    className={cn(
                      'grid gap-1 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                      on ? 'border-gold bg-gold/10' : 'border-line-strong bg-surface-1 enabled:hover:border-white/20',
                    )}
                  >
                    <span className="text-[13.5px] font-medium text-ink">{type.label}</span>
                    <span className="text-[11.5px] text-ink-faint">{type.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Biyografi">
            {(props) => <Textarea {...props} name="bio" rows={4} value={formState.bio} onChange={handleChange} disabled={!isEditing} placeholder="Kendinden kısaca bahset…" />}
          </Field>

          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <BadgeSelector
              userRole="influencer"
              selectedBadgeIds={selectedBadges}
              availableBadgeIds={initialData.availableBadgeIds ?? []}
              onSelectionChange={setSelectedBadges}
              userId={userId}
            />
          </div>

          <div className="grid gap-3">
            <div>
              <h3 className="text-[15px] font-semibold">Sosyal medya bağlantıları</h3>
              <p className="text-xs text-ink-faint">Doğrulanmış hesap değiştirilemez; doğrulamayı aşağıdaki "Bağlı hesaplar"dan yaparsın.</p>
            </div>
            {daysRemaining > 0 && (
              <Notice tone="info">Sosyal medya hesaplarını 30 günde bir değiştirebilirsin. {daysRemaining} gün sonra tekrar değiştirebilirsin.</Notice>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              {SOCIALS.map((social) => {
                const verified = (social.name === 'instagram' || social.name === 'tiktok') && connectedPlatforms.includes(social.name)
                return (
                  <Field
                    key={social.name}
                    label={social.label}
                    aside={verified ? <Chip tone="success"><ShieldCheck aria-hidden />Doğrulandı</Chip> : undefined}
                    error={validationErrors[social.name]}
                  >
                    {(props) => (
                      <Input
                        {...props}
                        name={social.name}
                        value={formState[social.name]}
                        onChange={handleChange}
                        disabled={!isEditing || verified}
                        placeholder={social.placeholder}
                      />
                    )}
                  </Field>
                )
              })}
            </div>
          </div>

          {errorMsg && <Notice tone="danger">{errorMsg}</Notice>}

          {isEditing && (
            <div className="flex justify-end gap-2 border-t border-line pt-5">
              <Button variant="ghost" onClick={resetForm}>Vazgeç</Button>
              <Button type="submit" variant="primary" loading={isPending}>Kaydet</Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  )
}
