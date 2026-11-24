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
import * as webTrust from '@/lib/collaboration-trust-shared'
import * as mobileTrust from '@/mobile-app/constants/trust.js'
import * as webInflucash from '@/lib/influcash-shared'
import * as mobileInflucash from '@/mobile-app/constants/influcash.js'
import * as webDeliverableFiles from '@/lib/deliverable-files-shared'
import * as mobileDeliverableFiles from '@/mobile-app/constants/deliverableFiles.js'
import * as webPhone from '@/lib/phone-shared'
import * as mobilePhone from '@/mobile-app/constants/phone.js'
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

  it('telefon numarası', () => {
    for (const key of ['PHONE_REQUIRED_ERROR', 'PHONE_INVALID_ERROR', 'PHONE_PURPOSE_NOTE', 'MARKETING_SMS_LABEL'] as const) {
      expect((mobilePhone as Record<string, unknown>)[key], key).toBe(webPhone[key])
    }
    for (const v of ['0532 123 45 67', '5321234567', '+90 (532) 123-45-67', '00905321234567', '+44 20 7946 0958', '0123', '', 'abc', '+90 012 345 67 89']) {
      expect(mobilePhone.normalizePhone(v), v).toEqual(webPhone.normalizePhone(v))
    }
    expect(mobilePhone.formatPhone('+905321234567')).toBe(webPhone.formatPhone('+905321234567'))
  })

  it('teslimat dosyası (R2, teslim kilidi)', () => {
    expect(mobileDeliverableFiles.DELIVERABLE_VIDEO_MAX_BYTES).toBe(webDeliverableFiles.DELIVERABLE_VIDEO_MAX_BYTES)
    expect(mobileDeliverableFiles.DELIVERABLE_IMAGE_MAX_BYTES).toBe(webDeliverableFiles.DELIVERABLE_IMAGE_MAX_BYTES)
    expect(mobileDeliverableFiles.DELIVERABLE_LOCK_NOTE).toBe(webDeliverableFiles.DELIVERABLE_LOCK_NOTE)
    const ref = 'r2://deliverables/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/1700000000_abc.mov'
    for (const v of [ref, 'r2://deliverables/x/y/z.mp4', 'https://drive.google.com/x', ref.replace('.mov', '.exe')]) {
      expect(mobileDeliverableFiles.isDeliverableFileRef(v)).toBe(webDeliverableFiles.isDeliverableFileRef(v))
      expect(mobileDeliverableFiles.deliverableFileKind(v)).toBe(webDeliverableFiles.deliverableFileKind(v))
    }
    for (const [name, mime] of [['a.MP4', null], ['b.jpeg', null], ['c', 'video/quicktime'], ['d.gif', 'image/gif']] as const) {
      expect(mobileDeliverableFiles.deliverableFileExtension(name, mime)).toBe(webDeliverableFiles.deliverableFileExtension(name, mime))
    }
    expect(mobileDeliverableFiles.deliverableFileMaxBytes('mov')).toBe(webDeliverableFiles.deliverableFileMaxBytes('mov'))
    expect(mobileDeliverableFiles.deliverableFileMaxBytes('png')).toBe(webDeliverableFiles.deliverableFileMaxBytes('png'))
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

  it('güvenli iş birliği', () => {
    expect(mobileTrust.COMMITMENT_VERSION).toBe(webTrust.COMMITMENT_VERSION)
    expect(mobileTrust.COMMITMENT_TEXT).toBe(webTrust.COMMITMENT_TEXT)
    expect(mobileTrust.COMMITMENT_SHORT).toBe(webTrust.COMMITMENT_SHORT)
    expect(mobileTrust.COMMITMENT_CHECKBOX_LABEL).toBe(webTrust.COMMITMENT_CHECKBOX_LABEL)
    expect(mobileTrust.COMMITMENT_REQUIRED_ERROR).toBe(webTrust.COMMITMENT_REQUIRED_ERROR)
    expect(mobileTrust.DISPUTE_RESPONSE_DAYS).toBe(webTrust.DISPUTE_RESPONSE_DAYS)
    expect(mobileTrust.PAYMENT_CONFIRM_HOURS).toBe(webTrust.PAYMENT_CONFIRM_HOURS)
    expect(mobileTrust.DISPUTE_PROOF_BUCKET).toBe(webTrust.DISPUTE_PROOF_BUCKET)
    expect(mobileTrust.DISPUTE_PROOF_MAX_BYTES).toBe(webTrust.DISPUTE_PROOF_MAX_BYTES)
    expect(mobileTrust.DISPUTE_NOTE_MAX).toBe(webTrust.DISPUTE_NOTE_MAX)
    expect(mobileTrust.DISPUTE_KIND_LABELS).toEqual(webTrust.DISPUTE_KIND_LABELS)
    expect(mobileTrust.DISPUTE_STATUS_LABELS).toEqual(webTrust.DISPUTE_STATUS_LABELS)
    expect(Object.keys(mobileTrust.DISPUTE_STATUS_TONES).sort()).toEqual(Object.keys(webTrust.DISPUTE_STATUS_LABELS).sort())
    expect(mobileTrust.PAYMENT_PROGRESS_LABELS).toEqual(webTrust.PAYMENT_PROGRESS_LABELS)
    expect(mobileTrust.lateCountText('payment', 1, 3)).toBe(webTrust.lateCountText('payment', 1, 3))
    expect(mobileTrust.lateCountText('delivery', 0, 0)).toBe(webTrust.lateCountText('delivery', 0, 0))
  })

  it('Influcash', () => {
    expect(mobileInflucash.INFLUCASH_RULE_NOTE).toBe(webInflucash.INFLUCASH_RULE_NOTE)
    expect(mobileInflucash.INFLUCASH_REWARD_LABELS).toEqual(webInflucash.INFLUCASH_REWARD_LABELS)
  })

  it('influencer kategorileri', () => {
    expect(MOBILE_INFLUENCER_CATEGORIES).toEqual(INFLUENCER_CATEGORIES)
  })
})
