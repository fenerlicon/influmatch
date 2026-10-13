'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart3, Lock, Megaphone, Pause, Pencil, Play, Plus, Trash2, XCircle } from 'lucide-react'
import { deleteAdvert, updateAdvertStatus, type AdvertStatus } from '@/app/dashboard/brand/advert/actions'
import AdvertPerformanceChart from '@/components/dashboard/AdvertPerformanceChart'
import { Button, Card, Chip, ConfirmDialog, EmptyState, Notice, PageHeader, Tabs } from '@/components/ui'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { ADVERT_STATUS, formatAdvertBudget, formatDay, type AdvertApplication, type AdvertProject } from '@/lib/adverts-shared'
import { cn } from '@/utils/cn'
import AdvertBrowser from './AdvertBrowser'
import AdvertForm from './AdvertForm'
import ApplicationsPanel from './ApplicationsPanel'

interface Props {
  myProjects: AdvertProject[]
  communityProjects: AdvertProject[]
  applications: AdvertApplication[]
  currentUserId: string
  verificationStatus: 'pending' | 'verified' | 'rejected'
  hasSpotlight: boolean
}

type TabKey = 'mine' | 'community'

/** Marka İlanlar sayfası: ilanlarım + seçili ilanın başvuruları; diğer markaların ilanları ayrı sekmede. */
export default function BrandAdverts({ myProjects, communityProjects, applications, currentUserId, verificationStatus, hasSpotlight }: Props) {
  const router = useRouter()
  const params = useSearchParams()
  const verified = verificationStatus === 'verified'
  const [tab, setTab] = useState<TabKey>(params.get('tab') === 'community' ? 'community' : 'mine')
  const [form, setForm] = useState<{ project: AdvertProject | null } | null>(verified && params.get('new') === '1' ? { project: null } : null)
  const [deleting, setDeleting] = useState<AdvertProject | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [isPending, startTransition] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)

  const sorted = useMemo(() => {
    const rank: Record<string, number> = { open: 0, paused: 1, closed: 2 }
    return [...myProjects].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [myProjects])

  const byAdvert = useMemo(() => {
    const map = new Map<string, AdvertApplication[]>()
    applications.forEach((a) => map.set(a.advert_id, [...(map.get(a.advert_id) ?? []), a]))
    return map
  }, [applications])

  // Bildirimden (?tab=applications) gelindiyse en çok yeni başvurusu olan ilan seçilir.
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (params.get('tab') === 'applications') {
      const best = [...sorted].sort(
        (a, b) => (byAdvert.get(b.id) ?? []).filter((x) => x.status === 'pending').length - (byAdvert.get(a.id) ?? []).filter((x) => x.status === 'pending').length,
      )[0]
      if (best) return best.id
    }
    return sorted[0]?.id ?? null
  })
  const selected = sorted.find((p) => p.id === selectedId) ?? sorted[0] ?? null

  useEffect(() => {
    if (params.get('tab') === 'applications') panelRef.current?.scrollIntoView({ block: 'start' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Yeni başvuru gelince sunucudan yeniden okunur (RLS yalnızca kendi ilanlarının başvurularını gönderir).
  const myIds = myProjects.map((p) => p.id).join(',')
  useEffect(() => {
    if (!myIds) return
    const supabase = createSupabaseBrowserClient()
    const ids = myIds.split(',')
    const channel = supabase
      .channel(`brand-advert-applications-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'advert_applications',
          // Realtime `in` filtresi en fazla 100 değer alır; daha fazlasında aşağıdaki kontrol yeterli.
          ...(ids.length <= 100 ? { filter: `advert_id=in.(${myIds})` } : {}),
        },
        (payload) => {
          if (ids.includes((payload.new as { advert_id?: string }).advert_id ?? '')) router.refresh()
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [myIds, currentUserId, router])

  const selectTab = (value: string) => {
    const next = value === 'community' ? 'community' : 'mine'
    setTab(next)
    const url = new URL(window.location.href)
    url.searchParams.delete('new')
    if (next === 'community') url.searchParams.set('tab', 'community')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url)
  }

  const changeStatus = (project: AdvertProject, status: AdvertStatus) => {
    startTransition(async () => {
      const result = await updateAdvertStatus(project.id, status)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      toast.success(status === 'open' ? 'İlan yeniden yayında.' : status === 'paused' ? 'İlan duraklatıldı.' : 'İlan kapatıldı.')
      router.refresh()
    })
  }

  const remove = () => {
    if (!deleting) return
    const target = deleting
    startTransition(async () => {
      const result = await deleteAdvert(target.id)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setDeleting(null)
      toast.success('İlan silindi.')
      router.refresh()
    })
  }

  const newAdvert = () => setForm({ project: null })

  return (
    <div>
      <PageHeader
        title="İlanlar"
        description="İlanını yayınla, başvuruları değerlendir; kabul ettiğin başvuru İşler'e geçer."
        actions={
          <>
            <Button
              leftIcon={hasSpotlight ? <BarChart3 /> : <Lock />}
              aria-pressed={showStats}
              onClick={() => (hasSpotlight ? setShowStats((v) => !v) : toast('İlan görüntülenme analizi Spotlight üyelerine açık.'))}
            >
              Görüntülenmeler
            </Button>
            <Button variant="primary" leftIcon={<Plus />} onClick={newAdvert} disabled={!verified}>
              Yeni ilan
            </Button>
          </>
        }
      />

      {!verified && (
        <Notice tone="warning" className="mb-4" title="Hesabın onay bekliyor.">
          Onaylanınca ilan yayınlayabilirsin.
        </Notice>
      )}

      {showStats && hasSpotlight && (
        <div className="mb-5">
          <AdvertPerformanceChart brandId={currentUserId} />
        </div>
      )}

      <Tabs
        label="İlan görünümü"
        value={tab}
        onSelect={selectTab}
        className="mb-4"
        items={[
          { value: 'mine', label: 'İlanlarım', count: myProjects.length },
          { value: 'community', label: 'Diğer markaların ilanları', count: communityProjects.filter((p) => p.brandUserId !== currentUserId).length },
        ]}
      />

      {tab === 'community' ? (
        <AdvertBrowser
          mode="brand"
          projects={communityProjects.filter((p) => p.brandUserId !== currentUserId)}
          currentUserId={currentUserId}
          empty={{ title: 'Başka açık ilan yok', description: 'Diğer markaların yayındaki ilanları burada görünür.' }}
        />
      ) : sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={Megaphone}
            title="Henüz ilanın yok"
            description="İlk ilanını yayınla; uygun influencer'lar başvursun, sen seç."
            action={
              verified ? (
                <Button variant="primary" size="sm" leftIcon={<Plus />} onClick={newAdvert}>
                  Yeni ilan
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sorted.map((p) => {
              const apps = byAdvert.get(p.id) ?? []
              const fresh = apps.filter((a) => a.status === 'pending').length
              const accepted = apps.filter((a) => a.status === 'accepted').length
              const status = ADVERT_STATUS[p.status] ?? ADVERT_STATUS.closed
              const isSel = selected?.id === p.id
              const deadline = formatDay(p.deadline)
              return (
                <Card
                  key={p.id}
                  as="article"
                  onClick={() => setSelectedId(p.id)}
                  className={cn('grid cursor-pointer content-start gap-2.5 p-4 transition-colors', isSel ? 'border-gold/40' : 'hover:border-line-strong')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Chip tone={status.tone} dot>
                      {status.label}
                    </Chip>
                    {fresh > 0 && <Chip tone="gold">{fresh} yeni başvuru</Chip>}
                  </div>
                  <button type="button" onClick={() => setSelectedId(p.id)} aria-pressed={isSel} className="text-left font-semibold text-ink hover:text-gold">
                    {p.title}
                  </button>
                  <div className="text-xs text-ink-faint">
                    {[p.deliverables.slice(0, 2).join(' + '), formatAdvertBudget(p), deadline && `Son başvuru ${deadline}`].filter(Boolean).join(' · ')}
                  </div>
                  <div className="flex gap-4 text-[12.5px] text-ink-muted">
                    <span>
                      <b className="font-semibold tabular-nums text-ink">{apps.length}</b> başvuru
                    </span>
                    <span>
                      <b className="font-semibold tabular-nums text-ink">{accepted}</b> kabul
                    </span>
                  </div>
                  <div className="-mx-1 flex flex-wrap gap-0.5 border-t border-line pt-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" leftIcon={<Pencil />} onClick={() => setForm({ project: p })} disabled={!verified}>
                      Düzenle
                    </Button>
                    {p.status === 'open' ? (
                      <Button size="sm" variant="ghost" leftIcon={<Pause />} onClick={() => changeStatus(p, 'paused')} disabled={isPending}>
                        Duraklat
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" leftIcon={<Play />} onClick={() => changeStatus(p, 'open')} disabled={isPending || !verified}>
                        Yayına al
                      </Button>
                    )}
                    {p.status !== 'closed' && (
                      <Button size="sm" variant="ghost" leftIcon={<XCircle />} onClick={() => changeStatus(p, 'closed')} disabled={isPending}>
                        Kapat
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" iconOnly aria-label="İlanı sil" title="İlanı sil" className="ml-auto hover:text-danger" onClick={() => setDeleting(p)}>
                      <Trash2 />
                    </Button>
                  </div>
                </Card>
              )
            })}
            {verified && (
              <button
                type="button"
                onClick={newAdvert}
                className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface-1 p-5 text-center text-ink-muted transition-colors hover:border-gold/40 hover:text-ink"
              >
                <div>
                  <Plus className="mx-auto h-5 w-5" aria-hidden />
                  <div className="mt-1.5 font-medium">Yeni ilan oluştur</div>
                  <div className="text-xs text-ink-faint">Teslimat, bütçe ve platform seç</div>
                </div>
              </button>
            )}
          </div>

          {selected && (
            <div ref={panelRef} className="scroll-mt-4">
              <ApplicationsPanel advertTitle={selected.title} applications={byAdvert.get(selected.id) ?? []} currentUserId={currentUserId} />
            </div>
          )}
        </>
      )}

      {form && (
        <AdvertForm
          key={form.project?.id ?? 'new'}
          open
          project={form.project}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null)
            toast.success(message)
            router.refresh()
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={isPending && !!deleting}
        tone="danger"
        title="İlan silinsin mi?"
        description={deleting ? `"${deleting.title}" ve başvuruları kalıcı olarak silinir. Yalnızca yayından kaldırmak için "Kapat"ı kullan.` : undefined}
        confirmLabel="Sil"
      />
    </div>
  )
}
