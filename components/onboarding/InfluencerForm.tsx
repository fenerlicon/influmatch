'use client'

import { ChangeEvent, useState, useEffect, useCallback, useMemo } from 'react'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { validateInstagram, validateTikTok, validateYouTube } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS, type InfluencerCategoryKey } from '@/utils/categories'
import { Field, Input, Notice, Select, Textarea } from '@/components/ui'
import { cn } from '@/utils/cn'

const CREATOR_TYPES: { value: InfluencerFormState['creatorType']; label: string; desc: string }[] = [
  { value: 'influencer', label: 'Influencer', desc: 'Kendi kitlem var' },
  { value: 'ugc', label: 'UGC kreatörü', desc: 'Markalara özel içerik' },
  { value: 'both', label: 'Her ikisi', desc: 'Hem kitle hem üretim' },
]

export interface InfluencerFormState {
  fullName: string
  username: string
  bio: string
  category: InfluencerCategoryKey
  city: string
  instagram: string
  tiktok: string
  youtube: string
  creatorType: 'influencer' | 'ugc' | 'both'
}

interface InfluencerFormProps {
  form: InfluencerFormState
  onChange: (field: keyof InfluencerFormState, value: string) => void
}

export default function InfluencerForm({ form, onChange }: InfluencerFormProps) {
  const { session } = useSupabaseAuth()
  const [validationErrors, setValidationErrors] = useState<{
    username?: string
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

  const isDirty = useMemo(() => {
    return Object.values(form).some(value => value !== '')
  }, [form])

  useUnsavedChanges(isDirty)

  const handleInput =
    (field: keyof InfluencerFormState) =>
      (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
        if (field === 'instagram') {
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

  const usernameHint =
    validationErrors.username ? undefined
      : usernameStatus === 'checking' ? 'Kontrol ediliyor…'
        : usernameStatus === 'available' ? 'Kullanılabilir'
          : undefined
  const usernameError = validationErrors.username || (usernameStatus === 'taken' ? 'Bu kullanıcı adı alınmış' : undefined)

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Ad soyad">
          {(props) => <Input {...props} value={form.fullName} onChange={handleInput('fullName')} placeholder="Adınız soyadınız" autoComplete="name" />}
        </Field>
        <Field label="Kullanıcı adı" error={usernameError} hint={usernameHint}>
          {(props) => (
            <Input
              {...props}
              value={form.username}
              onChange={handleInput('username')}
              placeholder="kullaniciadi"
              autoComplete="username"
              className={usernameStatus === 'available' && !usernameError ? 'border-success/50' : undefined}
            />
          )}
        </Field>
      </div>

      <Field label="Biyografi">
        {(props) => <Textarea {...props} value={form.bio} onChange={handleInput('bio')} rows={4} placeholder="Kendinden kısaca bahset…" />}
      </Field>

      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-ink-muted" id="creator-type-label">İçerik üretici türü</span>
        <div role="radiogroup" aria-labelledby="creator-type-label" className="grid grid-cols-3 gap-2">
          {CREATOR_TYPES.map((type) => {
            const on = form.creatorType === type.value
            return (
              <button
                key={type.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange('creatorType', type.value)}
                className={cn(
                  'grid gap-1 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                  on ? 'border-gold bg-gold/10' : 'border-line-strong bg-surface-1 hover:border-white/20',
                )}
              >
                <span className="text-[13.5px] font-medium text-ink">{type.label}</span>
                <span className="text-[11.5px] leading-snug text-ink-faint">{type.desc}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Kategori">
          {(props) => (
            <Select {...props} value={form.category} onChange={handleInput('category')}>
              {INFLUENCER_CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>{INFLUENCER_CATEGORIES[key]}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Şehir">
          {(props) => (
            <Select {...props} value={form.city} onChange={handleInput('city')}>
              <option value="">Şehir seçin</option>
              {TURKISH_CITIES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Instagram" error={validationErrors.instagram}>
          {(props) => <Input {...props} value={form.instagram} onChange={handleInput('instagram')} placeholder="Kullanıcı adı veya bağlantı" />}
        </Field>
        <Field label="TikTok" error={validationErrors.tiktok}>
          {(props) => <Input {...props} value={form.tiktok} onChange={handleInput('tiktok')} placeholder="Kullanıcı adı veya bağlantı" />}
        </Field>
        <Field label="YouTube" error={validationErrors.youtube}>
          {(props) => <Input {...props} value={form.youtube} onChange={handleInput('youtube')} placeholder="Kanal adı veya bağlantı" />}
        </Field>
      </div>

      <Notice tone="warning" title="Önemli.">
        Onay için en az bir aktif sosyal medya hesabını doğru girmen gerekiyor; sonraki adımda Instagram veya TikTok hesabını doğrulayacaksın.
      </Notice>
    </div>
  )
}
