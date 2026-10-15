'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { BellPlus } from 'lucide-react'
import { setAdvertSaved } from '@/app/dashboard/influencer/advert/actions'
import { Button, PageHeader, Tabs } from '@/components/ui'
import type { AdvertAlert } from '@/lib/advert-alerts'
import type { AdvertApplication, AdvertProject } from '@/lib/adverts-shared'
import AdvertBrowser from './AdvertBrowser'
import MyApplications from './MyApplications'
import AdvertAlerts from './AdvertAlerts'

type TabKey = 'open' | 'saved' | 'applications' | 'alerts'
const TAB_KEYS: TabKey[] = ['open', 'saved', 'applications', 'alerts']
const isTab = (v: string | null): v is TabKey => TAB_KEYS.includes(v as TabKey)

interface Props {
  openProjects: AdvertProject[]
  myApplications: AdvertApplication[]
  appliedIds: string[]
  savedIds: string[]
  alerts: AdvertAlert[]
  /** Alarmlar yayın anında mı (Spotlight Basic/Pro). */
  alertsInstant: boolean
}

/** Influencer İlanlar sayfası: açık ilanlar, kaydedilenler, başvurular, alarmlar (sekme adresi ?tab=). */
export default function InfluencerAdverts({ openProjects, myApplications, appliedIds: initialApplied, savedIds: initialSaved, alerts: initialAlerts, alertsInstant }: Props) {
  const params = useSearchParams()
  const [tab, setTab] = useState<TabKey>(isTab(params.get('tab')) ? (params.get('tab') as TabKey) : 'open')
  const [savedIds, setSavedIds] = useState(() => new Set(initialSaved))
  const [appliedIds, setAppliedIds] = useState(() => new Set(initialApplied))
  const [alerts, setAlerts] = useState(initialAlerts)
  const [, startTransition] = useTransition()

  useEffect(() => {
    const t = params.get('tab')
    if (isTab(t)) setTab(t)
  }, [params])

  useEffect(() => setAppliedIds(new Set(initialApplied)), [initialApplied])

  const select = (value: string) => {
    if (!isTab(value)) return
    setTab(value)
    const url = new URL(window.location.href)
    if (value === 'open') url.searchParams.delete('tab')
    else url.searchParams.set('tab', value)
    window.history.replaceState(null, '', url)
  }

  const savedProjects = useMemo(() => openProjects.filter((p) => savedIds.has(p.id)), [openProjects, savedIds])

  const toggleSave = (advertId: string, next: boolean) => {
    // İyimser güncelleme; hata olursa geri alınır.
    const apply = (add: boolean) =>
      setSavedIds((prev) => {
        const s = new Set(prev)
        if (add) s.add(advertId)
        else s.delete(advertId)
        return s
      })
    apply(next)
    startTransition(async () => {
      const result = await setAdvertSaved(advertId, next)
      if ('error' in result && result.error) {
        toast.error(result.error)
        apply(!next)
      }
    })
  }

  const markApplied = (advertId: string) => {
    setAppliedIds((prev) => new Set(prev).add(advertId))
    toast.success('Başvurun markaya iletildi.')
  }

  return (
    <div>
      <PageHeader
        title="İlanlar"
        description="Doğrulanmış markaların açık ilanları. Başvurun kabul edilirse iş olarak İşler'e düşer."
        actions={
          tab !== 'alerts' && (
            <Button leftIcon={<BellPlus />} onClick={() => select('alerts')}>
              Alarm kur
            </Button>
          )
        }
      />

      <Tabs
        label="İlan görünümü"
        value={tab}
        onSelect={select}
        items={[
          { value: 'open', label: 'Açık ilanlar', count: openProjects.length },
          { value: 'saved', label: 'Kaydedilenler', count: savedProjects.length },
          { value: 'applications', label: 'Başvurularım', count: myApplications.length },
          { value: 'alerts', label: 'Alarmlar', count: alerts.length },
        ]}
      />

      {tab === 'open' && (
        <AdvertBrowser
          mode="influencer"
          projects={openProjects}
          appliedIds={appliedIds}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          onApplied={markApplied}
          empty={{ title: 'Şu an açık ilan yok', description: 'Markalar yeni ilan yayınladığında burada görünür. Alarm kurarsan haber veririz.' }}
        />
      )}
      {tab === 'saved' && (
        <AdvertBrowser
          mode="influencer"
          projects={savedProjects}
          appliedIds={appliedIds}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          onApplied={markApplied}
          empty={{ title: 'Kaydettiğin ilan yok', description: 'İlan ayrıntısındaki kaydet düğmesiyle buraya ekleyebilirsin. Kapanan ilanlar listeden düşer.' }}
        />
      )}
      {tab === 'applications' && <MyApplications applications={myApplications} onBrowse={() => select('open')} />}
      {tab === 'alerts' && <AdvertAlerts alerts={alerts} instant={alertsInstant} onChange={setAlerts} />}
    </div>
  )
}
