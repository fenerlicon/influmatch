'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ExternalLink, FileText, Megaphone, RefreshCw, Trash2 } from 'lucide-react'
import { deleteAdvertAdmin, getAllAdverts, getAllApplications } from '@/app/admin/actions'
import { APPLICATION_STATUS, type ApplicationStatus } from '@/lib/adverts-shared'
import { Avatar, Button, buttonClasses, Card, Chip, ConfirmDialog, EmptyState, PageHeader, Tabs } from '@/components/ui'

interface AdminAdvert {
  id: string
  title: string
  summary: string | null
  status: 'open' | 'paused' | 'closed'
  created_at: string
  brand?: { full_name: string | null; email: string | null; avatar_url: string | null; username: string | null } | null
}

interface AdminApplication {
  id: string
  status: ApplicationStatus | string
  created_at: string
  cover_letter: string | null
  advert_id: string
  influencer_id: string
  influencer?: { id: string; full_name: string | null; email: string | null; username: string | null } | null
  advert?: { id: string; title: string | null } | null
}

const ADVERT_STATUS = {
  open: { label: 'Açık', tone: 'success' },
  paused: { label: 'Durduruldu', tone: 'warning' },
  closed: { label: 'Kapalı', tone: 'neutral' },
} as const

const formatDate = (value: string) => new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })

/** Platformdaki bütün ilanlar ve başvurular (admin). Veri sunucu eylemleriyle istemcide yüklenir. */
export default function AdvertsAdminPanel() {
  const [tab, setTab] = useState<'adverts' | 'applications'>('adverts')
  const [adverts, setAdverts] = useState<AdminAdvert[] | null>(null)
  const [applications, setApplications] = useState<AdminApplication[] | null>(null)
  const [toDelete, setToDelete] = useState<AdminAdvert | null>(null)
  const [isPending, startTransition] = useTransition()

  const load = useCallback((which: 'adverts' | 'applications') => {
    startTransition(async () => {
      try {
        if (which === 'adverts') {
          const result = await getAllAdverts()
          if (result.error) toast.error(result.error)
          else setAdverts((result.adverts ?? []) as AdminAdvert[])
        } else {
          const result = await getAllApplications()
          if (result.error) toast.error(result.error)
          else setApplications((result.applications ?? []) as AdminApplication[])
        }
      } catch (error) {
        console.error('[AdvertsAdminPanel]', error)
        toast.error('Liste yüklenemedi.')
      }
    })
  }, [])

  useEffect(() => {
    if (tab === 'adverts' && adverts === null) load('adverts')
    if (tab === 'applications' && applications === null) load('applications')
  }, [tab, adverts, applications, load])

  const remove = () => {
    if (!toDelete) return
    const id = toDelete.id
    startTransition(async () => {
      const result = await deleteAdvertAdmin(id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(result.message || 'İlan silindi.')
      setAdverts((prev) => prev?.filter((a) => a.id !== id) ?? prev)
      setToDelete(null)
    })
  }

  const list = tab === 'adverts' ? adverts : applications

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="İlanlar"
        description="Platformdaki bütün ilanlar ve başvurular."
        actions={
          <Button size="sm" onClick={() => load(tab)} loading={isPending && !toDelete} leftIcon={<RefreshCw />}>
            Yenile
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        label="İlan görünümü"
        value={tab}
        onSelect={(v) => setTab(v as 'adverts' | 'applications')}
        items={[
          { value: 'adverts', label: 'İlanlar', count: adverts?.length },
          { value: 'applications', label: 'Başvurular', count: applications?.length },
        ]}
      />

      {list === null ? (
        <Card>
          <EmptyState title="Yükleniyor…" />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={tab === 'adverts' ? Megaphone : FileText} title={tab === 'adverts' ? 'İlan yok' : 'Başvuru yok'} />
        </Card>
      ) : tab === 'adverts' ? (
        <Card className="overflow-hidden">
          {(adverts ?? []).map((advert) => {
            const status = ADVERT_STATUS[advert.status] ?? ADVERT_STATUS.closed
            const brandName = advert.brand?.full_name || 'Marka adı yok'
            return (
              <div key={advert.id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0">
                <Avatar name={brandName} src={advert.brand?.avatar_url ?? undefined} size="sm" square />
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{advert.title}</span>
                    <Chip tone={status.tone} dot>{status.label}</Chip>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[12.5px] text-ink-muted">{advert.summary}</p>
                  <p className="mt-0.5 text-xs text-ink-faint">
                    {brandName}
                    {advert.brand?.username ? ` (@${advert.brand.username})` : ''} · {formatDate(advert.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a href={`/discover/advert/${advert.id}`} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: 'sm' })}>
                    <ExternalLink aria-hidden /> Görüntüle
                  </a>
                  <Button size="sm" variant="danger" onClick={() => setToDelete(advert)} leftIcon={<Trash2 />}>
                    Sil
                  </Button>
                </div>
              </div>
            )
          })}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {(applications ?? []).map((app) => {
            const status = APPLICATION_STATUS[app.status as ApplicationStatus]
            const name = app.influencer?.full_name || 'Bilinmeyen influencer'
            return (
              <div key={app.id} className="grid gap-2 border-b border-line px-5 py-3.5 last:border-b-0">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={name} size="sm" />
                  <div className="min-w-[200px] flex-1">
                    <div className="font-medium text-ink">
                      {name} {app.influencer?.username && <span className="font-normal text-ink-faint">@{app.influencer.username}</span>}
                    </div>
                    <div className="text-xs text-ink-muted">İlan: {app.advert?.title || 'İlan silinmiş'}</div>
                  </div>
                  <Chip tone={status?.tone ?? 'neutral'} dot>{status?.label ?? app.status}</Chip>
                  <span className="text-xs text-ink-faint">{new Date(app.created_at).toLocaleString('tr-TR')}</span>
                </div>
                {app.cover_letter && <p className="whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-ink-muted">{app.cover_letter}</p>}
                <p className="font-mono text-[11px] text-ink-faint">
                  İlan {app.advert_id} · Influencer {app.influencer_id}
                </p>
              </div>
            )
          })}
        </Card>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        loading={isPending && !!toDelete}
        tone="danger"
        title="İlan kalıcı olarak silinsin mi?"
        description={toDelete ? `"${toDelete.title}" ve başvuruları silinir. Bu işlem geri alınamaz.` : undefined}
        confirmLabel="Sil"
      />
    </div>
  )
}
