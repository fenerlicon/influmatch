import type { ChipTone } from '@/components/ui'
import type { CampaignOfferStatus, CampaignStatus } from '@/lib/campaigns-shared'

// Kampanya ekranlarının ortak görsel eşlemeleri (3.19).

export const CAMPAIGN_STATUS_TONES: Record<CampaignStatus, ChipTone> = {
  draft: 'neutral',
  active: 'gold',
  completed: 'success',
  archived: 'neutral',
}

export const CAMPAIGN_OFFER_STATUS_TONES: Record<CampaignOfferStatus, ChipTone> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
  expired: 'neutral',
  withdrawn: 'neutral',
}

export const formatCampaignDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : null

export const formatFollowers = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}B` : String(n)
