'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { CheckCircle, XCircle, Archive, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import { updateFeedbackStatus } from '@/app/admin/feedback/actions'
import Link from 'next/link'

interface FeedbackSubmission {
  id: string
  description: string
  imageUrl: string | null
  status: 'pending' | 'reviewed' | 'resolved' | 'archived'
  adminNotes: string | null
  createdAt: string
  role: 'influencer' | 'brand'
  user: {
    id: string
    full_name: string | null
    email: string | null
    username: string | null
  }
}

interface FeedbackAdminPanelProps {
  feedbackSubmissions: FeedbackSubmission[]
}

const STATUS_STYLES: Record<FeedbackSubmission['status'], string> = {
  pending: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200',
  reviewed: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  resolved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  archived: 'border-gray-400/40 bg-gray-400/10 text-gray-200',
}

const ROLE_STYLES: Record<FeedbackSubmission['role'], string> = {
  influencer: 'border-purple-500/40 bg-purple-500/10 text-purple-300',
  brand: 'border-soft-gold/40 bg-soft-gold/10 text-soft-gold',
}

export default function FeedbackAdminPanel({ feedbackSubmissions }: FeedbackAdminPanelProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'reviewed' | 'resolved' | 'archived'>('all')
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredSubmissions =
    activeTab === 'all'
      ? feedbackSubmissions
      : feedbackSubmissions.filter((sub) => sub.status === activeTab)

  const handleStatusUpdate = (id: string, newStatus: FeedbackSubmission['status']) => {
    startTransition(async () => {
      const result = await updateFeedbackStatus(id, newStatus)
      if (result.error) {
        alert(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <main className="min-h-screen bg-background px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="glass-panel rounded-[32px] p-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Admin Paneli</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Geri Bildirimler</h1>
              <p className="mt-2 text-gray-300">Kullanıcı geri bildirimlerini görüntüleyin ve yönetin.</p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30"
            >
              <ArrowLeft className="h-4 w-4" />
              Hesap Yönetimi
            </Link>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
            {[
              { key: 'all', label: 'Tümü', count: feedbackSubmissions.length },
              { key: 'pending', label: 'Bekleyen', count: feedbackSubmissions.filter((s) => s.status === 'pending').length },
              { key: 'reviewed', label: 'İncelenen', count: feedbackSubmissions.filter((s) => s.status === 'reviewed').length },
              { key: 'resolved', label: 'Çözülen', count: feedbackSubmissions.filter((s) => s.status === 'resolved').length },
              { key: 'archived', label: 'Arşivlenen', count: feedbackSubmissions.filter((s) => s.status === 'archived').length },
            ].map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive
                    ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              )
            })}
          </div>

          {/* Feedback List */}
          <div className="mt-8 space-y-4">
            {filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
                Geri bildirim bulunmuyor.
              </div>
            ) : (
              filteredSubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-soft-gold/40"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ROLE_STYLES[submission.role]}`}>
                          {submission.role === 'influencer' ? 'Influencer' : 'Marka'}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[submission.status]}`}>
                          {submission.status === 'pending'
                            ? 'Bekleyen'
                            : submission.status === 'reviewed'
                              ? 'İncelenen'
                              : submission.status === 'resolved'
                                ? 'Çözülen'
                                : 'Arşivlenen'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(submission.createdAt).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-300">Kullanıcı:</p>
                        <p className="text-white">
                          {submission.user.full_name || submission.user.username || submission.user.email || 'Bilinmeyen'}
                        </p>
                        {submission.user.email && (
                          <p className="text-xs text-gray-400">{submission.user.email}</p>
                        )}
                      </div>

                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-300">Geri Bildirim:</p>
                        <p className="mt-1 text-white">{submission.description}</p>
                      </div>

                      {submission.imageUrl && (
                        <div className="mb-3">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expandedId === submission.id ? null : submission.id)}
                            className="flex items-center gap-2 text-sm text-soft-gold hover:underline"
                          >
                            {expandedId === submission.id ? (
                              <>
                                <EyeOff className="h-4 w-4" />
                                Görseli Gizle
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4" />
                                Ekran Görüntüsünü Görüntüle
                              </>
                            )}
                          </button>
                          {expandedId === submission.id && (
                            <div className="mt-2 rounded-xl border border-white/10 bg-[#11121A] p-4">
                              <Image
                                src={submission.imageUrl}
                                alt="Feedback screenshot"
                                width={800}
                                height={600}
                                className="w-full rounded-lg object-contain"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {submission.adminNotes && (
                        <div className="mb-3 rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-3">
                          <p className="text-xs font-medium text-soft-gold">Admin Notu:</p>
                          <p className="mt-1 text-sm text-gray-300">{submission.adminNotes}</p>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {submission.status !== 'reviewed' && (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(submission.id, 'reviewed')}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-500/60 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-400 transition hover:border-blue-500 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                            İncelendi Olarak İşaretle
                          </button>
                        )}
                        {submission.status !== 'resolved' && (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(submission.id, 'resolved')}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:border-emerald-500 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            Çözüldü Olarak İşaretle
                          </button>
                        )}
                        {submission.status !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(submission.id, 'archived')}
                            disabled={isPending}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-500/60 bg-gray-500/10 px-3 py-1.5 text-xs font-semibold text-gray-400 transition hover:border-gray-500 hover:bg-gray-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                            Arşivle
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

