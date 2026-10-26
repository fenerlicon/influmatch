// Mobil uygulamadaki sabit kopyaları (mobile-app/constants/*) web'deki asıl kaynakla aynı mı?
// Dosya başlıkları "aynı tutulmalı" diyor; bu test unutulan güncellemeyi yakalar.
import { describe, expect, it } from 'vitest'
import * as webPlans from '@/lib/spotlight-plans'
import * as mobilePlans from '@/mobile-app/constants/spotlightPlans.js'
import * as webAlerts from '@/lib/advert-alerts-shared'
import * as mobileAlerts from '@/mobile-app/constants/advertAlerts.js'
import * as webWorkspace from '@/lib/collaboration-workspace-shared'
import * as mobileWorkspace from '@/mobile-app/constants/collaborationWorkspace.js'
import * as webAvailability from '@/lib/availability-shared'
import * as mobileAvailability from '@/mobile-app/constants/availability.js'
import * as webCampaigns from '@/lib/campaigns-shared'
import * as mobileCampaigns from '@/mobile-app/constants/campaigns.js'
import * as webModeration from '@/lib/moderation-shared'
import * as mobileModeration from '@/mobile-app/constants/moderation.js'
import * as webConsent from '@/lib/consent-shared'
import * as mobileConsent from '@/mobile-app/constants/consent.js'
import { INFLUENCER_CATEGORIES } from '@/utils/categories'
import { INFLUENCER_CATEGORIES as MOBILE_INFLUENCER_CATEGORIES } from '@/mobile-app/constants/categories.js'

describe('web ↔ mobil sabitleri', () => {
  it('Spotlight fiyatları ve paket içerikleri', () => {
    expect(mobilePlans.SPOTLIGHT_PLAN_PRICES).toEqual(webPlans.SPOTLIGHT_PLAN_PRICES)
    expect(mobilePlans.SPOTLIGHT_PLAN_FEATURES).toEqual(webPlans.SPOTLIGHT_PLAN_FEATURES)
  })

  it('ilan alarmı', () => {
    expect(mobileAlerts.ADVERT_ALERT_LIMIT).toBe(webAlerts.ADVERT_ALERT_LIMIT)
    expect(mobileAlerts.ADVERT_ALERT_PLATFORMS).toEqual(webAlerts.ADVERT_ALERT_PLATFORMS)
    const alert = { category_key: 'beauty', category: 'cilt', platform: 'tiktok', min_budget: 2500 }
    expect(mobileAlerts.describeAlert(alert)).toBe(webAlerts.describeAlert(alert))
  })

  it('iş birliği takip alanı', () => {
    expect(mobileWorkspace.DELIVERABLE_KIND_LABELS).toEqual(webWorkspace.DELIVERABLE_KIND_LABELS)
    expect(mobileWorkspace.PAYMENT_TYPE_LABELS).toEqual(webWorkspace.PAYMENT_TYPE_LABELS)
    expect(mobileWorkspace.AGREEMENT_SUMMARY_NOTE).toBe(webWorkspace.AGREEMENT_SUMMARY_NOTE)
    const statusLabels = Object.fromEntries(Object.entries(mobileWorkspace.DELIVERABLE_STATUS).map(([k, v]) => [k, (v as { label: string }).label]))
    expect(statusLabels).toEqual(webWorkspace.DELIVERABLE_STATUS_LABELS)
    for (const [key, value] of Object.entries(mobileWorkspace.AGREEMENT_LIMITS)) {
      expect(value, key).toBe((webWorkspace.AGREEMENT_LIMITS as Record<string, number>)[key])
    }
    expect(mobileWorkspace.revisionUsageText(1, 2)).toBe(webWorkspace.revisionUsageText(1, 2))
    expect(mobileWorkspace.reliabilityText(3, 2)).toBe(webWorkspace.reliabilityText(3, 2))
  })

  it('müsaitlik', () => {
    expect(mobileAvailability.AVAILABILITY_NOTE_MAX).toBe(webAvailability.AVAILABILITY_NOTE_MAX)
    expect(mobileAvailability.AVAILABILITY_LABELS).toEqual(webAvailability.AVAILABILITY_LABELS)
    const busy = { status: 'busy' as const, note: null, until: '2026-12-01' }
    expect(mobileAvailability.availabilityText(busy)).toBe(webAvailability.availabilityText(busy))
    expect(mobileAvailability.busyOfferWarning(busy, 'Ayşe')).toBe(webAvailability.busyOfferWarning(busy, 'Ayşe'))
  })

  it('kampanyalar', () => {
    expect(mobileCampaigns.CAMPAIGN_STATUS_LABELS).toEqual(webCampaigns.CAMPAIGN_STATUS_LABELS)
    expect(mobileCampaigns.CAMPAIGN_STATUSES).toEqual(webCampaigns.CAMPAIGN_STATUSES)
    expect(mobileCampaigns.CAMPAIGN_OPEN_STATUSES).toEqual(webCampaigns.CAMPAIGN_OPEN_STATUSES)
    for (const [key, value] of Object.entries(mobileCampaigns.CAMPAIGN_LIMITS)) {
      expect(value, key).toBe((webCampaigns.CAMPAIGN_LIMITS as Record<string, number>)[key])
    }
  })

  it('ret nedeni ve itiraz', () => {
    expect(mobileModeration.APPEAL_TEXT_MAX).toBe(webModeration.APPEAL_TEXT_MAX)
    expect(mobileModeration.APPEAL_FILES_BUCKET).toBe(webModeration.APPEAL_FILES_BUCKET)
    expect(mobileModeration.APPEAL_FILE_MAX_BYTES).toBe(webModeration.APPEAL_FILE_MAX_BYTES)
    expect(mobileModeration.APPEAL_STATUS_LABELS).toEqual(webModeration.APPEAL_STATUS_LABELS)
  })

  it('KVKK rıza sürümü ve veri indirme sınırı', () => {
    expect(mobileConsent.LEGAL_CONSENT_VERSION).toBe(webConsent.LEGAL_CONSENT_VERSION)
    expect(mobileConsent.DATA_EXPORT_COOLDOWN_MINUTES).toBe(webConsent.DATA_EXPORT_COOLDOWN_MINUTES)
  })

  it('influencer kategorileri', () => {
    expect(MOBILE_INFLUENCER_CATEGORIES).toEqual(INFLUENCER_CATEGORIES)
  })
})
