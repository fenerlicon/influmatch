'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import BrandAdvertManager from '@/components/dashboard/BrandAdvertManager'
import AdvertProjectsList, { type AdvertProject } from '@/components/dashboard/AdvertProjectsList'
import AdvertApplicationsList, { type AdvertApplication } from '@/components/dashboard/AdvertApplicationsList'

interface BrandAdvertTabsProps {
  myProjects: AdvertProject[]
  communityProjects: AdvertProject[]
  applications: AdvertApplication[]
  currentUserId?: string
  myProjectIds?: string[]
  verificationStatus?: 'pending' | 'verified' | 'rejected'
  userSpotlightStatus?: boolean
}

const tabs: Array<{ key: 'community' | 'mine' | 'applications'; label: string; description: string }> = [
  {
    key: 'community',
    label: 'Topluluk',
    description: 'Tüm açık ilanları inceleyin.',
  },
  {
    key: 'mine',
    label: 'İlanlarım',
    description: 'Kendi iş birliklerinizi yönetin.',
  },
  {
    key: 'applications',
    label: 'Başvurular',
    description: 'İlanlarınıza gelen başvuruları inceleyin.',
  },
]

export default function BrandAdvertTabs({ myProjects, communityProjects, applications, currentUserId, myProjectIds = [], verificationStatus = 'pending', userSpotlightStatus = false }: BrandAdvertTabsProps) {
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<'community' | 'mine' | 'applications'>(
    tabParam === 'mine' ? 'mine' : tabParam === 'applications' ? 'applications' : 'community'
  )

  // Update active tab when URL parameter changes
  useEffect(() => {
    if (tabParam === 'mine') {
      setActiveTab('mine')
    } else if (tabParam === 'applications') {
      setActiveTab('applications')
    } else if (tabParam === 'community') {
      setActiveTab('community')
    }
  }, [tabParam])

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">Advert</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">İlan Görünümü</h2>
        </div>
        <div className="flex gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${isActive ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]' : 'text-gray-400 hover:text-white'
                  }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-400">{tabs.find((tab) => tab.key === activeTab)?.description}</p>

      <div className="mt-6">
        {activeTab === 'community' ? (
          <AdvertProjectsList
            projects={communityProjects}
            initialAppliedIds={[]}
            mode="brand"
            currentUserId={currentUserId}
            myProjectIds={myProjectIds}
          />
        ) : activeTab === 'mine' ? (
          <BrandAdvertManager projects={myProjects} verificationStatus={verificationStatus} currentUserId={currentUserId} userSpotlightStatus={userSpotlightStatus} />
        ) : (
          <AdvertApplicationsList applications={applications} currentUserId={currentUserId} />
        )}
      </div>
    </section>
  )
}

