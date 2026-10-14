'use client'

import { useState } from 'react'
import {
  Award, BadgeCheck, Check, Database, ExternalLink, Globe, Instagram, Mail, MailCheck, RotateCcw, Star, Trash2, X, Youtube,
} from 'lucide-react'
import { influencerBadges, brandBadges, type Badge } from '@/app/badges/data'
import BadgeCompactList from '@/components/badges/BadgeCompactList'
import TaxVerificationReview from '@/components/admin/TaxVerificationReview'
import { Avatar, Button, buttonClasses, Card, Chip, Eyebrow, Notice } from '@/components/ui'
import { getCategoryLabel } from '@/utils/categories'
import { validateTaxNumber } from '@/lib/tax-id'
import { formatLastSeen, isOnline } from '@/lib/presence'
import { displayName, formatDay, hasTick, missingInfo, socialCount, socialLink, socialUrl, type AdminUser } from './types'

export interface UserDetailActions {
  verify: () => void
  reject: () => void
  remove: () => void
  resendEmail: () => void
  forceVerifyEmail: () => void
  toggleTick: () => void
  clearTickOverride: () => void
  verifyTaxId: () => void
  spotlight: () => void
  awardBadge: () => void
  updateInstagram: () => void
}

interface UserDetailProps {
  user: AdminUser
  lastSeen?: string
  now: number
  busy: boolean
  actions: UserDetailActions
  onClose: () => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </>
  )
}

/** Seçili kullanıcının inceleme paneli (design/redesign/admin.html sağ kart). */
export default function UserDetail({ user, lastSeen, now, busy, actions, onClose }: UserDetailProps) {
  const [bioOpen, setBioOpen] = useState(false)
  const isBrand = user.role === 'brand'
  const tick = hasTick(user)
  const online = isOnline(lastSeen, now)
  const missing = missingInfo(user)
  const links = (['instagram', 'tiktok', 'youtube', 'website'] as const)
    .map((p) => ({ platform: p, url: socialUrl(socialLink(user, p), p) }))
    .filter((l) => l.url)
  const website = socialLink(user, 'website')
  const taxCheck = user.tax_id ? validateTaxNumber(user.tax_id) : null
  const emailDomain = user.email?.split('@')[1]?.toLowerCase()
  const websiteDomain = website?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()
  const badges = ((user.displayed_badges ?? []) as string[])
    .map((id) => (isBrand ? brandBadges : influencerBadges).find((b) => b.id === id))
    .filter((b): b is Badge => !!b)

  return (
    <Card className="lg:sticky lg:top-4">
      {/* Başlık */}
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <Avatar name={displayName(user)} src={user.avatar_url ?? undefined} square />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-ink">{displayName(user)}</div>
          <div className="truncate text-xs text-ink-faint">
            {[user.username ? `@${user.username}` : null, user.email].filter(Boolean).join(' · ')}
          </div>
        </div>
        {user.username && (
          <a
            href={`/profile/${user.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            <ExternalLink aria-hidden /> Profil
          </a>
        )}
        <Button size="sm" variant="ghost" iconOnly aria-label="Kapat" onClick={onClose}>
          <X />
        </Button>
      </div>

      <div className="grid gap-5 px-5 py-4">
        {/* Durum */}
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={isBrand ? 'gold' : 'info'}>{isBrand ? 'Marka' : 'Influencer'}</Chip>
          <Chip tone={user.verification_status === 'verified' ? 'success' : user.verification_status === 'rejected' ? 'danger' : 'warning'} dot>
            {user.verification_status === 'verified' ? 'Onaylı' : user.verification_status === 'rejected' ? 'Reddedildi' : 'Bekliyor'}
          </Chip>
          <Chip tone={online ? 'success' : 'neutral'} dot>
            {online ? 'Çevrimiçi' : `Son görülme: ${formatLastSeen(lastSeen, now)}`}
          </Chip>
          <Chip tone={user.email_verified_at ? 'success' : 'danger'}>{user.email_verified_at ? 'E-posta onaylı' : 'E-posta onaysız'}</Chip>
          <Chip tone={tick ? (isBrand ? 'gold' : 'info') : 'neutral'}>
            {isBrand ? 'Sarı tik' : 'Mavi tik'}: {tick ? 'var' : 'yok'}
            {user.blue_tick_override ? ' (elle)' : ''}
          </Chip>
          {user.spotlight_active && <Chip tone="gold">Spotlight</Chip>}
        </div>

        {/* Uyarılar */}
        {isBrand && user.tax_id && !user.tax_id_verified && (
          <Notice tone="warning" title="Vergi no onayı bekliyor.">
            {user.tax_verification?.status === 'needs_review'
              ? 'Levha yüklendi; otomatik kontrol bazı noktalarda takıldı.'
              : 'Vergi numarası girildi, henüz onaylanmadı.'}
          </Notice>
        )}
        {user.verification_status === 'pending' && (
          <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[12.5px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Sosyal hesaplar</span>
              <span className={socialCount(user) >= 1 ? 'text-success' : 'text-danger'}>{socialCount(user)} / en az 1</span>
            </div>
            {missing.length > 0 && <p className="mt-1.5 text-ink-faint">Eksik: {missing.join(', ')}</p>}
          </div>
        )}
        {user.admin_notes && <Notice tone="warning" title="Yönetici notu.">{user.admin_notes}</Notice>}

        {/* Bilgiler */}
        <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
          <Row label="Kayıt">{formatDay(user.created_at)}</Row>
          {user.city && <Row label="Şehir">{user.city}</Row>}
          {user.category && <Row label="Kategori">{getCategoryLabel(user.category)}</Row>}
          {isBrand && (
            <>
              {user.company_legal_name && <Row label="Yasal şirket adı">{user.company_legal_name}</Row>}
              {user.tax_office && <Row label="Vergi dairesi">{user.tax_office}</Row>}
              {user.tax_office_city && <Row label="Bağlı olduğu il">{user.tax_office_city}</Row>}
              <Row label="Vergi no">
                {user.tax_id ? (
                  <span className="tabular-nums">
                    {user.tax_id}
                    {user.tax_id_verified ? <Chip tone="success" className="ml-2">Onaylı</Chip> : null}
                  </span>
                ) : (
                  <span className="text-ink-faint">Girilmedi</span>
                )}
              </Row>
              <Row label="Kurumsal e-posta">
                {user.corporate_email ? (
                  <span>
                    {user.corporate_email}{' '}
                    <Chip tone={user.corporate_email_verified_at ? 'success' : 'warning'}>
                      {user.corporate_email_verified_at ? 'Doğrulandı' : 'Doğrulanmadı'}
                    </Chip>
                  </span>
                ) : (
                  <span className="text-ink-faint">Girilmedi (sarı tik verilemez)</span>
                )}
              </Row>
            </>
          )}
          <Row label="ID"><span className="font-mono text-xs text-ink-muted">{user.id}</span></Row>
        </dl>

        {/* Şirket doğrulama */}
        {isBrand && (user.tax_id || user.tax_verification) && (
          <div className="grid gap-3">
            {taxCheck && (
              <p className={taxCheck.isValid ? 'text-xs text-success' : 'text-xs text-danger'}>
                {taxCheck.isValid
                  ? `${taxCheck.type === 'vkn' ? 'VKN (şirket)' : 'T.C. kimlik no (şahıs şirketi)'}: algoritma kontrolü geçti`
                  : 'Vergi numarası algoritma kontrolünden geçmiyor.'}
              </p>
            )}
            {emailDomain && websiteDomain && emailDomain === websiteDomain && (
              <p className="text-xs text-success">E-posta alan adı ({emailDomain}) web sitesiyle eşleşiyor.</p>
            )}
            {user.tax_verification ? (
              <TaxVerificationReview key={user.tax_verification.id} verification={user.tax_verification} />
            ) : (
              user.tax_id && !user.tax_id_verified && <p className="text-xs text-ink-faint">Vergi levhası henüz yüklenmedi.</p>
            )}
            {user.tax_id && !user.tax_id_verified && (
              <div>
                <Button size="sm" onClick={actions.verifyTaxId} disabled={busy} leftIcon={<Check />}>Vergi numarasını onayla</Button>
              </div>
            )}
          </div>
        )}

        {/* Sosyal hesaplar */}
        {links.length > 0 && (
          <div>
            <Eyebrow className="mb-2">Hesaplar</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {links.map(({ platform, url }) => (
                <a
                  key={platform}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses({ size: 'sm' })}
                >
                  {platform === 'instagram' ? <Instagram className="h-3.5 w-3.5" aria-hidden />
                    : platform === 'youtube' ? <Youtube className="h-3.5 w-3.5" aria-hidden />
                      : platform === 'website' ? <Globe className="h-3.5 w-3.5" aria-hidden />
                        : <span className="text-[10px] font-bold" aria-hidden>TT</span>}
                  {platform === 'instagram' ? 'Instagram' : platform === 'tiktok' ? 'TikTok' : platform === 'youtube' ? 'YouTube' : 'Web sitesi'}
                </a>
              ))}
              {!isBrand && user.verification_status !== 'rejected' && socialLink(user, 'instagram') && (
                <Button size="sm" variant="ghost" onClick={actions.updateInstagram} disabled={busy} leftIcon={<Database />}>
                  Instagram verisini güncelle
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Biyografi */}
        {user.bio && (
          <div>
            <Eyebrow className="mb-1.5">Biyografi</Eyebrow>
            <p className={`whitespace-pre-wrap text-[13px] text-ink-muted ${bioOpen ? '' : 'line-clamp-3'}`}>{user.bio}</p>
            {user.bio.length > 150 && (
              <button type="button" onClick={() => setBioOpen((v) => !v)} className="mt-1 text-xs text-gold hover:underline">
                {bioOpen ? 'Daha az göster' : 'Devamını oku'}
              </button>
            )}
          </div>
        )}

        {/* Rozetler */}
        {user.verification_status === 'verified' && badges.length > 0 && (
          <div>
            <Eyebrow className="mb-2">Rozetler</Eyebrow>
            <BadgeCompactList badges={badges} userRole={user.role ?? 'influencer'} />
          </div>
        )}

        {/* Hesap işlemleri */}
        <div>
          <Eyebrow className="mb-2">Hesap işlemleri</Eyebrow>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={actions.resendEmail} disabled={busy} leftIcon={<Mail />}>Doğrulama e-postası</Button>
            {!user.email_verified_at && (
              <Button size="sm" onClick={actions.forceVerifyEmail} disabled={busy} leftIcon={<MailCheck />}>E-postayı elle onayla</Button>
            )}
            <Button size="sm" onClick={actions.toggleTick} disabled={busy} leftIcon={<BadgeCheck />}>
              {isBrand ? (tick ? 'Sarı tiki kaldır' : 'Sarı tik ver') : tick ? 'Mavi tiki kaldır' : 'Mavi tik ver'}
            </Button>
            {!isBrand && user.blue_tick_override && (
              <Button size="sm" variant="ghost" onClick={actions.clearTickOverride} disabled={busy} leftIcon={<RotateCcw />}>
                {user.blue_tick_override === 'granted' ? 'Elle verildi' : 'Elle kaldırıldı'} · otomatiğe döndür
              </Button>
            )}
            {user.verification_status === 'verified' && (
              <>
                <Button size="sm" onClick={actions.spotlight} disabled={busy} leftIcon={<Star />}>
                  {user.spotlight_active ? "Spotlight'ı kapat" : "Spotlight'ı aç"}
                </Button>
                <Button size="sm" onClick={actions.awardBadge} disabled={busy} leftIcon={<Award />}>Rozet ver</Button>
              </>
            )}
            <Button size="sm" variant="danger" onClick={actions.remove} disabled={busy} leftIcon={<Trash2 />}>Hesabı sil</Button>
          </div>
        </div>
      </div>

      {/* Ana karar */}
      <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
        {user.verification_status !== 'rejected' && (
          <Button variant="danger" onClick={actions.reject} disabled={busy} leftIcon={<X />}>Reddet</Button>
        )}
        {user.verification_status !== 'verified' && (
          <Button variant="primary" onClick={actions.verify} disabled={busy} leftIcon={<Check />}>Onayla</Button>
        )}
      </div>
    </Card>
  )
}
