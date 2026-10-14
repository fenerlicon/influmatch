'use client'

import { ChangeEvent, useState, useEffect, useCallback, useMemo } from 'react'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { validateInstagram, validateTikTok, validateYouTube, validateWebsite } from '@/utils/socialLinkValidation'
import { validateUsername } from '@/utils/usernameValidation'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import { validateTaxNumber } from '@/lib/tax-id'
import { validateCorporateEmail } from '@/lib/corporate-email'
import { Field, Input, Select } from '@/components/ui'

export interface BrandFormState {
  brandName: string
  username: string
  city: string
  website: string
  corporateEmail: string
  instagram: string
  tiktok: string
  youtube: string
  taxId: string
  taxOffice?: string
  taxOfficeCity?: string
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

  const isDirty = useMemo(() => {
    return Object.values(form).some(value => value !== '')
  }, [form])

  useUnsavedChanges(isDirty)

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

  const corporateEmailValidation = form.corporateEmail?.trim() ? validateCorporateEmail(form.corporateEmail, form.website) : null
  const corporateEmailError = corporateEmailValidation && !corporateEmailValidation.isValid ? corporateEmailValidation.error : null
  const taxIdValidation = form.taxId?.trim() ? validateTaxNumber(form.taxId) : null
  const taxIdError = taxIdValidation && !taxIdValidation.isValid ? taxIdValidation.error : null

  const usernameHint =
    validationErrors.username ? undefined
      : usernameStatus === 'checking' ? 'Kontrol ediliyor…'
        : usernameStatus === 'available' ? 'Kullanılabilir'
          : undefined
  const usernameError = validationErrors.username || (usernameStatus === 'taken' ? 'Bu kullanıcı adı alınmış' : undefined)
  const required = <span className="text-danger" aria-hidden> *</span>

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Marka adı">
          {(props) => <Input {...props} value={form.brandName} onChange={handleInput('brandName')} placeholder="Markanızın adı" autoComplete="organization" />}
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

      <div className="grid gap-4 md:grid-cols-2">
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
        <Field label={<>Web sitesi{required}</>} error={validationErrors.website}>
          {(props) => <Input {...props} value={form.website} onChange={handleInput('website')} placeholder="https://www.markaniz.com" autoComplete="url" />}
        </Field>
      </div>

      <Field
        label={<>Kurumsal e-posta{required}</>}
        error={corporateEmailError ?? undefined}
        hint='Web sitenizin alan adına ait bir e-posta olmalı (giriş e-postanızdan farklı olabilir). "Resmi İşletme" rozeti için bu adrese gönderilen kodla doğrulanır.'
      >
        {(props) => (
          <Input {...props} type="email" autoComplete="email" value={form.corporateEmail} onChange={handleInput('corporateEmail')} placeholder="ad@markaniz.com" />
        )}
      </Field>

      <Field
        label={<>Vergi numarası <span className="font-normal text-ink-faint">(isteğe bağlı)</span></>}
        error={taxIdError ?? undefined}
        hint="Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girer. Kurumsal fatura için gereklidir."
      >
        {(props) => (
          <Input {...props} inputMode="numeric" maxLength={14} value={form.taxId} onChange={handleInput('taxId')} placeholder="1234567890" />
        )}
      </Field>

      {form.taxId && form.taxId.trim() && (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={<>Vergi dairesi{required}</>}>
            {(props) => <Input {...props} value={form.taxOffice || ''} onChange={handleInput('taxOffice')} placeholder="Kadıköy Vergi Dairesi" />}
          </Field>
          <Field label={<>Şirketin bağlı olduğu il{required}</>}>
            {(props) => (
              <Select {...props} value={form.taxOfficeCity || ''} onChange={handleInput('taxOfficeCity')}>
                <option value="">Şehir seçin</option>
                {TURKISH_CITIES.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      )}

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
    </div>
  )
}
