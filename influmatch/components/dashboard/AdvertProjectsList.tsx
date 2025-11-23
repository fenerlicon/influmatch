'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { CalendarDays, CheckCircle2, Loader2, MapPin, Megaphone, Search, SendHorizontal, X, BadgeCheck } from 'lucide-react'
import { applyToAdvert } from '@/app/dashboard/influencer/advert/actions'
import BadgeDisplay from '@/components/badges/BadgeDisplay'

export interface AdvertProject {
  id: string
  title: string
  summary: string
  category: string
  brandName: string
  brandAvatar: string | null
  brandUserId?: string | null // ID of the brand user who owns this project
  brandDisplayedBadges?: string[] | null // Badges displayed by the brand
  brandVerificationStatus?: string | null // Verification status of the brand
  budgetCurrency: string
  budgetMin: number | null
  budgetMax: number | null
  deliverables: string[]
  platforms: string[]
  location: string
  heroImage: string | null
  deadline: string | null
  status: string
  createdAt: string
}

interface AdvertProjectsListProps {
  projects: AdvertProject[]
  initialAppliedIds?: string[]
  mode?: 'influencer' | 'brand'
  currentUserId?: string
  myProjectIds?: string[] // IDs of projects owned by current user (for brand mode)
}

const emptyFormState = {
  coverLetter: '',
  deliverableIdea: '',
  budgetExpectation: '',
}

const formatBudgetRange = (min: number | null, max: number | null, currency = 'TRY') => {
  if (min === null && max === null) {
    return 'Bütçe paylaşılmadı'
  }

  const formatter = new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })

  if (min !== null && max !== null) {
    return `${formatter.format(min)} - ${formatter.format(max)}`
  }

  const value = formatter.format((min ?? max) as number)
  return `~ ${value}`
}

const formatDate = (value: string | null) => {
  if (!value) {
    return 'Belirtilmedi'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Belirtilmedi'
  }
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export default function AdvertProjectsList({ 
  projects, 
  initialAppliedIds = [], 
  mode = 'influencer',
  currentUserId,
  myProjectIds = []
}: AdvertProjectsListProps) {
  const isBrandMode = mode === 'brand'
  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState<AdvertProject | null>(null)
  const [formState, setFormState] = useState(emptyFormState)
  const [feedback, setFeedback] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({})
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set(initialAppliedIds))
  const [submittingId, setSubmittingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  const myProjectIdsSet = useMemo(() => new Set(myProjectIds), [myProjectIds])

  useEffect(() => {
    setAppliedIds(new Set(initialAppliedIds))
  }, [initialAppliedIds])

  const filteredProjects = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return projects

    return projects.filter((project) => {
      const haystack = [
        project.title,
        project.summary,
        project.brandName,
        project.category,
        project.platforms.join(' '),
        project.deliverables.join(' '),
      ]

      return haystack.some((field) => field?.toLowerCase().includes(keyword))
    })
  }, [projects, query])


  const handleSubmit = (projectId: string) => {
    if (isBrandMode) return
    if (!formState.coverLetter.trim()) {
      setFeedback((prev) => ({ ...prev, [projectId]: { type: 'error', message: 'Kısa bir niyet metni paylaşmalısınız.' } }))
      return
    }

    const payload = {
      advertId: projectId,
      coverLetter: formState.coverLetter,
      deliverableIdea: formState.deliverableIdea,
      budgetExpectation: formState.budgetExpectation
        ? Number.parseFloat(formState.budgetExpectation.replace(',', '.'))
        : null,
    }

    setSubmittingId(projectId)
    startTransition(async () => {
      const result = await applyToAdvert(payload)
      setSubmittingId(null)

      if (result?.error) {
        setFeedback((prev) => ({ ...prev, [projectId]: { type: 'error', message: result.error! } }))
        return
      }

      setAppliedIds((prev) => {
        const next = new Set(Array.from(prev))
        next.add(projectId)
        return next
      })
      setFeedback((prev) => ({ ...prev, [projectId]: { type: 'success', message: 'Başvurun markaya iletildi.' } }))
      setFormState(emptyFormState)
      // Don't close modal, let user see success message
    })
  }

  if (projects.length === 0) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
        Henüz yayınlanmış bir proje yok. Markalar yeni briefleri eklediğinde burada listelenecek.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-gray-300">
          <Megaphone className="h-5 w-5 text-soft-gold" />
          {projects.length} aktif proje
        </div>
        <label className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-[#0E0F15] px-4 py-2 text-sm text-gray-300 sm:w-80">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Anahtar kelime ara"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
          />
        </label>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-gray-300">
          Aramanızla eşleşen ilan bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {filteredProjects.map((project) => {
            const isApplied = appliedIds.has(project.id)
            const projectFeedback = feedback[project.id]

            // Card view for both influencer and brand mode (like influencer cards)
            // Check if this project belongs to the current user
            const isMyProject = isBrandMode && currentUserId && project.brandUserId === currentUserId
            return (
              <article 
                key={project.id} 
                onClick={() => setSelectedProject(project)}
                className="group flex h-full flex-col cursor-pointer rounded-3xl border border-white/10 bg-[#0B0C10] p-4 text-white transition duration-300 ease-out hover:-translate-y-1 hover:border-soft-gold/70 hover:shadow-glow"
              >
                <div className="relative h-56 w-full flex-shrink-0 overflow-hidden rounded-2xl border border-white/5">
                  {project.heroImage ? (
                    <Image
                      src={project.heroImage}
                      alt={project.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-white/5 to-transparent text-sm text-gray-400">
                      Kapak görseli yok
                    </div>
                  )}
                  <span className="absolute left-4 top-4 rounded-full bg-soft-gold/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-background shadow-glow">
                    {project.category}
                  </span>
                  {isMyProject && (
                    <span className="absolute right-4 top-4 rounded-full border-2 border-emerald-400 bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                      Senin İlanın
                    </span>
                  )}
                  {!isBrandMode && isApplied && (
                    <span className="absolute right-4 top-4 rounded-full border-2 border-emerald-400 bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                      Başvuruldu
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-1 flex-col gap-3">
                  <div>
                    <h3 className="text-lg font-semibold line-clamp-2">{project.title}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-sm text-gray-400">{project.brandName}</p>
                      {project.brandVerificationStatus === 'verified' && (
                        <div className="group/verify relative flex-shrink-0">
                          <BadgeCheck className="h-4 w-4 text-soft-gold cursor-help" />
                          <div className="absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-xs text-white group-hover/verify:block z-50">
                            Onaylanmış İşletme
                            <div className="absolute right-full top-1/2 -mr-1 -translate-y-1/2 border-4 border-transparent border-r-black/90" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {project.brandDisplayedBadges && project.brandDisplayedBadges.length > 0 && (
                    <div className="flex items-center">
                      <BadgeDisplay
                        badgeIds={project.brandDisplayedBadges}
                        userRole="brand"
                        size="small"
                        maxDisplay={3}
                      />
                    </div>
                  )}
                  <p className="text-sm font-semibold text-soft-gold">
                    {formatBudgetRange(project.budgetMin, project.budgetMax, project.budgetCurrency)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {project.platforms.slice(0, 2).map((platform) => (
                      <span key={platform} className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-300">
                        {platform}
                      </span>
                    ))}
                    {project.platforms.length > 2 && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-gray-300">
                        +{project.platforms.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setSelectedProject(null)}
        >
          <div 
            className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#0E0F15] p-6 text-white shadow-glow"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedProject(null)}
              className="absolute right-4 top-4 z-10 rounded-full border-2 border-white/20 bg-black/60 backdrop-blur-sm p-2.5 text-white transition hover:border-white/50 hover:bg-black/80"
              aria-label="Kapat"
            >
              <X className="h-6 w-6" />
            </button>

            {selectedProject.heroImage && (
              <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-white/10 mb-6">
                <Image
                  src={selectedProject.heroImage}
                  alt={selectedProject.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="object-cover"
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-soft-gold">{selectedProject.category}</p>
                <h2 className="mt-2 text-3xl font-semibold">{selectedProject.title}</h2>
                <div className="mt-3 flex items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {selectedProject.brandAvatar ? (
                      <Image src={selectedProject.brandAvatar} alt={selectedProject.brandName} fill sizes="48px" className="object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-soft-gold">
                        {selectedProject.brandName?.[0] ?? 'M'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{selectedProject.brandName}</p>
                      {selectedProject.brandVerificationStatus === 'verified' && (
                        <div className="group/verify relative flex-shrink-0">
                          <BadgeCheck className="h-5 w-5 text-soft-gold cursor-help" />
                          <div className="absolute left-full top-1/2 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-black/90 px-2 py-1 text-xs text-white group-hover/verify:block z-50">
                            Onaylanmış İşletme
                            <div className="absolute right-full top-1/2 -mr-1 -translate-y-1/2 border-4 border-transparent border-r-black/90" />
                          </div>
                        </div>
                      )}
                    </div>
                    {isBrandMode && currentUserId && selectedProject.brandUserId === currentUserId && (
                      <span className="mt-1 inline-block rounded-full border-2 border-emerald-400 bg-emerald-500/90 px-2 py-0.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
                        Senin İlanın
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-soft-gold">
                  {formatBudgetRange(selectedProject.budgetMin, selectedProject.budgetMax, selectedProject.budgetCurrency)}
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Proje Özeti</h3>
                <p className="mt-2 text-sm text-gray-300">{selectedProject.summary || 'Bu proje için özet brief paylaşılmadı.'}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Lokasyon</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedProject.location}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Deadline</p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
                    <CalendarDays className="h-4 w-4" />
                    <span>{formatDate(selectedProject.deadline)}</span>
                  </div>
                </div>
              </div>

              {selectedProject.platforms.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Platformlar</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProject.platforms.map((platform) => (
                      <span key={platform} className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProject.deliverables.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Teslimatlar</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProject.deliverables.map((deliverable) => (
                      <span key={deliverable} className="rounded-full border border-soft-gold/30 bg-soft-gold/5 px-3 py-1 text-xs text-soft-gold">
                        {deliverable}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Application Form for Influencer Mode */}
            {!isBrandMode && (
              <div className="mt-6 border-t border-white/10 pt-6">
                {appliedIds.has(selectedProject.id) ? (
                  <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-200" />
                      <p className="text-sm font-semibold text-emerald-200">Başvurunuz gönderildi</p>
                    </div>
                    <p className="mt-2 text-xs text-emerald-300">Marka başvurunuzu inceleyecek ve size geri dönüş yapacak.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Başvuru Formu</h3>
                    <label className="block text-xs uppercase tracking-wide text-gray-400">
                      Niyet Mesajı
                      <textarea
                        value={formState.coverLetter}
                        onChange={(event) => setFormState((prev) => ({ ...prev, coverLetter: event.target.value }))}
                        rows={4}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-soft-gold"
                        placeholder="Kısa olarak neden uygun olduğundan bahset."
                      />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="text-xs uppercase tracking-wide text-gray-400">
                        Önerdiğin teslim
                        <input
                          type="text"
                          value={formState.deliverableIdea}
                          onChange={(event) => setFormState((prev) => ({ ...prev, deliverableIdea: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-soft-gold"
                          placeholder="Örn: 1 Reels + 3 Story"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-wide text-gray-400">
                        Bütçe beklentin
                        <input
                          type="text"
                          value={formState.budgetExpectation}
                          onChange={(event) => setFormState((prev) => ({ ...prev, budgetExpectation: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-soft-gold"
                          placeholder="Örn: 25.000"
                        />
                      </label>
                    </div>
                    {feedback[selectedProject.id] && (
                      <p
                        className={`text-sm ${
                          feedback[selectedProject.id].type === 'success' ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {feedback[selectedProject.id].message}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSubmit(selectedProject.id)
                      }}
                      disabled={appliedIds.has(selectedProject.id) || isPending || submittingId === selectedProject.id}
                      className="w-full rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-6 py-3 text-sm font-semibold text-soft-gold transition hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {submittingId === selectedProject.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Gönderiliyor
                        </>
                      ) : (
                        <>
                          Başvuruyu Gönder
                          <SendHorizontal className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

