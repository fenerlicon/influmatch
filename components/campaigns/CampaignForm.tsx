'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from 'lucide-react'
import { saveCampaign } from '@/app/dashboard/brand/campaigns/actions'
import { Button, Card, CardBody, CardHeader, Field, Input, Notice, Segmented, Select, Textarea } from '@/components/ui'
import { INFLUENCER_CATEGORIES, INFLUENCER_CATEGORY_KEYS } from '@/utils/categories'
import { TURKISH_CITIES } from '@/utils/turkishCities'
import {
  CAMPAIGN_LIMITS,
  CAMPAIGN_PLATFORM_LABELS,
  CAMPAIGN_PLATFORMS,
  DELIVERABLE_KIND_LABELS,
  DELIVERABLE_KINDS,
  type CampaignPlatform,
  type CampaignRow,
  type DeliverableKind,
} from '@/lib/campaigns-shared'
import { cn } from '@/utils/cn'
import WizardSteps from './WizardSteps'

interface Props {
  /** Düzenlemede mevcut kampanya; yoksa yeni kampanya. */
  initial?: CampaignRow | null
}

interface FormState {
  name: string
  goal: string
  keyMessages: string
  dos: string
  donts: string
  exampleLinks: string
  hashtags: string
  notes: string
  startDate: string
  endDate: string
  totalBudget: string
  perCreatorBudget: string
  plannedCreators: string
  deliverables: Array<{ kind: DeliverableKind; quantity: string }>
  categories: string[]
  cities: string[]
  platforms: CampaignPlatform[]
  creatorType: 'all' | 'influencer' | 'ugc'
  minFollowers: string
  maxFollowers: string
}

function stateFrom(c?: CampaignRow | null): FormState {
  return {
    name: c?.name ?? '',
    goal: c?.goal ?? '',
    keyMessages: c?.key_messages ?? '',
    dos: c?.dos ?? '',
    donts: c?.donts ?? '',
    exampleLinks: (c?.example_links ?? []).join('\n'),
    hashtags: (c?.hashtags ?? []).join(' '),
    notes: c?.notes ?? '',
    startDate: c?.start_date ?? '',
    endDate: c?.end_date ?? '',
    totalBudget: c?.total_budget != null ? String(c.total_budget) : '',
    perCreatorBudget: c?.per_creator_budget != null ? String(c.per_creator_budget) : '',
    plannedCreators: c?.planned_creators != null ? String(c.planned_creators) : '',
    deliverables: (c?.default_deliverables ?? []).map((d) => ({ kind: d.kind, quantity: String(d.quantity) })),
    categories: c?.target_categories ?? [],
    cities: c?.target_cities ?? [],
    platforms: c?.target_platforms ?? [],
    creatorType: c?.target_creator_type ?? 'all',
    minFollowers: c?.min_followers != null ? String(c.min_followers) : '',
    maxFollowers: c?.max_followers != null ? String(c.max_followers) : '',
  }
}

const digits = (value: string, max = 13) => value.replace(/\D/g, '').slice(0, max)

/** Kampanya sihirbazının ilk iki adımı (brief + hedef); kaydedince öneriler / davet adımına geçer. Düzenlemede aynı form. */
export default function CampaignForm({ initial }: Props) {
  const router = useRouter()
  const editing = !!initial
  const [step, setStep] = useState<0 | 1>(0)
  const [form, setForm] = useState<FormState>(() => stateFrom(initial))
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }))

  const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await saveCampaign(
        {
          name: form.name,
          goal: form.goal,
          keyMessages: form.keyMessages,
          dos: form.dos,
          donts: form.donts,
          exampleLinks: form.exampleLinks,
          hashtags: form.hashtags,
          notes: form.notes,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          totalBudget: form.totalBudget || null,
          perCreatorBudget: form.perCreatorBudget || null,
          plannedCreators: form.plannedCreators || null,
          defaultDeliverables: form.deliverables.map((d) => ({ kind: d.kind, quantity: Number(d.quantity) })),
          targetCategories: form.categories,
          targetCities: form.cities,
          targetPlatforms: form.platforms,
          targetCreatorType: form.creatorType === 'all' ? null : form.creatorType,
          minFollowers: form.minFollowers || null,
          maxFollowers: form.maxFollowers || null,
        },
        initial?.id ?? null,
      )
      if ('error' in result && result.error) {
        setError(result.error)
        return
      }
      if ('campaignId' in result && result.campaignId) {
        router.push(editing ? `/dashboard/brand/campaigns/${result.campaignId}` : `/dashboard/brand/campaigns/${result.campaignId}/invite`)
        router.refresh()
      }
    })
  }

  return (
    <div>
      {!editing && <WizardSteps current={step} />}
      {editing && (
        <div className="mb-4">
          <Segmented
            label="Bölüm"
            value={String(step)}
            onSelect={(v) => setStep(v === '1' ? 1 : 0)}
            items={[
              { value: '0', label: 'Brief' },
              { value: '1', label: 'Hedef' },
            ]}
          />
        </div>
      )}

      {step === 0 ? (
        <Card>
          <CardHeader title="Brief" description="Davet ettiğin influencer'lar bu bilgileri teklifte ve iş birliği sayfasında salt okunur görür." />
          <CardBody className="grid gap-4">
            <Field label="Kampanya adı *" hint="Davet teklifinin başlığı olarak da kullanılır.">
              {(p) => <Input {...p} value={form.name} maxLength={CAMPAIGN_LIMITS.nameMax} onChange={(e) => set('name', e.target.value)} placeholder="Örn. Yaz koleksiyonu lansmanı" />}
            </Field>
            <Field label="Hedef">
              {(p) => <Textarea {...p} rows={2} value={form.goal} maxLength={CAMPAIGN_LIMITS.goalMax} onChange={(e) => set('goal', e.target.value)} placeholder="Bu kampanyayla ne elde etmek istiyorsun?" />}
            </Field>
            <Field label="Ana mesajlar">
              {(p) => <Textarea {...p} rows={3} value={form.keyMessages} maxLength={CAMPAIGN_LIMITS.textMax} onChange={(e) => set('keyMessages', e.target.value)} />}
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Yapılacaklar">
                {(p) => <Textarea {...p} rows={3} value={form.dos} maxLength={CAMPAIGN_LIMITS.textMax} onChange={(e) => set('dos', e.target.value)} />}
              </Field>
              <Field label="Yapılmayacaklar">
                {(p) => <Textarea {...p} rows={3} value={form.donts} maxLength={CAMPAIGN_LIMITS.textMax} onChange={(e) => set('donts', e.target.value)} />}
              </Field>
            </div>
            <Field label="Örnek linkler" hint={`Her satıra bir link (http/https), en fazla ${CAMPAIGN_LIMITS.exampleLinks}.`}>
              {(p) => <Textarea {...p} rows={2} value={form.exampleLinks} onChange={(e) => set('exampleLinks', e.target.value)} placeholder="https://..." />}
            </Field>
            <Field label="Etiketler ve bahsetmeler" hint="Boşlukla ayır: #yazkoleksiyonu @markahesabi">
              {(p) => <Input {...p} value={form.hashtags} onChange={(e) => set('hashtags', e.target.value)} />}
            </Field>
            <Field label="Notlar (isteğe bağlı)">
              {(p) => <Textarea {...p} rows={2} value={form.notes} maxLength={CAMPAIGN_LIMITS.textMax} onChange={(e) => set('notes', e.target.value)} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Başlangıç">
                {(p) => <Input {...p} type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />}
              </Field>
              <Field label="Bitiş">
                {(p) => <Input {...p} type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => set('endDate', e.target.value)} />}
              </Field>
              <Field label="Toplam bütçe (₺, isteğe bağlı)">
                {(p) => <Input {...p} inputMode="numeric" value={form.totalBudget} onChange={(e) => set('totalBudget', digits(e.target.value, 9))} />}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kişi başı bütçe (₺, isteğe bağlı)" hint="Önerilerde fiyat kartı bu tutarla kıyaslanır.">
                {(p) => <Input {...p} inputMode="numeric" value={form.perCreatorBudget} onChange={(e) => set('perCreatorBudget', digits(e.target.value, 9))} />}
              </Field>
              <Field label="Planlanan profil sayısı (isteğe bağlı)" hint="Kişi başı bütçe boşsa toplam bütçe bu sayıya bölünür.">
                {(p) => <Input {...p} inputMode="numeric" value={form.plannedCreators} onChange={(e) => set('plannedCreators', digits(e.target.value, 4))} />}
              </Field>
            </div>
            <div className="grid gap-2">
              <div className="text-[12.5px] font-medium text-ink-muted">Varsayılan teslimatlar</div>
              <p className="text-xs text-ink-faint">İş birliği başlayınca anlaşma özeti bu teslimatlarla doldurulabilir.</p>
              {form.deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    aria-label="Teslimat türü"
                    value={d.kind}
                    onChange={(e) => set('deliverables', form.deliverables.map((row, j) => (j === i ? { ...row, kind: e.target.value as DeliverableKind } : row)))}
                    className="w-auto"
                  >
                    {DELIVERABLE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {DELIVERABLE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </Select>
                  <Input
                    aria-label="Adet"
                    inputMode="numeric"
                    value={d.quantity}
                    onChange={(e) => set('deliverables', form.deliverables.map((row, j) => (j === i ? { ...row, quantity: digits(e.target.value, 2) } : row)))}
                    className="w-[72px]"
                  />
                  <Button size="sm" variant="ghost" iconOnly aria-label="Satırı sil" onClick={() => set('deliverables', form.deliverables.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {form.deliverables.length < CAMPAIGN_LIMITS.deliverables && (
                <div>
                  <Button size="sm" leftIcon={<Plus />} onClick={() => set('deliverables', [...form.deliverables, { kind: 'reel', quantity: '1' }])}>
                    Teslimat ekle
                  </Button>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Hedef" description="Öneriler bu hedefe göre sıralanır. Boş bırakılan alan fark etmez demektir." />
          <CardBody className="grid gap-5">
            <div className="grid gap-2">
              <div className="text-[12.5px] font-medium text-ink-muted">Kategoriler</div>
              <div className="flex flex-wrap gap-1.5">
                {INFLUENCER_CATEGORY_KEYS.map((key) => {
                  const on = form.categories.includes(key)
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('categories', toggle(form.categories, key))}
                      className={cn(
                        'h-[30px] rounded-full border px-3 text-[12.5px] transition-colors',
                        on ? 'border-gold/40 bg-gold/10 text-ink' : 'border-line-strong text-ink-muted hover:text-ink',
                      )}
                    >
                      {INFLUENCER_CATEGORIES[key]}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-ink-faint">Seçmezsen markanın sektörüne uyan kategoriler öne alınır.</p>
            </div>

            <div className="grid gap-2">
              <div className="text-[12.5px] font-medium text-ink-muted">Şehirler</div>
              <div className="flex flex-wrap items-center gap-1.5">
                {form.cities.map((city) => (
                  <span key={city} className="inline-flex h-[28px] items-center gap-1 rounded-full border border-line-strong bg-surface-3 pl-2.5 pr-1 text-[12.5px] text-ink">
                    {city}
                    <button type="button" aria-label={`${city} kaldır`} onClick={() => set('cities', form.cities.filter((c) => c !== city))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-surface-2">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {form.cities.length < CAMPAIGN_LIMITS.cities && (
                  <Select aria-label="Şehir ekle" value="" onChange={(e) => e.target.value && set('cities', [...form.cities, e.target.value])} className="h-[30px] w-auto text-[12.5px]">
                    <option value="">Şehir ekle…</option>
                    {TURKISH_CITIES.filter((c) => !form.cities.includes(c)).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <div className="text-[12.5px] font-medium text-ink-muted">Platformlar</div>
                <div className="flex gap-1.5">
                  {CAMPAIGN_PLATFORMS.map((p) => {
                    const on = form.platforms.includes(p)
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set('platforms', toggle(form.platforms, p))}
                        className={cn(
                          'h-[34px] rounded-lg border px-3 text-[12.5px] transition-colors',
                          on ? 'border-gold/40 bg-gold/10 text-ink' : 'border-line-strong text-ink-muted hover:text-ink',
                        )}
                      >
                        {CAMPAIGN_PLATFORM_LABELS[p]}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="grid gap-2">
                <div className="text-[12.5px] font-medium text-ink-muted">Üretici türü</div>
                <Segmented
                  label="Üretici türü"
                  value={form.creatorType}
                  onSelect={(v) => set('creatorType', v as FormState['creatorType'])}
                  items={[
                    { value: 'all', label: 'Fark etmez' },
                    { value: 'influencer', label: 'Influencer' },
                    { value: 'ugc', label: 'UGC' },
                  ]}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-[12.5px] font-medium text-ink-muted">Takipçi aralığı</div>
              <div className="flex items-center gap-2">
                <Input aria-label="En az takipçi" inputMode="numeric" placeholder="En az" value={form.minFollowers} onChange={(e) => set('minFollowers', digits(e.target.value, 10))} className="w-[140px]" />
                <span className="text-ink-faint">–</span>
                <Input aria-label="En çok takipçi" inputMode="numeric" placeholder="En çok" value={form.maxFollowers} onChange={(e) => set('maxFollowers', digits(e.target.value, 10))} className="w-[140px]" />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {error && (
        <Notice tone="danger" className="mt-4">
          {error}
        </Notice>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {step === 1 && !editing ? (
          <Button leftIcon={<ArrowLeft />} onClick={() => setStep(0)} disabled={pending}>
            Brief
          </Button>
        ) : (
          <span />
        )}
        {step === 0 && !editing ? (
          <Button variant="primary" rightIcon={<ArrowRight />} disabled={!form.name.trim()} onClick={() => setStep(1)}>
            Hedef
          </Button>
        ) : (
          <Button variant="primary" loading={pending} disabled={!form.name.trim()} onClick={submit} rightIcon={editing ? undefined : <ArrowRight />}>
            {editing ? 'Kaydet' : 'Kaydet ve profilleri seç'}
          </Button>
        )}
      </div>
    </div>
  )
}
