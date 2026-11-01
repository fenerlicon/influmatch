'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, ImagePlus, Layers, Lightbulb, List, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, CardHeader, Chip, ConfirmDialog, EmptyState, Field, Input, ListRow, Modal, PageHeader, Progress, Select, StatCard, Tabs, Textarea } from '@/components/ui'
import { createCoverUpload, removeItem, removeSeries, saveItem, saveSeries } from '@/app/toplanti/actions'
import { cn } from '@/utils/cn'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import {
  CONTENT_COVER_BUCKET,
  CONTENT_COVER_MAX_BYTES,
  CONTENT_COVER_TYPES,
  CONTENT_STATUSES,
  STATUS_META,
  addDays,
  compareByPublish,
  formatDate,
  formatMonth,
  monthGrid,
  shiftMonth,
  todayIstanbul,
  type ContentItem,
  type ContentPlanResult,
  type ContentSeries,
  type ContentStatus,
} from '@/lib/content-plan-shared'

type View = 'calendar' | 'list' | 'series' | 'ideas'
type ItemDraft = Partial<ContentItem>

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const CAPTION_LIMIT = 2200

const timeLabel = (time: string | null) => (time ? time.slice(0, 5) : null)

function publishLabel(item: ContentItem): string {
  if (!item.publish_date) return 'Tarih yok'
  const time = timeLabel(item.publish_time)
  return `${formatDate(item.publish_date, true)}${time ? ` · ${time}` : ''}`
}

const itemLabel = (item: ContentItem) => `${item.episode_no ? `${item.episode_no}. ` : ''}${item.title}`

/** Instagram'daki videoya giden bağlantı; satırın kendi tıklamasını tetiklemez. */
function VideoLink({ url, compact = false, className }: { url: string; compact?: boolean; className?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Videoyu aç"
      title="Videoyu aç"
      onClick={(e) => e.stopPropagation()}
      className={cn('inline-flex items-center gap-1 text-[12.5px] font-medium text-gold hover:underline', className)}
    >
      {!compact && 'Videoyu aç'}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </a>
  )
}

/** Dikey (Reels) kapak küçük resmi; imzalı bağlantı olduğu için next/image kullanılmaz. */
function CoverThumb({ url, className }: { url: string | null; className?: string }) {
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={cn('aspect-[9/16] flex-none rounded-md border border-line object-cover', className)} />
}

function CalendarTile({ item, readOnly, onOpen }: { item: ContentItem; readOnly: boolean; onOpen: (draft: ItemDraft) => void }) {
  const label = itemLabel(item)
  const published = item.status === 'published'
  const body = item.cover_url ? (
    <span className="relative block overflow-hidden rounded-md">
      <CoverThumb url={item.cover_url} className="block w-full rounded-md" />
      <span className="absolute inset-x-0 bottom-0 hidden truncate bg-gradient-to-t from-black/85 to-transparent px-1.5 pb-1 pt-5 text-[11px] font-medium text-white sm:block">{label}</span>
      {published && <span className="absolute left-1 top-1 h-2 w-2 rounded-full bg-success ring-1 ring-black/40" aria-label="Paylaşıldı" />}
    </span>
  ) : (
    <span
      className={cn(
        'block h-1.5 truncate rounded border sm:h-auto sm:px-1.5 sm:py-1 sm:text-[11.5px]',
        published ? 'border-transparent bg-success sm:bg-success/10 sm:text-success' : 'border-line bg-gold sm:bg-surface-3 sm:text-ink',
      )}
    >
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
  const shared = { title: label, 'aria-label': label, className: 'block w-full text-left transition-opacity hover:opacity-85' }

  // Takipte tıklama doğrudan Instagram'a gider; sahibi düzenlemeyi açar, video için köşede ayrı bağlantı olur.
  if (readOnly && item.video_url) {
    return (
      <a href={item.video_url} target="_blank" rel="noopener noreferrer" {...shared}>
        {body}
      </a>
    )
  }
  return (
    <div className="relative">
      <button type="button" onClick={() => onOpen(item)} {...shared}>
        {body}
      </button>
      {item.video_url && item.cover_url && (
        <VideoLink url={item.video_url} compact className="absolute right-0.5 top-0.5 hidden rounded bg-black/70 p-1 text-white hover:no-underline sm:inline-flex" />
      )}
    </div>
  )
}

function StatusChip({ status }: { status: ContentStatus }) {
  const meta = STATUS_META[status]
  return <Chip tone={meta.tone}>{meta.label}</Chip>
}

/** Plan ekranı. Damla Dalay /toplanti'da düzenler; admin aynı ekranı salt okunur görür (/admin/icerik-plani). */
export default function ContentPlanBoard({ series, items, readOnly = false }: { series: ContentSeries[]; items: ContentItem[]; readOnly?: boolean }) {
  const today = todayIstanbul()
  const [view, setView] = useState<View>('calendar')
  const [month, setMonth] = useState(today.slice(0, 7))
  const [statusFilter, setStatusFilter] = useState('all')
  const [seriesFilter, setSeriesFilter] = useState('all')
  const [openSeriesId, setOpenSeriesId] = useState<string | null>(null)
  const [itemDraft, setItemDraft] = useState<ItemDraft | null>(null)
  const [seriesDraft, setSeriesDraft] = useState<Partial<ContentSeries> | null>(null)
  const [deleting, setDeleting] = useState<{ kind: 'item' | 'series'; id: string; title: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const seriesById = useMemo(() => new Map(series.map((s) => [s.id, s])), [series])
  const ideas = useMemo(() => items.filter((i) => i.status === 'idea' && !i.series_id).sort((a, b) => b.created_at.localeCompare(a.created_at)), [items])
  const planned = useMemo(() => items.filter((i) => !(i.status === 'idea' && !i.series_id)).sort(compareByPublish), [items])
  const stats = useMemo(() => {
    const weekEnd = addDays(today, 7)
    return {
      thisWeek: items.filter((i) => i.status !== 'published' && i.publish_date && i.publish_date >= today && i.publish_date < weekEnd).length,
      late: items.filter((i) => i.status !== 'published' && i.status !== 'idea' && i.publish_date && i.publish_date < today).length,
      inProduction: items.filter((i) => i.status === 'shooting' || i.status === 'editing').length,
      published: items.filter((i) => i.status === 'published').length,
    }
  }, [items, today])

  const run = (action: () => Promise<ContentPlanResult>, onDone?: () => void) => {
    startTransition(async () => {
      try {
        const result = await action()
        if (result.success) {
          if (result.message) toast.success(result.message)
          onDone?.()
          router.refresh()
        } else {
          toast.error(result.error)
        }
      } catch {
        toast.error('İşlem tamamlanamadı. Tekrar deneyin.')
      }
    })
  }

  const openSeries = openSeriesId ? seriesById.get(openSeriesId) ?? null : null

  return (
    <div>
      <PageHeader
        title={readOnly ? 'İçerik Planı' : 'Toplantı'}
        description={readOnly ? 'Damla Dalay’ın Instagram Reels planı. Bu ekran yalnızca takip içindir.' : 'Instagram Reels takvimin, serilerin ve fikirlerin.'}
        actions={
          !readOnly && (
            <>
              <Button leftIcon={<Layers />} onClick={() => setSeriesDraft({})}>
                Yeni seri
              </Button>
              <Button variant="primary" leftIcon={<Plus />} onClick={() => setItemDraft({ status: 'planned' })}>
                Yeni içerik
              </Button>
            </>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Bu 7 gün" value={stats.thisWeek} detail="Paylaşılacak içerik" />
        <StatCard label="Geciken" value={stats.late} detail="Tarihi geçti, paylaşılmadı" />
        <StatCard label="Yapımda" value={stats.inProduction} detail="Çekimde ya da kurguda" />
        <StatCard label="Paylaşılan" value={stats.published} detail="Toplam" />
      </div>

      <Tabs
        label="Plan görünümü"
        className="mb-5"
        value={view}
        onSelect={(value) => setView(value as View)}
        items={[
          { value: 'calendar', label: 'Takvim', icon: <CalendarDays /> },
          { value: 'list', label: 'Liste', icon: <List />, count: planned.length },
          { value: 'series', label: 'Seriler', icon: <Layers />, count: series.length },
          { value: 'ideas', label: 'Fikirler', icon: <Lightbulb />, count: ideas.length },
        ]}
      />

      {view === 'calendar' && (
        <CalendarView
          month={month}
          today={today}
          items={planned}
          seriesById={seriesById}
          readOnly={readOnly}
          onMonth={setMonth}
          onOpen={setItemDraft}
        />
      )}
      {view === 'list' && (
        <ListView
          items={planned}
          series={series}
          seriesById={seriesById}
          statusFilter={statusFilter}
          seriesFilter={seriesFilter}
          onStatusFilter={setStatusFilter}
          onSeriesFilter={setSeriesFilter}
          onOpen={setItemDraft}
        />
      )}
      {view === 'series' &&
        (openSeries ? (
          <SeriesDetail
            series={openSeries}
            items={items.filter((i) => i.series_id === openSeries.id)}
            readOnly={readOnly}
            onBack={() => setOpenSeriesId(null)}
            onOpen={setItemDraft}
            onEdit={() => setSeriesDraft(openSeries)}
            onDelete={() => setDeleting({ kind: 'series', id: openSeries.id, title: openSeries.title })}
          />
        ) : (
          <SeriesGrid series={series} items={items} readOnly={readOnly} onOpen={setOpenSeriesId} onCreate={() => setSeriesDraft({})} />
        ))}
      {view === 'ideas' && <IdeasView ideas={ideas} readOnly={readOnly} pending={pending} run={run} onOpen={setItemDraft} />}

      {itemDraft && (
        <ItemModal
          key={itemDraft.id ?? 'new'}
          draft={itemDraft}
          series={series}
          readOnly={readOnly}
          pending={pending}
          onClose={() => setItemDraft(null)}
          onSave={(id, input) => run(() => saveItem(id, input), () => setItemDraft(null))}
          onDelete={(item) => {
            setItemDraft(null)
            setDeleting({ kind: 'item', id: item.id, title: item.title })
          }}
        />
      )}
      {seriesDraft && (
        <SeriesModal
          key={seriesDraft.id ?? 'new'}
          draft={seriesDraft}
          pending={pending}
          onClose={() => setSeriesDraft(null)}
          onSave={(id, input, titles, interval) => run(() => saveSeries(id, input, titles, interval), () => setSeriesDraft(null))}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        tone="danger"
        loading={pending}
        title={deleting?.kind === 'series' ? 'Seri silinsin mi?' : 'İçerik silinsin mi?'}
        description={
          deleting?.kind === 'series'
            ? `"${deleting.title}" silinecek. Bölümleri silinmez, planda bağımsız içerik olarak kalır.`
            : `"${deleting?.title}" kalıcı olarak silinecek.`
        }
        confirmLabel="Sil"
        onConfirm={() => {
          if (!deleting) return
          const { kind, id } = deleting
          run(
            () => (kind === 'series' ? removeSeries(id) : removeItem(id)),
            () => {
              setDeleting(null)
              if (kind === 'series') setOpenSeriesId(null)
            },
          )
        }}
      />
    </div>
  )
}

function CalendarView({
  month,
  today,
  items,
  seriesById,
  readOnly,
  onMonth,
  onOpen,
}: {
  month: string
  today: string
  items: ContentItem[]
  seriesById: Map<string, ContentSeries>
  readOnly: boolean
  onMonth: (month: string) => void
  onOpen: (draft: ItemDraft) => void
}) {
  const days = useMemo(() => monthGrid(month), [month])
  const byDate = useMemo(() => {
    const map = new Map<string, ContentItem[]>()
    items.forEach((item) => {
      if (!item.publish_date) return
      map.set(item.publish_date, [...(map.get(item.publish_date) ?? []), item])
    })
    return map
  }, [items])
  const monthItems = items.filter((i) => i.publish_date?.startsWith(month))
  const undated = items.filter((i) => !i.publish_date)

  return (
    <div className="grid gap-5">
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold capitalize text-ink">{formatMonth(month)}</h2>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => onMonth(today.slice(0, 7))}>
              Bugün
            </Button>
            <Button size="sm" variant="ghost" iconOnly aria-label="Önceki ay" onClick={() => onMonth(shiftMonth(month, -1))}>
              <ChevronLeft />
            </Button>
            <Button size="sm" variant="ghost" iconOnly aria-label="Sonraki ay" onClick={() => onMonth(shiftMonth(month, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-1 py-2 text-center text-[11px] font-medium text-ink-faint sm:px-2 sm:text-left">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dayItems = byDate.get(day) ?? []
            const inMonth = day.startsWith(month)
            const content = (
              <>
                <span className={cn('grid h-6 w-6 place-items-center rounded-full text-[12px] tabular-nums', day === today ? 'bg-gold font-semibold text-gold-ink' : inMonth ? 'text-ink-muted' : 'text-ink-faint/50')}>
                  {Number(day.slice(8))}
                </span>
              </>
            )
            return (
              <div key={day} className={cn('min-h-[58px] border-line p-1 sm:min-h-[104px] sm:p-1.5', (index + 1) % 7 !== 0 && 'border-r', index < days.length - 7 && 'border-b', !inMonth && 'bg-black/10')}>
                {readOnly ? (
                  <div className="flex flex-col items-center sm:items-start">{content}</div>
                ) : (
                  <button
                    type="button"
                    aria-label={`${formatDate(day)} için içerik ekle`}
                    onClick={() => onOpen({ status: 'planned', publish_date: day })}
                    className="flex w-full flex-col items-center rounded-md transition-colors hover:bg-surface-2 sm:items-start"
                  >
                    {content}
                  </button>
                )}
                {dayItems.length > 0 && (
                  <div className="mt-1 grid grid-cols-[minmax(0,1fr)] gap-1">
                    {dayItems.map((item) => (
                      <CalendarTile key={item.id} item={item} readOnly={readOnly} onOpen={onOpen} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card>
        <CardHeader title="Bu ayın içerikleri" description={monthItems.length ? `${monthItems.length} içerik` : undefined} />
        {monthItems.length ? (
          monthItems.map((item) => <ItemRow key={item.id} item={item} seriesTitle={item.series_id ? seriesById.get(item.series_id)?.title : undefined} onOpen={onOpen} />)
        ) : (
          <EmptyState icon={CalendarDays} title="Bu ay için içerik yok" description={readOnly ? undefined : 'Takvimde bir güne dokunarak içerik ekleyebilirsin.'} />
        )}
      </Card>

      {undated.length > 0 && (
        <Card>
          <CardHeader title="Tarihi belli olmayanlar" description={`${undated.length} içerik`} />
          {undated.map((item) => (
            <ItemRow key={item.id} item={item} seriesTitle={item.series_id ? seriesById.get(item.series_id)?.title : undefined} onOpen={onOpen} />
          ))}
        </Card>
      )}
    </div>
  )
}

function ItemRow({ item, seriesTitle, onOpen }: { item: ContentItem; seriesTitle?: string; onOpen: (draft: ItemDraft) => void }) {
  return (
    <ListRow className="cursor-pointer" onClick={() => onOpen(item)}>
      <CoverThumb url={item.cover_url} className="w-9" />
      <div className="w-[118px] flex-none text-[12.5px] tabular-nums text-ink-muted">{publishLabel(item)}</div>
      <div className="min-w-[160px] flex-1">
        <button type="button" className="block max-w-full truncate text-left text-[13.5px] font-medium text-ink">
          {item.episode_no ? `${item.episode_no}. ` : ''}
          {item.title}
        </button>
        <div className="mt-0.5 truncate text-[12px] text-ink-faint">
          {[seriesTitle, item.shoot_date ? `Çekim: ${formatDate(item.shoot_date)}` : null].filter(Boolean).join(' · ') || 'Bağımsız içerik'}
        </div>
      </div>
      {item.video_url && <VideoLink url={item.video_url} />}
      <StatusChip status={item.status} />
    </ListRow>
  )
}

function ListView({
  items,
  series,
  seriesById,
  statusFilter,
  seriesFilter,
  onStatusFilter,
  onSeriesFilter,
  onOpen,
}: {
  items: ContentItem[]
  series: ContentSeries[]
  seriesById: Map<string, ContentSeries>
  statusFilter: string
  seriesFilter: string
  onStatusFilter: (value: string) => void
  onSeriesFilter: (value: string) => void
  onOpen: (draft: ItemDraft) => void
}) {
  const filtered = items.filter(
    (item) =>
      (statusFilter === 'all' || item.status === statusFilter) &&
      (seriesFilter === 'all' || (seriesFilter === 'none' ? !item.series_id : item.series_id === seriesFilter)),
  )
  return (
    <Card>
      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
        <Select aria-label="Duruma göre süz" className="w-auto min-w-[150px]" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}>
          <option value="all">Tüm durumlar</option>
          {CONTENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_META[status].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Seriye göre süz" className="w-auto min-w-[170px] max-w-full" value={seriesFilter} onChange={(e) => onSeriesFilter(e.target.value)}>
          <option value="all">Tüm içerikler</option>
          <option value="none">Serisi olmayanlar</option>
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </Select>
      </div>
      {filtered.length ? (
        filtered.map((item) => <ItemRow key={item.id} item={item} seriesTitle={item.series_id ? seriesById.get(item.series_id)?.title : undefined} onOpen={onOpen} />)
      ) : (
        <EmptyState icon={List} title="Bu süzgece uyan içerik yok" />
      )}
    </Card>
  )
}

function SeriesGrid({
  series,
  items,
  readOnly,
  onOpen,
  onCreate,
}: {
  series: ContentSeries[]
  items: ContentItem[]
  readOnly: boolean
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  if (!series.length) {
    return (
      <Card>
        <EmptyState
          icon={Layers}
          title="Henüz seri yok"
          description={readOnly ? undefined : 'Örneğin "27 günde 27 şeyi değiştiriyorum": bölümleri tek seferde açabilirsin.'}
          action={!readOnly ? <Button onClick={onCreate}>Seri oluştur</Button> : undefined}
        />
      </Card>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {series.map((s) => {
        const episodes = items.filter((i) => i.series_id === s.id)
        const published = episodes.filter((i) => i.status === 'published').length
        const total = Math.max(s.planned_count ?? 0, episodes.length)
        const next = episodes.filter((i) => i.status !== 'published' && i.publish_date).sort(compareByPublish)[0]
        return (
          <button key={s.id} type="button" onClick={() => onOpen(s.id)} className="rounded-2xl border border-line bg-surface-1 p-5 text-left transition-colors hover:border-gold/30">
            <div className="text-[15px] font-semibold text-ink">{s.title}</div>
            {s.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-muted">{s.description}</p>}
            <div className="mt-4 flex items-center justify-between text-[12px] tabular-nums text-ink-faint">
              <span>
                {published} / {total} paylaşıldı
              </span>
              <span>{next ? `Sıradaki: ${formatDate(next.publish_date as string)}` : ''}</span>
            </div>
            <Progress value={total ? (published / total) * 100 : 0} className="mt-2" label={`${s.title} ilerlemesi`} />
          </button>
        )
      })}
    </div>
  )
}

function SeriesDetail({
  series,
  items,
  readOnly,
  onBack,
  onOpen,
  onEdit,
  onDelete,
}: {
  series: ContentSeries
  items: ContentItem[]
  readOnly: boolean
  onBack: () => void
  onOpen: (draft: ItemDraft) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const episodes = [...items].sort((a, b) => (a.episode_no ?? 9999) - (b.episode_no ?? 9999) || compareByPublish(a, b))
  const published = episodes.filter((i) => i.status === 'published').length
  const total = Math.max(series.planned_count ?? 0, episodes.length)
  const nextNo = episodes.reduce((max, item) => Math.max(max, item.episode_no ?? 0), 0) + 1
  return (
    <div className="grid gap-4">
      <div>
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft />} onClick={onBack}>
          Seriler
        </Button>
      </div>
      <Card>
        <CardHeader
          title={series.title}
          description={series.description ?? undefined}
          action={
            !readOnly && (
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="ghost" iconOnly aria-label="Seriyi düzenle" onClick={onEdit}>
                  <Pencil />
                </Button>
                <Button size="sm" variant="ghost" iconOnly aria-label="Seriyi sil" onClick={onDelete}>
                  <Trash2 />
                </Button>
                <Button size="sm" variant="primary" leftIcon={<Plus />} onClick={() => onOpen({ series_id: series.id, episode_no: nextNo, status: 'planned' })}>
                  Bölüm ekle
                </Button>
              </div>
            )
          }
        />
        <div className="border-b border-line px-5 py-3">
          <div className="mb-2 text-[12px] tabular-nums text-ink-faint">
            {published} / {total} paylaşıldı
          </div>
          <Progress value={total ? (published / total) * 100 : 0} label="Seri ilerlemesi" />
        </div>
        {episodes.length ? (
          episodes.map((item) => (
            <ListRow key={item.id} className="cursor-pointer" onClick={() => onOpen(item)}>
              <div className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface-3 text-[12.5px] font-semibold tabular-nums text-ink-muted">{item.episode_no ?? '–'}</div>
              <CoverThumb url={item.cover_url} className="w-9" />
              <div className="min-w-[160px] flex-1">
                <button type="button" className="block max-w-full truncate text-left text-[13.5px] font-medium text-ink">
                  {item.title}
                </button>
                <div className="mt-0.5 truncate text-[12px] text-ink-faint">
                  {publishLabel(item)}
                  {item.shoot_date ? ` · Çekim: ${formatDate(item.shoot_date)}` : ''}
                </div>
              </div>
              {item.video_url && <VideoLink url={item.video_url} />}
              <StatusChip status={item.status} />
            </ListRow>
          ))
        ) : (
          <EmptyState icon={Clapperboard} title="Bu seride henüz bölüm yok" />
        )}
      </Card>
    </div>
  )
}

function IdeasView({
  ideas,
  readOnly,
  pending,
  run,
  onOpen,
}: {
  ideas: ContentItem[]
  readOnly: boolean
  pending: boolean
  run: (action: () => Promise<ContentPlanResult>, onDone?: () => void) => void
  onOpen: (draft: ItemDraft) => void
}) {
  const [title, setTitle] = useState('')
  return (
    <div className="grid gap-4">
      {!readOnly && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const value = title.trim()
            if (value) run(() => saveItem(null, { title: value, status: 'idea' }), () => setTitle(''))
          }}
        >
          <Input aria-label="Yeni fikir" placeholder="Aklına gelen fikri yaz…" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button type="submit" variant="primary" disabled={!title.trim()} loading={pending}>
            Ekle
          </Button>
        </form>
      )}
      {ideas.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea) => (
            <button key={idea.id} type="button" onClick={() => onOpen(idea)} className="rounded-2xl border border-line bg-surface-1 p-4 text-left transition-colors hover:border-gold/30">
              <div className="text-[13.5px] font-medium text-ink">{idea.title}</div>
              {(idea.notes || idea.script) && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[12.5px] text-ink-muted">{idea.notes || idea.script}</p>}
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Lightbulb} title="Henüz fikir yok" description={readOnly ? undefined : 'Fikri kaydet; hazır olunca açıp tarih ver, takvime geçsin.'} />
        </Card>
      )}
    </div>
  )
}

function ItemModal({
  draft,
  series,
  readOnly,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  draft: ItemDraft
  series: ContentSeries[]
  readOnly: boolean
  pending: boolean
  onClose: () => void
  onSave: (id: string | null, input: Record<string, unknown>) => void
  onDelete: (item: ContentItem) => void
}) {
  const [form, setForm] = useState({
    title: draft.title ?? '',
    series_id: draft.series_id ?? '',
    episode_no: draft.episode_no ? String(draft.episode_no) : '',
    status: draft.status ?? 'planned',
    publish_date: draft.publish_date ?? '',
    publish_time: timeLabel(draft.publish_time ?? null) ?? '',
    shoot_date: draft.shoot_date ?? '',
    script: draft.script ?? '',
    caption: draft.caption ?? '',
    notes: draft.notes ?? '',
    video_url: draft.video_url ?? '',
  })
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((prev) => ({ ...prev, [key]: e.target.value }))
  // Fikre tarih verilince takvime geçsin; kullanıcı durumu elle değiştirdiyse dokunulmaz.
  const setPublishDate = (e: { target: { value: string } }) =>
    setForm((prev) => ({ ...prev, publish_date: e.target.value, status: e.target.value && prev.status === 'idea' ? 'planned' : prev.status }))
  const existing = draft.id ? (draft as ContentItem) : null

  // Kapak kaydederken yüklenir; vazgeçilirse depoda sahipsiz dosya kalmaz.
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(draft.cover_url ?? null)
  const [coverRemoved, setCoverRemoved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = pending || uploading

  useEffect(() => {
    if (!coverFile) return
    const url = URL.createObjectURL(coverFile)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverFile])

  const pickCover = (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (!CONTENT_COVER_TYPES[file.type]) return void toast.error('Kapak JPG, PNG ya da WEBP olmalı.')
    if (file.size > CONTENT_COVER_MAX_BYTES) return void toast.error('Kapak en fazla 5 MB olabilir.')
    setCoverRemoved(false)
    setCoverFile(file)
  }

  const submit = async () => {
    if (!form.title.trim()) return
    let cover_path: string | null = coverRemoved ? null : draft.cover_path ?? null
    if (coverFile) {
      setUploading(true)
      try {
        const upload = await createCoverUpload(coverFile.type)
        if (!upload.success) return void toast.error(upload.error)
        const { error } = await createSupabaseBrowserClient()
          .storage.from(CONTENT_COVER_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, coverFile, { contentType: coverFile.type })
        if (error) return void toast.error('Kapak yüklenemedi. Tekrar deneyin.')
        cover_path = upload.path
      } catch {
        return void toast.error('Kapak yüklenemedi. Tekrar deneyin.')
      } finally {
        setUploading(false)
      }
    }
    onSave(existing?.id ?? null, { ...form, cover_path })
  }

  if (readOnly) return <ItemDetails item={draft as ContentItem} series={series} onClose={onClose} />

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      dismissible={!busy}
      title={existing ? 'İçeriği düzenle' : 'Yeni içerik'}
      footer={
        <>
          {existing && (
            <Button variant="danger" size="sm" className="mr-auto" disabled={busy} onClick={() => onDelete(existing)}>
              Sil
            </Button>
          )}
          <Button variant="ghost" size="sm" disabled={busy} onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" type="submit" form="content-item-form" loading={busy} disabled={!form.title.trim()}>
            Kaydet
          </Button>
        </>
      }
    >
      <form
        id="content-item-form"
        className="grid gap-4 sm:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="flex items-center gap-4 sm:col-span-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={coverPreview ? 'Kapağı değiştir' : 'Kapak yükle'}
            className="grid aspect-[9/16] w-24 flex-none place-items-center overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface-2 text-ink-faint transition-colors hover:border-gold/40"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="h-5 w-5" aria-hidden />
            )}
          </button>
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium text-ink-muted">Kapak</div>
            <p className="mt-0.5 text-xs text-ink-faint">Dikey görsel; JPG, PNG ya da WEBP, en fazla 5 MB. Takvimde görünür.</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => fileRef.current?.click()}>
                {coverPreview ? 'Değiştir' : 'Kapak yükle'}
              </Button>
              {coverPreview && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCoverFile(null)
                    setCoverPreview(null)
                    setCoverRemoved(true)
                  }}
                >
                  Kaldır
                </Button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept={Object.keys(CONTENT_COVER_TYPES).join(',')} className="hidden" onChange={(e) => pickCover(e.target.files?.[0])} />
        </div>
        <Field label="Başlık" className="sm:col-span-6">
          {(props) => <Input {...props} data-autofocus maxLength={160} value={form.title} onChange={set('title')} placeholder="Videonun konusu" required />}
        </Field>
        <Field label="Seri" className="sm:col-span-4">
          {(props) => (
            <Select {...props} value={form.series_id} onChange={set('series_id')}>
              <option value="">Seri yok</option>
              {series.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Bölüm no" className="sm:col-span-2">
          {(props) => <Input {...props} type="number" min={1} max={365} disabled={!form.series_id} value={form.episode_no} onChange={set('episode_no')} />}
        </Field>
        <Field label="Durum" className="sm:col-span-2">
          {(props) => (
            <Select {...props} value={form.status} onChange={set('status')}>
              {CONTENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_META[status].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Paylaşım tarihi" className="sm:col-span-2">
          {(props) => <Input {...props} type="date" value={form.publish_date} onChange={setPublishDate} />}
        </Field>
        <Field label="Saat" className="sm:col-span-2">
          {(props) => <Input {...props} type="time" value={form.publish_time} onChange={set('publish_time')} />}
        </Field>
        <Field label="Çekim tarihi" className="sm:col-span-2">
          {(props) => <Input {...props} type="date" value={form.shoot_date} onChange={set('shoot_date')} />}
        </Field>
        <Field label="Paylaşılan video linki" hint="Paylaştıktan sonra Instagram linkini yapıştır; durum Paylaşıldı olur." className="sm:col-span-4">
          {(props) => (
            <Input
              {...props}
              inputMode="url"
              maxLength={490}
              value={form.video_url}
              onChange={set('video_url')}
              onBlur={() => form.video_url.trim() && setForm((prev) => ({ ...prev, status: 'published' }))}
              placeholder="https://www.instagram.com/reel/…"
            />
          )}
        </Field>
        <Field label="Video metni" className="sm:col-span-6">
          {(props) => <Textarea {...props} rows={5} maxLength={10000} value={form.script} onChange={set('script')} placeholder="Kancayı ve videoda söyleyeceklerini yaz" />}
        </Field>
        <Field label="Açıklama metni" hint={`${form.caption.length} / ${CAPTION_LIMIT}`} className="sm:col-span-6">
          {(props) => <Textarea {...props} rows={4} maxLength={CAPTION_LIMIT} value={form.caption} onChange={set('caption')} placeholder="Reels açıklaması ve etiketler" />}
        </Field>
        <Field label="Notlar" className="sm:col-span-6">
          {(props) => <Textarea {...props} rows={2} maxLength={2000} value={form.notes} onChange={set('notes')} placeholder="Mekân, kıyafet, gerekenler…" />}
        </Field>
      </form>
    </Modal>
  )
}

function ItemDetails({ item, series, onClose }: { item: ContentItem; series: ContentSeries[]; onClose: () => void }) {
  const seriesTitle = item.series_id ? series.find((s) => s.id === item.series_id)?.title : null
  const blocks: Array<[string, string | null]> = [
    ['Video metni', item.script],
    ['Açıklama metni', item.caption],
    ['Notlar', item.notes],
  ]
  return (
    <Modal open onClose={onClose} size="lg" title={`${item.episode_no ? `${item.episode_no}. ` : ''}${item.title}`} description={seriesTitle ?? undefined}>
      <div className="grid gap-4">
        <CoverThumb url={item.cover_url} className="w-36 rounded-lg" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-muted">
          <StatusChip status={item.status} />
          <span>Paylaşım: {publishLabel(item)}</span>
          {item.shoot_date && <span>Çekim: {formatDate(item.shoot_date, true)}</span>}
          {item.video_url && <VideoLink url={item.video_url} />}
        </div>
        {blocks.map(([label, value]) =>
          value ? (
            <div key={label}>
              <div className="mb-1 text-[12.5px] font-medium text-ink-muted">{label}</div>
              <p className="whitespace-pre-line text-[13.5px] text-ink">{value}</p>
            </div>
          ) : null,
        )}
      </div>
    </Modal>
  )
}

function SeriesModal({
  draft,
  pending,
  onClose,
  onSave,
}: {
  draft: Partial<ContentSeries>
  pending: boolean
  onClose: () => void
  onSave: (id: string | null, input: Record<string, unknown>, titles: string[], interval: number) => void
}) {
  const [title, setTitle] = useState(draft.title ?? '')
  const [description, setDescription] = useState(draft.description ?? '')
  const [plannedCount, setPlannedCount] = useState(draft.planned_count ? String(draft.planned_count) : '')
  const [startDate, setStartDate] = useState(draft.start_date ?? '')
  const [interval, setIntervalDays] = useState('1')
  const [episodeTitles, setEpisodeTitles] = useState('')
  const isNew = !draft.id
  const titles = episodeTitles.split('\n').map((t) => t.trim()).filter(Boolean)
  const episodeTotal = Math.max(titles.length, Number(plannedCount) || 0)

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      dismissible={!pending}
      title={isNew ? 'Yeni seri' : 'Seriyi düzenle'}
      description={isNew ? 'Bölümler tek seferde açılır; sonra her birini ayrı ayrı düzenleyebilirsin.' : undefined}
      footer={
        <>
          <Button variant="ghost" size="sm" disabled={pending} onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" type="submit" form="content-series-form" loading={pending} disabled={!title.trim()}>
            {isNew && episodeTotal > 0 ? `Seriyi ve ${episodeTotal} bölümü oluştur` : 'Kaydet'}
          </Button>
        </>
      }
    >
      <form
        id="content-series-form"
        className="grid gap-4 sm:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim()) onSave(draft.id ?? null, { title, description, planned_count: plannedCount, start_date: startDate }, isNew ? titles : [], Number(interval) || 1)
        }}
      >
        <Field label="Seri adı" className="sm:col-span-6">
          {(props) => <Input {...props} data-autofocus maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="27 günde 27 şeyi değiştiriyorum" required />}
        </Field>
        <Field label="Açıklama" className="sm:col-span-6">
          {(props) => <Textarea {...props} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <Field label="Bölüm sayısı" className="sm:col-span-2">
          {(props) => <Input {...props} type="number" min={1} max={365} value={plannedCount} onChange={(e) => setPlannedCount(e.target.value)} placeholder="27" />}
        </Field>
        <Field label="Başlangıç tarihi" className="sm:col-span-2">
          {(props) => <Input {...props} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />}
        </Field>
        {isNew && (
          <>
            <Field label="Paylaşım sıklığı" className="sm:col-span-2">
              {(props) => (
                <Select {...props} value={interval} onChange={(e) => setIntervalDays(e.target.value)}>
                  <option value="1">Her gün</option>
                  <option value="2">2 günde bir</option>
                  <option value="3">3 günde bir</option>
                  <option value="7">Haftada bir</option>
                </Select>
              )}
            </Field>
            <Field label="Alt başlıklar" hint="Her satıra bir bölüm. Boş kalanlar “N. bölüm” olarak açılır, sonra değiştirebilirsin." className="sm:col-span-6">
              {(props) => (
                <Textarea
                  {...props}
                  rows={7}
                  value={episodeTitles}
                  onChange={(e) => setEpisodeTitles(e.target.value)}
                  placeholder={'Sabah rutinimi değiştiriyorum\nTelefonu yatak odasından çıkarıyorum\nHer gün 20 dakika yürüyorum'}
                />
              )}
            </Field>
          </>
        )}
      </form>
    </Modal>
  )
}
