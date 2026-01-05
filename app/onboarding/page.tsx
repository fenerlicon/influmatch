'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AvatarUploader from '@/components/onboarding/AvatarUploader'
import BrandForm, { BrandFormState } from '@/components/onboarding/BrandForm'
import InfluencerForm, { InfluencerFormState } from '@/components/onboarding/InfluencerForm'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import type { UserRole } from '@/types/auth'
import { validateInstagram, validateTikTok, validateYouTube, validateWebsite } from '@/utils/socialLinkValidation'
import { saveOnboardingProfile } from './actions'
import { validateUsername } from '@/utils/usernameValidation'

type SocialLinks = {
  instagram?: string | null
  tiktok?: string | null
  youtube?: string | null
  website?: string | null
}

interface UserProfile {
  id: string
  role: UserRole
  full_name: string | null
  username: string | null
  bio: string | null
  category: string | null
  city: string | null
  avatar_url: string | null
  social_links: SocialLinks | null
}

const defaultInfluencerForm: InfluencerFormState = {
  fullName: '',
  username: '',
  bio: '',
  category: 'beauty',
  city: '',
  instagram: '',
  tiktok: '',
  youtube: '',
}

const defaultBrandForm: BrandFormState = {
  brandName: '',
  username: '',
  city: '',
  website: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  taxId: '',
}

export default function OnboardingPage() {
  const router = useRouter()
  const { session, supabaseClient, isSessionLoading } = useSupabaseAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [influencerForm, setInfluencerForm] = useState<InfluencerFormState>(defaultInfluencerForm)
  const [brandForm, setBrandForm] = useState<BrandFormState>(defaultBrandForm)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const role: UserRole | null = useMemo(() => {
    if (profile?.role) return profile.role
    const sessionRole = session?.user.user_metadata?.role
    return sessionRole ?? null
  }, [profile, session])

  useEffect(() => {
    if (!session && !isSessionLoading) {
      router.replace('/login')
    }
  }, [session, isSessionLoading, router])

  useEffect(() => {
    // Helper to merge DB data with LocalStorage data
    const getMergedState = <T,>(dbState: T, storageKey: string): T => {
      if (typeof window === 'undefined') return dbState

      const savedState = localStorage.getItem(storageKey)
      if (!savedState) return dbState

      try {
        const parsedState = JSON.parse(savedState)
        // Merge database state with local storage, giving priority to local storage 
        // (assuming local storage has the latest 'draft' edits)
        return { ...dbState, ...parsedState }
      } catch (e) {
        console.error(`Failed to parse saved state for ${storageKey}`, e)
        return dbState
      }
    }

    const fetchProfile = async () => {
      if (!session) return

      setIsLoadingProfile(true)
      setErrorMessage(null) // Clear previous errors

      try {
        const { data, error } = await supabaseClient
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle() // Use maybeSingle instead of single to handle missing profiles gracefully

        // Default states (what we have if DB returns nothing)
        let newInfluencerForm = defaultInfluencerForm
        let newBrandForm = defaultBrandForm
        let newAvatarUrl: string | null = null

        if (error) {
          // Only show error if it's not a "not found" error (new users don't have profiles yet)
          if (error.code !== 'PGRST116' && error.message !== 'JSON object requested, multiple (or no) rows returned') {
            console.error('[OnboardingPage] Profile fetch error:', error)
            setErrorMessage('Bir hata oluştu.')
          }
          // If profile doesn't exist, we stick with defaults, but we will check localStorage below
        } else if (data) {
          const socialLinks: SocialLinks = data.social_links ?? {}
          setProfile(data as UserProfile)
          newAvatarUrl = data.avatar_url ?? null

          newInfluencerForm = {
            fullName: data.full_name ?? '',
            username: data.username ?? '',
            bio: data.bio ?? '',
            category: (data.category as InfluencerFormState['category']) ?? 'beauty',
            city: data.city ?? '',
            instagram: socialLinks.instagram ?? '',
            tiktok: socialLinks.tiktok ?? '',
            youtube: socialLinks.youtube ?? '',
          }

          newBrandForm = {
            brandName: data.full_name ?? '',
            username: data.username ?? '',
            city: data.city ?? '',
            website: socialLinks.website ?? '',
            instagram: socialLinks.instagram ?? '',
            tiktok: socialLinks.tiktok ?? '',
            youtube: socialLinks.youtube ?? '',
            taxId: data.tax_id ?? '',
          }
        }

        // Merge with LocalStorage (this ensures draft is preserved over DB data)
        setInfluencerForm(getMergedState(newInfluencerForm, 'onboarding_influencer_form'))
        setBrandForm(getMergedState(newBrandForm, 'onboarding_brand_form'))

        // Handle avatar URL from localStorage
        const savedAvatarUrl = typeof window !== 'undefined' ? localStorage.getItem('onboarding_avatar_url') : null
        setAvatarUrl(savedAvatarUrl || newAvatarUrl)

      } catch (err) {
        console.error('[OnboardingPage] Unexpected error:', err)
        // Even on error, we try to restore from localStorage so user doesn't lose work
        setInfluencerForm(prev => getMergedState(prev, 'onboarding_influencer_form'))
        setBrandForm(prev => getMergedState(prev, 'onboarding_brand_form'))

        const savedAvatarUrl = typeof window !== 'undefined' ? localStorage.getItem('onboarding_avatar_url') : null
        if (savedAvatarUrl) {
          setAvatarUrl(savedAvatarUrl)
        }
      } finally {
        setIsLoadingProfile(false)
      }
    }

    // Only fetch if session is ready
    if (session && !isSessionLoading) {
      fetchProfile()
    }
  }, [session, supabaseClient, isSessionLoading])

  // Save form state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_influencer_form', JSON.stringify(influencerForm))
    }
  }, [influencerForm])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_brand_form', JSON.stringify(brandForm))
    }
  }, [brandForm])

  // Save avatar URL to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && avatarUrl) {
      localStorage.setItem('onboarding_avatar_url', avatarUrl)
    }
  }, [avatarUrl])

  const handleAvatarUpload = async (file: File) => {
    if (!session) return
    setIsUploadingAvatar(true)
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `${session.user.id}/${fileName}`

    const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(filePath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    })

    if (uploadError) {
      setErrorMessage('Bir hata oluştu.')
    } else {
      const { data } = supabaseClient.storage.from('avatars').getPublicUrl(filePath)
      setAvatarUrl(data.publicUrl)
      setErrorMessage(null)
    }

    setIsUploadingAvatar(false)
  }

  const handleInfluencerChange = (field: keyof InfluencerFormState, value: string) => {
    setInfluencerForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleBrandChange = (field: keyof BrandFormState, value: string) => {
    setBrandForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async () => {
    if (!session) {
      setErrorMessage('Bir hata oluştu.')
      return
    }

    if (!role) {
      setErrorMessage('Bir hata oluştu.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    // Check if avatar is uploaded
    if (!avatarUrl) {
      setErrorMessage(role === 'brand' ? 'Lütfen marka logosu yükleyin.' : 'Lütfen profil fotoğrafı yükleyin.')
      setIsSaving(false)
      return
    }

    // Validate username format
    const usernameToValidate = role === 'influencer' ? influencerForm.username : brandForm.username
    if (usernameToValidate && usernameToValidate.trim()) {
      const usernameValidation = validateUsername(usernameToValidate.trim().toLowerCase())
      if (!usernameValidation.isValid) {
        setErrorMessage('Geçersiz kullanıcı adı.')
        setIsSaving(false)
        return
      }
    } else {
      // Username is required
      setErrorMessage('Kullanıcı adı gerekli.')
      setIsSaving(false)
      return
    }

    // Validate social links
    if (role === 'influencer') {
      const instagramResult = validateInstagram(influencerForm.instagram)
      const tiktokResult = validateTikTok(influencerForm.tiktok)
      const youtubeResult = validateYouTube(influencerForm.youtube)

      // Check if at least one social media account is provided
      const hasAtLeastOneSocial =
        (influencerForm.instagram && instagramResult.isValid) ||
        (influencerForm.tiktok && tiktokResult.isValid) ||
        (influencerForm.youtube && youtubeResult.isValid)

      if (!hasAtLeastOneSocial) {
        setErrorMessage('En az bir sosyal medya hesabı gerekli.')
        setIsSaving(false)
        return
      }

      // Validate format for filled fields
      if (influencerForm.instagram && !instagramResult.isValid) {
        setErrorMessage('Geçersiz format: Instagram')
        setIsSaving(false)
        return
      }
      if (influencerForm.tiktok && !tiktokResult.isValid) {
        setErrorMessage('Geçersiz format: TikTok')
        setIsSaving(false)
        return
      }
      if (influencerForm.youtube && !youtubeResult.isValid) {
        setErrorMessage('Geçersiz format: YouTube')
        setIsSaving(false)
        return
      }
    } else {
      const websiteResult = validateWebsite(brandForm.website)
      const instagramResult = validateInstagram(brandForm.instagram)
      const tiktokResult = validateTikTok(brandForm.tiktok)
      const youtubeResult = validateYouTube(brandForm.youtube)

      // Check if at least one social media account or website is provided
      const hasAtLeastOneSocial =
        (brandForm.website && websiteResult.isValid) ||
        (brandForm.instagram && instagramResult.isValid) ||
        (brandForm.tiktok && tiktokResult.isValid) ||
        (brandForm.youtube && youtubeResult.isValid)

      if (!hasAtLeastOneSocial) {
        setErrorMessage('En az bir sosyal medya hesabı veya web sitesi gerekli.')
        setIsSaving(false)
        return
      }

      // Validate format for filled fields
      if (brandForm.website && !websiteResult.isValid) {
        setErrorMessage('Geçersiz format: Website')
        setIsSaving(false)
        return
      }
      if (brandForm.instagram && !instagramResult.isValid) {
        setErrorMessage('Geçersiz format: Instagram')
        setIsSaving(false)
        return
      }
      if (brandForm.tiktok && !tiktokResult.isValid) {
        setErrorMessage('Geçersiz format: TikTok')
        setIsSaving(false)
        return
      }
      if (brandForm.youtube && !youtubeResult.isValid) {
        setErrorMessage('Geçersiz format: YouTube')
        setIsSaving(false)
        return
      }
    }

    // Prepare social links (already validated above)
    const socialLinks: Record<string, string | null> = {}
    if (role === 'influencer') {
      const instagramResult = validateInstagram(influencerForm.instagram)
      const tiktokResult = validateTikTok(influencerForm.tiktok)
      const youtubeResult = validateYouTube(influencerForm.youtube)
      socialLinks.instagram = instagramResult.normalizedUrl || influencerForm.instagram || null
      socialLinks.tiktok = tiktokResult.normalizedUrl || influencerForm.tiktok || null
      socialLinks.youtube = youtubeResult.normalizedUrl || influencerForm.youtube || null
    } else {
      const websiteResult = validateWebsite(brandForm.website)
      const instagramResult = validateInstagram(brandForm.instagram)
      const tiktokResult = validateTikTok(brandForm.tiktok)
      const youtubeResult = validateYouTube(brandForm.youtube)
      socialLinks.website = websiteResult.normalizedUrl || brandForm.website || null
      socialLinks.instagram = instagramResult.normalizedUrl || brandForm.instagram || null
      socialLinks.tiktok = tiktokResult.normalizedUrl || brandForm.tiktok || null
      socialLinks.youtube = youtubeResult.normalizedUrl || brandForm.youtube || null
      socialLinks.linkedin = null // Brands don't have linkedin in form
    }

    // Check username uniqueness before saving (username is already validated and required above)
    const normalizedUsername = (role === 'influencer' ? influencerForm.username : brandForm.username).trim().toLowerCase()

    // Use server action to save profile (more reliable than client-side)
    console.log('[Onboarding] Attempting to save profile via server action:', {
      userId: session.user.id,
      email: session.user.email,
      role: role,
    })

    const result = await saveOnboardingProfile({
      userId: session.user.id,
      role: role || 'influencer',
      fullName: role === 'influencer' ? influencerForm.fullName : brandForm.brandName,
      username: normalizedUsername,
      city: role === 'influencer' ? influencerForm.city : brandForm.city,
      bio: role === 'influencer' ? influencerForm.bio : '', // Brands don't have bio in form
      taxId: role === 'brand' ? brandForm.taxId : null,
      category: role === 'influencer' ? influencerForm.category : 'tech', // Default category for brands
      avatarUrl: avatarUrl,
      socialLinks: socialLinks,
    })

    if (!result.success) {
      setErrorMessage(result.error || 'Bir hata oluştu.')
      setIsSaving(false)
      return
    }

    console.log('[Onboarding] Profile saved successfully via server action')

    // Force a router refresh to update server components, then navigate
    router.refresh()
    router.replace('/dashboard')
    setIsSaving(false)

    // Clear localStorage on successful submission
    if (typeof window !== 'undefined') {
      localStorage.removeItem('onboarding_influencer_form')
      localStorage.removeItem('onboarding_brand_form')
      localStorage.removeItem('onboarding_avatar_url')
    }
  }

  if (!session && !isSessionLoading) {
    return null
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">BAŞLANGIÇ</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Profilini Tamamla</h1>
          <p className="mt-2 text-gray-300">
            Seçilen Rol:{' '}
            <span className="text-soft-gold">
              {role === 'brand' ? 'Marka' : role === 'influencer' ? 'Influencer' : '...'}
            </span>
          </p>

          {isLoadingProfile ? (
            <p className="mt-10 text-gray-400">Profil yükleniyor...</p>
          ) : (
            <div className="mt-10 space-y-8">
              <AvatarUploader
                label={role === 'brand' ? 'Marka Logosu' : 'Profil Fotoğrafı'}
                imageUrl={avatarUrl}
                isUploading={isUploadingAvatar}
                onFileChange={handleAvatarUpload}
              />

              {role === 'brand' ? (
                <BrandForm form={brandForm} onChange={handleBrandChange} />
              ) : (
                <InfluencerForm form={influencerForm} onChange={handleInfluencerChange} />
              )}

              {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="w-full rounded-full bg-soft-gold px-8 py-4 font-semibold text-background transition hover:bg-champagne disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Kaydediliyor...' : 'Kaydet ve Devam Et'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
