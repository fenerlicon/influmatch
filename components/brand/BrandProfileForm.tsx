'use client'

import { compressImage } from '@/lib/image-compress'
import Image from 'next/image'
import { useState, useTransition, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Award, ExternalLink, ImagePlus, Pencil, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button, ButtonLink, buttonClasses, Card, CardBody, CardHeader, Field, Input, Notice, PageHeader, Select, Textarea } from '@/components/ui'
import { updateBrandProfile } from '@/app/dashboard/brand/profile/actions'
import { validateInstagram, validateLinkedIn, validateWebsite, validateKick, validateTwitter, validateTwitch } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import BadgeSelector from '@/components/badges/BadgeSelector'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import { BRAND_CATEGORIES, BRAND_CATEGORY_KEYS } from '@/utils/categories'
import { validateTaxNumber } from '@/lib/tax-id'
import TaxCertificateUpload, { type TaxVerificationSummary } from '@/components/brand/TaxCertificateUpload'
import type { DecisionView } from '@/lib/moderation-shared'
import CorporateEmailVerification from '@/components/brand/CorporateEmailVerification'
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
    taxOffice?: string
    taxOfficeCity?: string
    latestTaxVerification?: TaxVerificationSummary | null
    taxDecision?: DecisionView | null
    corporateEmail?: string | null
    corporateEmailVerified?: boolean
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
    taxOffice: initialData.taxOffice ?? '',
    taxOfficeCity: initialData.taxOfficeCity ?? '',
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logoUrl ?? null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
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
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Oturum bulunamadı')
      // Logo yüklemeden önce küçültülür (512 px, WebP): her kartta küçük gösterilir.
      const compressed = await compressImage(file, { maxSide: 512, skipBelowBytes: 80 * 1024 })
      // Kullanıcı klasörü: depo kuralı ve hesap silmede dosya temizliği bu yola dayanır.
      const fileName = `${user.id}/${crypto.randomUUID()}.${compressed.extension}`
      const { error: uploadError } = await supabase.storage.from(LOGO_BUCKET).upload(fileName, compressed.file, {
        cacheControl: '31536000',
        upsert: true,
        contentType: compressed.file.type || file.type,
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

    if (formState.taxId.trim()) {
      const taxValidation = validateTaxNumber(formState.taxId)
      if (!taxValidation.isValid) {
        setErrorMsg(`${taxValidation.error} (Kurumsal Kimlik bölümünden düzeltebilirsiniz.)`)
        return
      }
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
          taxOffice: formState.taxOffice.trim() || null,
          taxOfficeCity: formState.taxOfficeCity.trim() || null,
        })

        if (result?.success) {
          toast.success('Profil güncellendi.')
          setIsEditing(false) // Exit edit mode after successful save
          // Don't refresh - form state is already correct
          // The revalidatePath in the action will handle cache invalidation
        } else {
          throw new Error(result?.success === false ? result.error : 'Profil güncellenemedi.')
        }
      } catch (error) {
        console.error('updateBrandProfile failed', error)
        setErrorMsg(error instanceof Error ? error.message : 'Profil güncellenemedi.')
      }
    })
  }

  const renderInput = (label: string, name: string, value: string, placeholder?: string, disabled?: boolean, type: string = 'text', error?: string) => (
    <Field label={label} error={error}>
      {(props) => (
        <Input
          {...props}
          type={type}
          name={name}
          value={value}
          onChange={handleChange}
          disabled={disabled !== undefined ? disabled : !isEditing}
          placeholder={placeholder}
        />
      )}
    </Field>
  )

  const renderCitySelect = (label: string, name: string, value: string, customDisabled?: boolean) => (
    <Field label={label}>
      {(props) => (
        <Select {...props} name={name} value={value} onChange={handleChange} disabled={customDisabled !== undefined ? customDisabled : !isEditing}>
          <option value="">Şehir seçin</option>
          {TURKISH_CITIES.map((city) => (
            <option key={city} value={city}>{city}</option>
          ))}
        </Select>
      )}
    </Field>
  )

  const taxIdValidation = formState.taxId.trim() ? validateTaxNumber(formState.taxId) : null
  const taxIdError = taxIdValidation && !taxIdValidation.isValid ? taxIdValidation.error : null

  // Kurumsal kimlik ayrı kaydedilir (vergi no girilince vergi dairesi ve il zorunlu)
  const saveCorporate = () => {
    setErrorMsg(null)
    if (formState.taxId.trim()) {
      const taxValidation = validateTaxNumber(formState.taxId)
      if (!taxValidation.isValid) {
        setErrorMsg(taxValidation.error)
        return
      }
      if (!formState.taxOffice.trim()) {
        setErrorMsg('Vergi numarası girildiğinde vergi dairesi girmek zorunludur.')
        return
      }
      if (!formState.taxOfficeCity.trim()) {
        setErrorMsg('Vergi numarası girildiğinde şirketin bağlı olduğu il seçilmelidir.')
        return
      }
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
          website: formState.website.trim() || '',
          linkedin: formState.linkedin.trim() || '',
          instagram: formState.instagram.trim() || '',
          kick: formState.kick?.trim() || null,
          twitter: formState.twitter?.trim() || null,
          twitch: formState.twitch?.trim() || null,
          displayedBadges: selectedBadges,
          companyLegalName: formState.companyLegalName.trim() || null,
          taxId: formState.taxId.trim() || null,
          taxOffice: formState.taxOffice.trim() || null,
          taxOfficeCity: formState.taxOfficeCity.trim() || null,
        })
        if (!result.success) throw new Error(result.error)
        toast.success('Kurumsal bilgiler güncellendi.')
        setIsEditingCorporate(false)
        router.refresh()
      } catch (error) {
        console.error('Corporate update failed:', error)
        setErrorMsg(error instanceof Error ? error.message : 'Güncelleme başarısız.')
      }
    })
  }

  const cancelCorporate = () => {
    setIsEditingCorporate(false)
    setFormState((prev) => ({
      ...prev,
      companyLegalName: initialData.companyLegalName ?? '',
      taxId: initialData.taxId ?? '',
      taxOffice: initialData.taxOffice ?? '',
      taxOfficeCity: initialData.taxOfficeCity ?? '',
    }))
    setErrorMsg(null)
  }

  const resetForm = () => {
    setIsEditing(false)
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
      taxOffice: initialData.taxOffice ?? '',
      taxOfficeCity: initialData.taxOfficeCity ?? '',
    })
    setLogoUrl(initialData.logoUrl ?? null)
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
  const daysRemaining = initialData.socialLinksLastUpdated
    ? 30 - Math.floor((Date.now() - new Date(initialData.socialLinksLastUpdated).getTime()) / 86_400_000)
    : 0

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <PageHeader
        title="Marka profili"
        description="Influencer'lar markanı bu bilgilerle tanır. Logo, kimlik bilgileri ve iletişim noktaların burada."
        actions={
          !isEditing ? (
            <>
              <ButtonLink href="/dashboard/brand/badges" leftIcon={<Award />}>Rozetler</ButtonLink>
              {formState.username && (
                <ButtonLink href={`/profile/${formState.username}`} target="_blank" rel="noopener noreferrer" leftIcon={<ExternalLink />}>
                  Profilimi gör
                </ButtonLink>
              )}
              <Button variant="primary" onClick={() => setIsEditing(true)} leftIcon={<Pencil />}>Düzenle</Button>
            </>
          ) : undefined
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Marka bilgileri" />
          <CardBody className="grid gap-4">
            <div className="flex items-center gap-4">
              <div className="relative grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-2xl border border-line-strong bg-surface-2 text-ink-faint">
                {logoUrl ? <Image src={logoUrl} alt="Marka logosu" fill sizes="80px" className="object-cover" /> : <ImagePlus className="h-6 w-6" aria-hidden />}
              </div>
              <label className={buttonClasses({ size: 'sm', className: !isEditing || isUploading ? 'pointer-events-none opacity-50' : 'cursor-pointer' })}>
                <Upload aria-hidden />
                {isUploading ? 'Yükleniyor…' : 'Logo yükle'}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={handleLogoUpload} disabled={isUploading || !isEditing} />
              </label>
            </div>
            {renderInput('Marka adı', 'brandName', formState.brandName, 'Ör. Nara Kahve')}
            <Field label="Kullanıcı adı" error={usernameError} hint={usernameError ? undefined : usernameHint}>
              {(props) => (
                <Input {...props} name="username" value={formState.username} onChange={handleChange} disabled={!isEditing || usernameLocked} placeholder="marka" />
              )}
            </Field>
            <Field label="Sektör">
              {(props) => (
                <Select {...props} name="category" value={formState.category} onChange={handleChange} disabled={!isEditing}>
                  {BRAND_CATEGORY_KEYS.map((key) => (
                    <option key={key} value={key}>{BRAND_CATEGORIES[key]}</option>
                  ))}
                </Select>
              )}
            </Field>
            {renderInput('Web sitesi', 'website', formState.website, 'www.ornek.com', undefined, 'text', validationErrors.website)}
            {renderCitySelect('Şehir', 'city', formState.city)}
            <Field label="Hakkında">
              {(props) => (
                <Textarea {...props} name="bio" value={formState.bio} onChange={handleChange} disabled={!isEditing} rows={5} placeholder="Markan hakkında kısa bir bilgi…" />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sosyal medya" description="En az bir sosyal medya hesabı ya da web sitesi gerekli." />
          <CardBody className="grid gap-4">
            {daysRemaining > 0 && (
              <Notice tone="info">Sosyal medya hesaplarını 30 günde bir değiştirebilirsin. {daysRemaining} gün sonra tekrar değiştirebilirsin.</Notice>
            )}
            {renderInput('LinkedIn', 'linkedin', formState.linkedin, 'linkedin.com/company/…', undefined, 'text', validationErrors.linkedin)}
            {renderInput('Instagram', 'instagram', formState.instagram, '@kullaniciadi veya instagram.com/…', undefined, 'text', validationErrors.instagram)}
            {renderInput('Kick', 'kick', formState.kick, 'kick.com/…', undefined, 'text', validationErrors.kick)}
            {renderInput('Twitter / X', 'twitter', formState.twitter, '@kullaniciadi', undefined, 'text', validationErrors.twitter)}
            {renderInput('Twitch', 'twitch', formState.twitch, 'twitch.tv/…', undefined, 'text', validationErrors.twitch)}
          </CardBody>
        </Card>
      </div>

      {/* Kurumsal kimlik */}
      <Card>
        <CardHeader
          title="Kurumsal kimlik"
          description='Bu bilgileri dolduran markalar güvenlik kontrolünden sonra "Resmi İşletme" rozeti alır; rozet profilinde görünür.'
          action={!isEditingCorporate ? <Button size="sm" onClick={() => setIsEditingCorporate(true)} leftIcon={<Pencil />}>Düzenle</Button> : undefined}
        />
        <CardBody className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            {renderInput('Resmi şirket unvanı', 'companyLegalName', formState.companyLegalName, 'İsteğe bağlı', !isEditingCorporate ? true : undefined)}
            {renderInput('Vergi numarası', 'taxId', formState.taxId, 'Vergi numaranızı girin', !isEditingCorporate ? true : undefined, 'text', taxIdError ?? undefined)}
            {renderInput('Vergi dairesi', 'taxOffice', formState.taxOffice, 'Vergi dairesini girin', !isEditingCorporate ? true : undefined)}
            {renderCitySelect('Şirketin bağlı olduğu il (vergi levhası ili)', 'taxOfficeCity', formState.taxOfficeCity, !isEditingCorporate)}
          </div>

          {initialData.taxIdVerified && <Notice tone="success">Vergi numaranız doğrulandı.</Notice>}

          {isEditingCorporate ? (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={cancelCorporate} disabled={isPending}>Vazgeç</Button>
              <Button variant="primary" onClick={saveCorporate} loading={isPending}>Kaydet</Button>
            </div>
          ) : (
            <div className="grid gap-4">
              <CorporateEmailVerification
                initialEmail={initialData.corporateEmail ?? null}
                verified={!!initialData.corporateEmailVerified}
                website={initialData.website}
              />
              <TaxCertificateUpload
                userId={userId}
                taxIdVerified={!!initialData.taxIdVerified}
                canSubmit={
                  !!initialData.companyLegalName?.trim() &&
                  !!initialData.taxId &&
                  validateTaxNumber(initialData.taxId).isValid &&
                  !!initialData.taxOffice &&
                  !!initialData.taxOfficeCity
                }
                latest={initialData.latestTaxVerification ?? null}
                decision={initialData.taxDecision ?? null}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card padded>
        <BadgeSelector
          userRole="brand"
          selectedBadgeIds={selectedBadges}
          availableBadgeIds={initialData.availableBadgeIds ?? []}
          onSelectionChange={setSelectedBadges}
          userId={userId}
        />
      </Card>

      {errorMsg && <Notice tone="danger">{errorMsg}</Notice>}

      {isEditing && (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={resetForm}>Vazgeç</Button>
          <Button type="submit" variant="primary" loading={isPending}>Kaydet</Button>
        </div>
      )}
    </form>
  )
}
