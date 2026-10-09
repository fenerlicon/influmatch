'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import AdvertProjectsList, { type AdvertProject } from '@/components/dashboard/AdvertProjectsList'
import AdvertApplicationsList, { type AdvertApplication } from '@/components/dashboard/AdvertApplicationsList'
import AdvertAlertsManager from '@/components/dashboard/AdvertAlertsManager'
import { setAdvertSaved } from '@/app/dashboard/influencer/advert/actions'
import type { AdvertAlert } from '@/lib/advert-alerts'

interface InfluencerAdvertTabsProps {
  openProjects: AdvertProject[]
  myApplications: AdvertApplication[]
  initialAppliedIds?: string[]
  currentUserId?: string
  initialSavedIds?: string[]
  initialAlerts?: AdvertAlert[]
}

type TabKey = 'open' | 'saved' | 'applications' | 'alerts'

const tabs: Array<{ key: TabKey; label: string; description: string }> = [
  {
    key: 'open',
    label: 'Açık İlanlar',
    description: 'Başvurabileceğin açık iş birliklerini incele.',
  },
  {
    key: 'saved',
    label: 'Kaydedilenler',
    description: 'Kaydettiğin ve hâlâ yayında olan ilanlar.',
  },
  {
    key: 'applications',
    label: 'Başvurduklarım',
    description: 'Başvurduğun ilanların durumunu takip et.',
  },
  {
    key: 'alerts',
    label: 'Alarmlar',
    description: 'Sana uygun yeni ilan çıkınca haber al.',
  },
]

const isTabKey = (value: string | null): value is TabKey => tabs.some((tab) => tab.key === value)

export default function InfluencerAdvertTabs({
  openProjects,
  myApplications,
  initialAppliedIds = [],
  currentUserId,
  initialSavedIds = [],
  initialAlerts = [],
}: InfluencerAdvertTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<TabKey>(isTabKey(tabParam) ? tabParam : 'open')
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set(initialSavedIds))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (isTabKey(tabParam)) setActiveTab(tabParam)
  }, [tabParam])

  const savedProjects = useMemo(() => openProjects.filter((project) => savedIds.has(project.id)), [openProjects, savedIds])

  const handleToggleSave = (advertId: string, nextSaved: boolean) => {
    // İyimser güncelleme; hata olursa geri alınır.
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (nextSaved) next.add(advertId)
      else next.delete(advertId)
      return next
    })
    setSaveError(null)
    startTransition(async () => {
      const result = await setAdvertSaved(advertId, nextSaved)
      if ('error' in result && result.error) {
        setSaveError(result.error)
        setSavedIds((prev) => {
          const next = new Set(prev)
          if (nextSaved) next.delete(advertId)
          else next.add(advertId)
          return next
        })
      }
    })
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Advert</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">İlan Görünümü</h2>
        </div>
        <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]' : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
                {tab.key === 'saved' && savedProjects.length > 0 ? ` (${savedProjects.length})` : ''}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-400">{tabs.find((tab) => tab.key === activeTab)?.description}</p>
      {saveError ? <p className="mt-2 text-sm text-red-300">{saveError}</p> : null}

      <div className="mt-6">
        {activeTab === 'open' ? (
          <AdvertProjectsList
            projects={openProjects}
            initialAppliedIds={initialAppliedIds}
            savedIds={savedIds}
            onToggleSave={handleToggleSave}
          />
        ) : activeTab === 'saved' ? (
          <AdvertProjectsList
            projects={savedProjects}
            initialAppliedIds={initialAppliedIds}
            savedIds={savedIds}
            onToggleSave={handleToggleSave}
            emptyMessage="Henüz kaydettiğin bir ilan yok. İlan kartındaki kaydet düğmesiyle buraya ekleyebilirsin."
          />
        ) : activeTab === 'alerts' ? (
          <AdvertAlertsManager initialAlerts={initialAlerts} />
        ) : (
          <AdvertApplicationsList applications={myApplications} isInfluencerView={true} currentUserId={currentUserId} />
        )}
      </div>
    </section>
  )
}
