'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Megaphone, Search, Zap } from 'lucide-react'
import { trackEvent } from '@/app/actions/analytics'
import { Avatar, Card, Chip, EmptyState, Input, Modal, Select } from '@/components/ui'
import { formatAdvertBudget, relativeDay, type AdvertProject } from '@/lib/adverts-shared'
import { normalizeText } from '@/lib/advert-alerts-shared'
import { cn } from '@/utils/cn'
import AdvertDetail from './AdvertDetail'

interface Props {
  projects: AdvertProject[]
  mode: 'influencer' | 'brand'
  appliedIds?: Set<string>
  savedIds?: Set<string>
  onToggleSave?: (advertId: string, nextSaved: boolean) => void
  onApplied?: (advertId: string) => void
  currentUserId?: string
  empty: { title: string; description?: string; action?: React.ReactNode }
}

/** Geniş ekranda tek bir media sorgusu izlenir (liste + sağ panel; dar ekranda ayrıntı pencerede). */
function useWide() {
  const [wide, setWide] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setWide(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return wide
}

/** İlan listesi + ayrıntı paneli (influencer: açık ilanlar / kaydedilenler; marka: diğer markaların ilanları). */
export default function AdvertBrowser({ projects, mode, appliedIds, savedIds, onToggleSave, onApplied, currentUserId, empty }: Props) {
  const wide = useWide()
  const [query, setQuery] = useState('')
  const [platform, setPlatform] = useState('')
  const [payment, setPayment] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const platforms = useMemo(() => {
    const seen = new Map<string, string>()
    projects.forEach((p) => p.platforms.forEach((name) => seen.set(normalizeText(name), seen.get(normalizeText(name)) ?? name)))
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1], 'tr'))
  }, [projects])

  const filtered = useMemo(() => {
    const keyword = normalizeText(query)
    return projects
      .filter((p) => {
        if (platform && !p.platforms.some((name) => normalizeText(name) === platform)) return false
        if (payment && (p.paymentType ?? 'cash') !== payment) return false
        if (!keyword) return true
        const haystack = normalizeText([p.title, p.summary, p.brandName, p.category, p.location, ...p.platforms, ...p.deliverables].join(' '))
        return haystack.includes(keyword)
      })
      .sort((a, b) => {
        // Spotlight markaların ilanları önde, sonra en yeni.
        if (!!a.brandIsSpotlight !== !!b.brandIsSpotlight) return a.brandIsSpotlight ? -1 : 1
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      })
  }, [projects, query, platform, payment])

  const selected = filtered.find((p) => p.id === selectedId) ?? (wide ? filtered[0] : undefined) ?? null

  // İlan görüntülenmesi markanın ilan analizine yazılır (yalnızca influencer görüntülemesi).
  const selectedKey = selected?.id
  useEffect(() => {
    if (mode !== 'influencer' || !selected?.brandUserId) return
    if (!wide && !modalOpen) return
    trackEvent('view_advert', selected.id, selected.brandUserId).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, mode, wide, modalOpen])

  const open = (id: string) => {
    setSelectedId(id)
    if (!wide) setModalOpen(true)
  }

  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState icon={Megaphone} title={empty.title} description={empty.description} action={empty.action} />
      </Card>
    )
  }

  const detail = selected && (
    <AdvertDetail
      key={selected.id}
      project={selected}
      mode={mode}
      applied={appliedIds?.has(selected.id)}
      saved={savedIds?.has(selected.id)}
      onToggleSave={onToggleSave ? () => onToggleSave(selected.id, !savedIds?.has(selected.id)) : undefined}
      onApplied={() => onApplied?.(selected.id)}
      isOwn={mode === 'brand' && !!currentUserId && selected.brandUserId === currentUserId}
    />
  )

  return (
    <div>
      <div className="my-4 flex flex-wrap gap-2">
        <label className="relative min-w-[200px] flex-[1_1_240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="İlan, marka veya kelime ara" aria-label="İlan ara" className="pl-9" />
        </label>
        {platforms.length > 0 && (
          <Select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform" className="w-auto">
            <option value="">Tüm platformlar</option>
            {platforms.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </Select>
        )}
        <Select value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Ödeme türü" className="w-auto">
          <option value="">Nakit ve barter</option>
          <option value="cash">Nakit</option>
          <option value="barter">Barter</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={Search} title="Eşleşen ilan yok" description="Aramayı ya da filtreleri değiştirip tekrar dene." />
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
          <Card as="section" className="overflow-hidden">
            {filtered.map((p) => {
              const isSel = wide && selected?.id === p.id
              const applied = appliedIds?.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => open(p.id)}
                  aria-current={isSel || undefined}
                  className={cn(
                    'grid w-full grid-cols-[auto_1fr] items-start gap-3.5 border-b border-line px-5 py-4 text-left transition-colors last:border-b-0 sm:grid-cols-[auto_1fr_auto]',
                    isSel ? 'bg-surface-2 shadow-[inset_2px_0_0_theme(colors.gold.DEFAULT)]' : 'hover:bg-white/[0.015]',
                  )}
                >
                  <Avatar name={p.brandName} src={p.brandAvatar} square />
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{p.title}</div>
                    <div className="truncate text-xs text-ink-faint">
                      {p.brandName} · {p.category} · {relativeDay(p.createdAt)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.brandIsSpotlight && (
                        <Chip tone="gold">
                          <Zap />
                          Öne çıkan
                        </Chip>
                      )}
                      {p.deliverables.slice(0, 2).map((d) => (
                        <Chip key={d}>{d}</Chip>
                      ))}
                      {p.platforms.slice(0, 2).map((name) => (
                        <Chip key={name}>{name}</Chip>
                      ))}
                      {applied && (
                        <Chip tone="success">
                          <Check />
                          Başvurdun
                        </Chip>
                      )}
                      {mode === 'brand' && currentUserId && p.brandUserId === currentUserId && <Chip tone="gold">Senin ilanın</Chip>}
                    </div>
                  </div>
                  <div className="col-start-2 sm:col-start-auto sm:text-right">
                    <b className="block font-semibold tabular-nums text-ink">{formatAdvertBudget(p)}</b>
                  </div>
                </button>
              )
            })}
          </Card>

          {wide && selected && (
            <Card as="section" className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto lg:block">
              {detail}
            </Card>
          )}
        </div>
      )}

      {!wide && selected && (
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="İlan ayrıntısı" size="lg" className="[&_[data-modal-body]]:p-0">
          {detail}
        </Modal>
      )}
    </div>
  )
}
