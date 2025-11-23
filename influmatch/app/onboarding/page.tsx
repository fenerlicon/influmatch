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

        if (error) {
          // Only show error if it's not a "not found" error (new users don't have profiles yet)
          if (error.code !== 'PGRST116' && error.message !== 'JSON object requested, multiple (or no) rows returned') {
            console.error('[OnboardingPage] Profile fetch error:', error)
            setErrorMessage('Profil bilgileri alınamadı. Lütfen tekrar deneyin.')
          }
          // If profile doesn't exist, that's fine - user is new and will create it
        } else if (data) {
          const socialLinks: SocialLinks = data.social_links ?? {}
          setProfile(data as UserProfile)
          setAvatarUrl(data.avatar_url ?? null)
          setInfluencerForm({
            fullName: data.full_name ?? '',
            username: data.username ?? '',
            bio: data.bio ?? '',
            category: (data.category as InfluencerFormState['category']) ?? 'beauty',
            city: data.city ?? '',
            instagram: socialLinks.instagram ?? '',
            tiktok: socialLinks.tiktok ?? '',
            youtube: socialLinks.youtube ?? '',
          })
          setBrandForm({
            brandName: data.full_name ?? '',
            username: data.username ?? '',
            city: data.city ?? '',
            website: socialLinks.website ?? '',
            instagram: socialLinks.instagram ?? '',
            tiktok: socialLinks.tiktok ?? '',
            youtube: socialLinks.youtube ?? '',
          })
        }
      } catch (err) {
        console.error('[OnboardingPage] Unexpected error:', err)
        // Don't show error for network issues or session refresh - user can retry
      } finally {
        setIsLoadingProfile(false)
      }
    }

    // Only fetch if session is ready
    if (session && !isSessionLoading) {
      fetchProfile()
    }
  }, [session, supabaseClient, isSessionLoading])

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
      setErrorMessage('Avatar yüklenemedi. Lütfen tekrar deneyin.')
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
    if (!session || !role) return
    setIsSaving(true)
    setErrorMessage(null)

    // Validate username format
    const usernameToValidate = role === 'influencer' ? influencerForm.username : brandForm.username
    if (usernameToValidate && usernameToValidate.trim()) {
      const usernameValidation = validateUsername(usernameToValidate.trim().toLowerCase())
      if (!usernameValidation.isValid) {
        setErrorMessage(usernameValidation.error || 'Kullanıcı adı geçersiz.')
        setIsSaving(false)
        return
      }
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
        setErrorMessage('En az 1 adet sosyal medya hesabı bilgisi girmeniz gerekmektedir.')
        setIsSaving(false)
        return
      }

      // Validate format for filled fields
      if (influencerForm.instagram && !instagramResult.isValid) {
        setErrorMessage('Instagram linki doğru formatta değil.')
        setIsSaving(false)
        return
      }
      if (influencerForm.tiktok && !tiktokResult.isValid) {
        setErrorMessage('TikTok linki doğru formatta değil.')
        setIsSaving(false)
        return
      }
      if (influencerForm.youtube && !youtubeResult.isValid) {
        setErrorMessage('YouTube linki doğru formatta değil.')
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
        setErrorMessage('En az 1 adet sosyal medya hesabı veya website bilgisi girmeniz gerekmektedir.')
        setIsSaving(false)
        return
      }

      // Validate format for filled fields
      if (brandForm.website && !websiteResult.isValid) {
        setErrorMessage('Website linki doğru formatta değil.')
        setIsSaving(false)
        return
      }
      if (brandForm.instagram && !instagramResult.isValid) {
        setErrorMessage('Instagram linki doğru formatta değil.')
        setIsSaving(false)
        return
      }
      if (brandForm.tiktok && !tiktokResult.isValid) {
        setErrorMessage('TikTok linki doğru formatta değil.')
        setIsSaving(false)
        return
      }
      if (brandForm.youtube && !youtubeResult.isValid) {
        setErrorMessage('YouTube linki doğru formatta değil.')
        setIsSaving(false)
        return
      }
    }

    const basePayload: Record<string, unknown> = {
      avatar_url: avatarUrl,
    }

    if (role === 'influencer') {
      const instagramResult = validateInstagram(influencerForm.instagram)
      const tiktokResult = validateTikTok(influencerForm.tiktok)
      const youtubeResult = validateYouTube(influencerForm.youtube)

      basePayload.full_name = influencerForm.fullName
      basePayload.username = influencerForm.username.trim().toLowerCase()
      basePayload.bio = influencerForm.bio
      basePayload.category = influencerForm.category
      basePayload.city = influencerForm.city
      basePayload.social_links = {
        instagram: instagramResult.normalizedUrl || influencerForm.instagram || null,
        tiktok: tiktokResult.normalizedUrl || influencerForm.tiktok || null,
        youtube: youtubeResult.normalizedUrl || influencerForm.youtube || null,
      }
    } else {
      const websiteResult = validateWebsite(brandForm.website)
      const instagramResult = validateInstagram(brandForm.instagram)
      const tiktokResult = validateTikTok(brandForm.tiktok)
      const youtubeResult = validateYouTube(brandForm.youtube)

      basePayload.full_name = brandForm.brandName
      basePayload.username = brandForm.username.trim().toLowerCase()
      basePayload.city = brandForm.city
      basePayload.social_links = {
        website: websiteResult.normalizedUrl || brandForm.website || null,
        instagram: instagramResult.normalizedUrl || brandForm.instagram || null,
        tiktok: tiktokResult.normalizedUrl || brandForm.tiktok || null,
        youtube: youtubeResult.normalizedUrl || brandForm.youtube || null,
      }
    }

    // Check username uniqueness before saving
    if (basePayload.username && basePayload.username.trim()) {
      const { data: existingUser } = await supabaseClient
        .from('users')
        .select('id')
        .eq('username', basePayload.username.trim())
        .neq('id', session.user.id)
        .maybeSingle()

      if (existingUser) {
        setErrorMessage('Bu kullanıcı adı zaten kullanılıyor. Lütfen başka bir kullanıcı adı seçin.')
        setIsSaving(false)
        return
      }
    }

    // Use server action to save profile (more reliable than client-side)
    console.log('[Onboarding] Attempting to save profile via server action:', {
      userId: session.user.id,
      email: session.user.email,
      role: role,
      payload: basePayload,
    })

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

    const result = await saveOnboardingProfile({
      userId: session.user.id,
      role: role || 'influencer',
      fullName: role === 'influencer' ? influencerForm.fullName : brandForm.brandName,
      username: (role === 'influencer' ? influencerForm.username : brandForm.username).trim().toLowerCase(),
      city: role === 'influencer' ? influencerForm.city : brandForm.city,
      bio: role === 'influencer' ? influencerForm.bio : '', // Brands don't have bio in form
      category: role === 'influencer' ? influencerForm.category : 'tech', // Default category for brands
      avatarUrl: avatarUrl,
      socialLinks: socialLinks,
    })

    setIsSaving(false)

    if (!result.success) {
      setErrorMessage(result.error || 'Profil kaydedilemedi. Lütfen tekrar deneyin.')
      return
    }

    console.log('[Onboarding] Profile saved successfully via server action')

    // Award badges after onboarding completion
    try {
      const response = await fetch('/api/award-badges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id }),
      })
      if (!response.ok) {
        console.error('Failed to award badges after onboarding')
      }
    } catch (err) {
      console.error('Error awarding badges:', err)
    }

    // Hard redirect to ensure cache is cleared and profile is loaded
    window.location.href = role === 'brand' ? '/dashboard/brand' : '/dashboard/influencer'
  }

  if (!session && !isSessionLoading) {
    return null
  }

  return (
    <main className="px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel rounded-[32px] p-10">
          <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Onboarding</p>
          <h1 className="mt-4 text-3xl font-semibold text-white">Profilini vitrinde hazırla</h1>
          <p className="mt-2 text-gray-300">
            Rolün:{' '}
            <span className="text-soft-gold">
              {role === 'brand' ? 'Marka' : role === 'influencer' ? 'Influencer' : 'Belirleniyor'}
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
                {isSaving ? 'Kaydediliyor...' : 'Kaydet ve Başla'}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

