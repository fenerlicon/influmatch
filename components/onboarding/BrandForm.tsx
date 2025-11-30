'use client'

import { ChangeEvent, useState, useEffect, useCallback } from 'react'
import { validateInstagram, validateTikTok, validateYouTube, validateWebsite } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { TURKISH_CITIES } from '@/utils/turkishCities'

export interface BrandFormState {
  brandName: string
  username: string
  city: string
  website: string
  instagram: string
  tiktok: string
  youtube: string
  taxId: string
}

interface BrandFormProps {
  form: BrandFormState
  onChange: (field: keyof BrandFormState, value: string) => void
}

export default function BrandForm({ form, onChange }: BrandFormProps) {
  const { session } = useSupabaseAuth()
  const [validationErrors, setValidationErrors] = useState<{
    username?: string
    website?: string
    instagram?: string
    tiktok?: string
    youtube?: string
  }>({})
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')

  const checkUsername = useCallback(async (username: string) => {
    if (!username || username.trim().length === 0) {
      setUsernameStatus('idle')
      return
    }

    setUsernameStatus('checking')

    try {
      const excludeUserId = session?.user?.id || null
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
  }, [session])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      checkUsername(form.username)
    }, 500) // Debounce 500ms

    return () => clearTimeout(timeoutId)
  }, [form.username, checkUsername])

  const handleInput =
    (field: keyof BrandFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        let value = event.target.value

        // Normalize username to lowercase
        if (field === 'username') {
          value = value.toLowerCase()
        }

        onChange(field, value)

        // Validate username format
        if (field === 'username') {
          const validation = validateUsername(value)
          if (validation.isValid) {
            setValidationErrors((prev) => ({
              ...prev,
              username: undefined,
            }))
          } else {
            setValidationErrors((prev) => ({
              ...prev,
              username: validation.error,
            }))
            setUsernameStatus('idle') // Don't check availability if format is invalid
            return
          }
        }

        // Reset username status when username changes
        if (field === 'username') {
          setUsernameStatus('idle')
        }

        // Validate social links in real-time
        if (field === 'website') {
          const result = validateWebsite(value)
          setValidationErrors((prev) => ({
            ...prev,
            website: result.isValid ? undefined : result.error,
          }))
          if (result.isValid && result.normalizedUrl) {
            onChange(field, result.normalizedUrl)
          }
        } else if (field === 'instagram') {
          const result = validateInstagram(value)
          setValidationErrors((prev) => ({
            ...prev,
            instagram: result.isValid ? undefined : result.error,
          }))
          if (result.isValid && result.normalizedUrl) {
            onChange(field, result.normalizedUrl)
          }
        } else if (field === 'tiktok') {
          const result = validateTikTok(value)
          setValidationErrors((prev) => ({
            ...prev,
            tiktok: result.isValid ? undefined : result.error,
          }))
          if (result.isValid && result.normalizedUrl) {
            onChange(field, result.normalizedUrl)
          }
        } else if (field === 'youtube') {
          const result = validateYouTube(value)
          setValidationErrors((prev) => ({
            ...prev,
            youtube: result.isValid ? undefined : result.error,
          }))
          if (result.isValid && result.normalizedUrl) {
            onChange(field, result.normalizedUrl)
          }
        }
      }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="brandName" className="text-sm text-gray-300">
            Marka Adı
          </label>
          <input
            id="brandName"
            value={form.brandName}
            onChange={handleInput('brandName')}
            placeholder="Örn. Luminous Beauty"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="username" className="text-sm text-gray-300">
            Kullanıcı Adı
          </label>
          <input
            id="username"
            value={form.username}
            onChange={handleInput('username')}
            placeholder="@marka"
            className={`mt-2 w-full rounded-2xl border px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none ${validationErrors.username || usernameStatus === 'taken'
                ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                : usernameStatus === 'available'
                  ? 'border-emerald-500/60 bg-emerald-500/10 focus:border-emerald-500'
                  : 'border-white/10 bg-white/5 focus:border-soft-gold'
              }`}
          />
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
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="city" className="text-sm text-gray-300">
            Şehir
          </label>
          <select
            id="city"
            value={form.city}
            onChange={handleInput('city')}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white focus:border-soft-gold focus:outline-none"
          >
            <option value="">Şehir seçin</option>
            {TURKISH_CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="website" className="text-sm text-gray-300">
            Web Sitesi
          </label>
          <input
            id="website"
            type="text"
            value={form.website}
            onChange={handleInput('website')}
            placeholder="www.ornek.com"
            className={`mt-2 w-full rounded-2xl border px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none ${validationErrors.website
                ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                : 'border-white/10 bg-white/5 focus:border-soft-gold'
              }`}
          />
          {validationErrors.website && (
            <p className="mt-1 text-xs text-red-300">{validationErrors.website}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="taxId" className="text-sm text-gray-300">
          Vergi Numarası <span className="text-gray-500 text-xs">(Opsiyonel)</span>
        </label>
        <input
          id="taxId"
          type="text"
          value={form.taxId}
          onChange={handleInput('taxId')}
          placeholder="1234567890"
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-gray-500 focus:border-soft-gold focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-400">
          Vergi numaranızı girerseniz, onay sürecine alınacaksınız. Onaylandıktan sonra &quot;Resmi İşletme&quot; rozetini alacaksınız.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div>
          <label htmlFor="instagram" className="text-sm text-gray-300">
            Instagram
          </label>
          <input
            id="instagram"
            type="text"
            value={form.instagram}
            onChange={handleInput('instagram')}
            placeholder="@kullaniciadi veya https://instagram.com/..."
            className={`mt-2 w-full rounded-2xl border px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none ${validationErrors.instagram
                ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                : 'border-white/10 bg-white/5 focus:border-soft-gold'
              }`}
          />
          {validationErrors.instagram && (
            <p className="mt-1 text-xs text-red-300">{validationErrors.instagram}</p>
          )}
        </div>
        <div>
          <label htmlFor="tiktok" className="text-sm text-gray-300">
            TikTok
          </label>
          <input
            id="tiktok"
            type="text"
            value={form.tiktok}
            onChange={handleInput('tiktok')}
            placeholder="@kullaniciadi veya https://tiktok.com/@..."
            className={`mt-2 w-full rounded-2xl border px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none ${validationErrors.tiktok
                ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                : 'border-white/10 bg-white/5 focus:border-soft-gold'
              }`}
          />
          {validationErrors.tiktok && (
            <p className="mt-1 text-xs text-red-300">{validationErrors.tiktok}</p>
          )}
        </div>
        <div>
          <label htmlFor="youtube" className="text-sm text-gray-300">
            YouTube
          </label>
          <input
            id="youtube"
            type="text"
            value={form.youtube}
            onChange={handleInput('youtube')}
            placeholder="@kullaniciadi veya https://youtube.com/@..."
            className={`mt-2 w-full rounded-2xl border px-5 py-4 text-white placeholder:text-gray-500 focus:outline-none ${validationErrors.youtube
                ? 'border-red-500/60 bg-red-500/10 focus:border-red-500'
                : 'border-white/10 bg-white/5 focus:border-soft-gold'
              }`}
          />
          {validationErrors.youtube && (
            <p className="mt-1 text-xs text-red-300">{validationErrors.youtube}</p>
          )}
        </div>
      </div>
    </div>
  )
}

