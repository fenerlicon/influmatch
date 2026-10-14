'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Send, Users } from 'lucide-react'
import { inviteCreators } from '@/app/dashboard/brand/campaigns/actions'
import { listOfferTemplates } from '@/app/profile/actions'
import { Avatar, Button, ButtonLink, Card, CardBody, CardHeader, Chip, EmptyState, Field, Input, Notice, Segmented, Select, Textarea } from '@/components/ui'
import { getCategoryLabel } from '@/utils/categories'
import { OFFER_CAMPAIGN_TYPES } from '@/lib/offer-shared'
import { availabilityText } from '@/lib/availability-shared'
import { CAMPAIGN_LIMITS, formatTryAmount, type CampaignSuggestion } from '@/lib/campaigns-shared'
import type { OfferTemplate } from '@/lib/offer-templates'
import type { InviteOutcome } from '@/lib/campaigns'
import { cn } from '@/utils/cn'
import WizardSteps from './WizardSteps'
import { formatFollowers } from './campaign-ui'

interface Props {
  campaignId: string
  campaignName: string
  totalBudget: number | null
  suggestions: CampaignSuggestion[]
  bulkInvite: boolean
  quotaText: string | null
}

/** Sihirbazın 3. (önerilen profiller) ve 4. (davet) adımı. */
export default function CampaignInvite({ campaignId, campaignName, totalBudget, suggestions, bulkInvite, quotaText }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<2 | 3>(2)
  const [selected, setSelected] = useState<string[]>([])
  const [availableOnly, setAvailableOnly] = useState(false)
  const [form, setForm] = useState({ campaignType: OFFER_CAMPAIGN_TYPES[0] as string, paymentType: 'cash' as 'cash' | 'barter', budget: '', message: '' })
  const [templates, setTemplates] = useState<OfferTemplate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<InviteOutcome | null>(null)
  const [pending, startTransition] = useTransition()
  const byId = useMemo(() => new Map(suggestions.map((s) => [s.id, s])), [suggestions])
  const shown = availableOnly ? suggestions.filter((s) => s.availability.status !== 'busy') : suggestions
  const limit = bulkInvite ? CAMPAIGN_LIMITS.inviteMax : 1

  useEffect(() => {
    if (step !== 3 || templates !== null) return
    listOfferTemplates().then((result) => setTemplates('templates' in result && result.templates ? result.templates : []))
  }, [step, templates])

  const toggle = (id: string) => {
    setSelected((list) => (list.includes(id) ? list.filter((v) => v !== id) : list.length >= limit ? (limit === 1 ? [id] : list) : [...list, id]))
  }

  const pickTemplate = (id: string) => {
    const t = templates?.find((x) => x.id === id)
    if (!t) return
    setForm({
      campaignType: OFFER_CAMPAIGN_TYPES.find((type) => type === t.campaign_type) ?? OFFER_CAMPAIGN_TYPES[0],
      paymentType: t.payment_type === 'barter' ? 'barter' : 'cash',
      budget: t.budget == null ? '' : String(t.budget),
      message: t.message ?? '',
    })
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await inviteCreators(campaignId, { creatorIds: selected, ...form })
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('outcome' in result && result.outcome) {
        setOutcome(result.outcome)
        router.refresh()
      }
    })
  }

  const nameOf = (id: string) => {
    const s = byId.get(id)
    return s?.full_name || (s?.username ? `@${s.username}` : 'Profil')
  }
  const busySelected = selected.filter((id) => byId.get(id)?.availability.status === 'busy')

  if (outcome) {
    return (
      <Card>
        <CardHeader title="Davet sonucu" description={`"${campaignName}" kampanyası`} />
        <CardBody className="grid gap-3 text-[13.5px]">
          {outcome.sent.length > 0 && <Notice tone="success">{outcome.sent.length} profile davet (teklif) gönderildi.</Notice>}
          {outcome.quotaError && (
            <Notice tone="warning" title="Teklif hakkın doldu.">
              {outcome.quotaError}
            </Notice>
          )}
          {outcome.failed.length > 0 && (
            <div>
              <div className="mb-1 font-medium text-ink">Gönderilemeyenler</div>
              <ul className="grid gap-1 text-ink-muted">
                {outcome.failed.map((f) => (
                  <li key={f.id}>
                    {nameOf(f.id)}: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {outcome.notAttempted.length > 0 && (
            <p className="text-ink-muted">Denenmeyenler (teklif hakkı dolduğu için): {outcome.notAttempted.map(nameOf).join(', ')}</p>
          )}
          {outcome.skipped.length > 0 && (
            <p className="text-ink-faint">Atlananlar (bu kampanyada zaten teklifi var): {outcome.skipped.map((s) => nameOf(s.id)).join(', ')}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <ButtonLink href={`/dashboard/brand/campaigns/${campaignId}`} variant="primary">
              Kampanya panosuna git
            </ButtonLink>
            <Button
              onClick={() => {
                setOutcome(null)
                setSelected([])
                setStep(2)
              }}
            >
              Başka profil davet et
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div>
      <WizardSteps current={step} />
      {step === 2 ? (
        <Card>
          <CardHeader
            title="Önerilen profiller"
            description={
              bulkInvite
                ? `Hedefe uyan doğrulanmış profiller (müsait olanlar önce). En fazla ${CAMPAIGN_LIMITS.inviteMax} profil seçebilirsin.`
                : 'Hedefe uyan doğrulanmış profiller. Tek seferde bir profil davet edebilirsin.'
            }
            action={
              <button
                type="button"
                aria-pressed={availableOnly}
                onClick={() => setAvailableOnly((v) => !v)}
                className={cn(
                  'h-[30px] rounded-lg border px-3 text-[12.5px] transition-colors',
                  availableOnly ? 'border-gold/30 bg-gold/10 text-ink' : 'border-line-strong text-ink-muted hover:text-ink',
                )}
              >
                Yalnızca iş alanlar
              </button>
            }
          />
          {shown.length === 0 ? (
            <EmptyState icon={Users} title="Hedefe uyan profil bulunamadı" description="Hedefi genişletmek için kampanyayı düzenleyebilirsin." />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((s) => {
                const on = selected.includes(s.id)
                const name = s.full_name || s.username || 'Profil'
                return (
                  <li key={s.id}>
                    <label className={cn('flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3 hover:bg-white/[0.015]', s.already_invited && 'cursor-not-allowed opacity-60')}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#D4AF37]"
                        checked={on}
                        disabled={s.already_invited}
                        onChange={() => toggle(s.id)}
                        aria-label={`${name} seç`}
                      />
                      <Avatar name={name} src={s.avatar_url} />
                      <div className="min-w-0 flex-[1_1_200px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link href={`/profile/${s.username || s.id}`} target="_blank" className="truncate font-medium text-ink hover:underline">
                            {name}
                          </Link>
                          {s.category && <Chip>{getCategoryLabel(s.category)}</Chip>}
                          {s.category_match === 'primary' && <Chip tone="gold">Kategori uyumlu</Chip>}
                          {s.availability.status === 'busy' && (
                            <Chip tone="warning" dot title={availabilityText(s.availability)}>
                              Şu an dolu
                            </Chip>
                          )}
                          {s.already_invited && <Chip tone="info">Davet edildi</Chip>}
                        </div>
                        <div className="mt-0.5 text-xs text-ink-faint">
                          {[s.username ? `@${s.username}` : null, s.city, `${formatFollowers(s.followers)} takipçi`, s.engagement !== null ? `%${s.engagement.toFixed(1)} etkileşim` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        {s.starting_price !== null ? (
                          <>
                            <div className="font-semibold tabular-nums text-ink">₺{s.starting_price.toLocaleString('tr-TR')}&apos;den</div>
                            {s.fits_budget === false && <div className="text-warning">Toplam bütçenin üstünde</div>}
                          </>
                        ) : (
                          <div className="text-ink-faint">Fiyat kartı yok</div>
                        )}
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card>
          <CardHeader title="Davet" description={`${selected.length} profile aynı teklif gönderilecek. Teklif başlığı: "${campaignName}"`} />
          <CardBody className="grid gap-4">
            {quotaText && <Notice tone="gold">{quotaText} Her davet bir teklif hakkı kullanır.</Notice>}
            {busySelected.length > 0 && (
              <Notice tone="warning">
                {busySelected.map(nameOf).join(', ')} şu an yeni iş almadığını belirtti. Davet yine gönderilebilir ama yanıt gecikebilir.
              </Notice>
            )}
            <div className="flex flex-wrap gap-1.5">
              {selected.map((id) => (
                <Chip key={id}>{nameOf(id)}</Chip>
              ))}
            </div>
            <Field label="Şablondan doldur">
              {(p) => (
                <Select {...p} defaultValue="" disabled={templates === null} onChange={(e) => pickTemplate(e.target.value)}>
                  <option value="">{templates === null ? 'Şablonlar yükleniyor…' : templates.length ? 'Şablon seç' : 'Kayıtlı şablon yok'}</option>
                  {(templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="İçerik türü">
                {(p) => (
                  <Select {...p} value={form.campaignType} onChange={(e) => setForm({ ...form, campaignType: e.target.value })}>
                    {OFFER_CAMPAIGN_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="grid gap-1.5">
                <div className="text-[12.5px] font-medium text-ink-muted">Ödeme</div>
                <Segmented
                  label="Ödeme türü"
                  value={form.paymentType}
                  onSelect={(v) => setForm({ ...form, paymentType: v === 'barter' ? 'barter' : 'cash' })}
                  items={[
                    { value: 'cash', label: 'Nakit' },
                    { value: 'barter', label: 'Barter' },
                  ]}
                />
              </div>
              <Field
                label={form.paymentType === 'barter' ? 'Ürün değeri (₺, kişi başı)' : 'Bütçe (₺, kişi başı)'}
                hint={totalBudget !== null && form.budget ? `Toplam: ${formatTryAmount(Number(form.budget) * selected.length)} / kampanya bütçesi ${formatTryAmount(totalBudget)}` : undefined}
              >
                {(p) => <Input {...p} inputMode="numeric" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value.replace(/\D/g, '').slice(0, 9) })} />}
              </Field>
            </div>
            <Field label="Mesaj" hint="Brief teklifin altında ayrıca görünür; burada kişisel bir not yazabilirsin.">
              {(p) => <Textarea {...p} rows={3} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />}
            </Field>
          </CardBody>
        </Card>
      )}

      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {step === 3 ? (
          <Button leftIcon={<ArrowLeft />} onClick={() => setStep(2)} disabled={pending}>
            Profiller
          </Button>
        ) : (
          <ButtonLink href={`/dashboard/brand/campaigns/${campaignId}`} variant="ghost">
            Şimdilik geç
          </ButtonLink>
        )}
        {step === 2 ? (
          <Button variant="primary" rightIcon={<ArrowRight />} disabled={selected.length === 0} onClick={() => setStep(3)}>
            {selected.length > 0 ? `${selected.length} profil seçildi` : 'Profil seç'}
          </Button>
        ) : (
          <Button variant="primary" leftIcon={pending ? undefined : <Send />} loading={pending} disabled={selected.length === 0 || !form.budget} onClick={submit}>
            Davet gönder
          </Button>
        )}
      </div>
      {step === 3 && <WizardStepHint />}
    </div>
  )
}

function WizardStepHint() {
  return (
    <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint">
      <Check className="h-3 w-3" aria-hidden /> Teklif hakkı dolarsa gönderim durur ve hangi profillere gidemediği gösterilir.
    </p>
  )
}
