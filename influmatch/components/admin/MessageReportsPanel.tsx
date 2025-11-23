'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Eye, CheckCircle, XCircle, Archive, Trash2, Loader2 } from 'lucide-react'
import { updateReportStatus, deleteMessage } from '@/app/admin/messages/actions'
import { useSupabaseClient } from '@supabase/auth-helpers-react'

interface MessageReport {
  id: string
  message_id: string
  reporter_user_id: string
  reported_user_id: string
  room_id: string
  reason: 'harassment' | 'spam' | 'inappropriate' | 'illegal' | 'other'
  description: string | null
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
  created_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  reporter: {
    id: string
    full_name: string | null
    email: string | null
    role: 'influencer' | 'brand' | null
    avatar_url: string | null
  } | null
  reported: {
    id: string
    full_name: string | null
    email: string | null
    role: 'influencer' | 'brand' | null
    avatar_url: string | null
  } | null
  message: {
    id: string
    content: string
    sender_id: string
    created_at: string
  } | null
  room: {
    id: string
    brand_id: string | null
    influencer_id: string | null
  } | null
}

interface MessageReportsPanelProps {
  initialReports: MessageReport[]
}

const tabs = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekleyen' },
  { key: 'reviewed', label: 'İncelenen' },
  { key: 'resolved', label: 'Çözülen' },
  { key: 'dismissed', label: 'Reddedilen' },
] as const

type TabKey = (typeof tabs)[number]['key']

const STATUS_STYLES: Record<MessageReport['status'], string> = {
  pending: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200',
  reviewed: 'border-blue-400/40 bg-blue-400/10 text-blue-200',
  resolved: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  dismissed: 'border-red-400/40 bg-red-400/10 text-red-200',
}

const REASON_LABELS: Record<MessageReport['reason'], string> = {
  harassment: 'Taciz',
  spam: 'Spam',
  inappropriate: 'Uygunsuz İçerik',
  illegal: 'Yasadışı İçerik',
  other: 'Diğer',
}

export default function MessageReportsPanel({ initialReports }: MessageReportsPanelProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [reports, setReports] = useState<MessageReport[]>(initialReports)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<MessageReport | null>(null)

  useEffect(() => {
    setReports(initialReports)
  }, [initialReports])

  useEffect(() => {
    const channel = supabase
      .channel('message-reports-channel')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reports' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Refresh reports when new ones are added or updated
            router.refresh()
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const filteredReports =
    activeTab === 'all'
      ? reports
      : reports.filter((r) => r.status === activeTab)

  const handleStatusChange = (reportId: string, newStatus: MessageReport['status']) => {
    startTransition(async () => {
      const result = await updateReportStatus(reportId, newStatus)
      if (result?.error) {
        setToast(result.error)
        setTimeout(() => setToast(null), 3000)
      } else {
        setToast('Rapor durumu güncellendi.')
        setTimeout(() => setToast(null), 3000)
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r)),
        )
        if (selectedReport?.id === reportId) {
          setSelectedReport({ ...selectedReport, status: newStatus })
        }
      }
    })
  }

  const handleDeleteMessage = (messageId: string) => {
    if (!confirm('Bu mesajı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
      return
    }

    startTransition(async () => {
      const result = await deleteMessage(messageId)
      if (result?.error) {
        setToast(result.error)
        setTimeout(() => setToast(null), 3000)
      } else {
        setToast('Mesaj silindi.')
        setTimeout(() => setToast(null), 3000)
        setReports((prev) => prev.filter((r) => r.message_id !== messageId))
        if (selectedReport?.message_id === messageId) {
          setSelectedReport(null)
        }
      }
    })
  }

  return (
    <main className="min-h-screen bg-background px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="glass-panel rounded-[32px] p-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Admin Paneli</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Raporlanan Mesajlar</h1>
              <p className="mt-2 text-gray-300">Kullanıcılar tarafından raporlanan mesajları inceleyin ve yönetin.</p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-soft-gold hover:text-soft-gold"
            >
              <ArrowLeft className="h-4 w-4" /> Hesap Yönetimi
            </Link>
          </div>

          {/* Tabs */}
          <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label} ({reports.filter(r => tab.key === 'all' ? true : r.status === tab.key).length})
                </button>
              )
            })}
          </div>

          {/* Reports List */}
          <div className="mt-8 space-y-4">
            {filteredReports.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-gray-400">
                {activeTab === 'pending' && 'Bekleyen rapor bulunmuyor.'}
                {activeTab === 'all' && 'Rapor bulunmuyor.'}
                {activeTab === 'reviewed' && 'İncelenen rapor bulunmuyor.'}
                {activeTab === 'resolved' && 'Çözülen rapor bulunmuyor.'}
                {activeTab === 'dismissed' && 'Reddedilen rapor bulunmuyor.'}
              </div>
            ) : (
              filteredReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-soft-gold/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            STATUS_STYLES[report.status]
                          }`}
                        >
                          {report.status === 'pending'
                            ? 'Beklemede'
                            : report.status === 'reviewed'
                              ? 'İncelendi'
                              : report.status === 'resolved'
                                ? 'Çözüldü'
                                : 'Reddedildi'}
                        </span>
                        <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-gray-300">
                          {REASON_LABELS[report.reason]}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(report.created_at).toLocaleDateString('tr-TR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 mb-4">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Raporlayan</p>
                          <div className="flex items-center gap-2">
                            {report.reporter?.avatar_url ? (
                              <Image
                                src={report.reporter.avatar_url}
                                alt={report.reporter.full_name ?? 'Kullanıcı'}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-soft-gold">
                                {report.reporter?.full_name?.[0] ?? 'R'}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {report.reporter?.full_name ?? 'Bilinmeyen'}
                              </p>
                              <p className="text-xs text-gray-400">{report.reporter?.email}</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Raporlanan</p>
                          <div className="flex items-center gap-2">
                            {report.reported?.avatar_url ? (
                              <Image
                                src={report.reported.avatar_url}
                                alt={report.reported.full_name ?? 'Kullanıcı'}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-soft-gold">
                                {report.reported?.full_name?.[0] ?? 'R'}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {report.reported?.full_name ?? 'Bilinmeyen'}
                              </p>
                              <p className="text-xs text-gray-400">{report.reported?.email}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {report.message && (
                        <div className="mb-4">
                          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Raporlanan Mesaj</p>
                          <div className="rounded-xl border border-white/10 bg-[#0F1014] p-4">
                            <p className="text-sm text-gray-300 whitespace-pre-wrap">{report.message.content}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(report.message.created_at).toLocaleDateString('tr-TR', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      )}

                      {report.description && (
                        <div className="mb-4">
                          <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Açıklama</p>
                          <p className="text-sm text-gray-300">{report.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-white/10">
                    {report.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(report.id, 'reviewed')}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-blue-500/60 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-400 transition hover:border-blue-500 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4" />
                          İncele
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(report.id, 'resolved')}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:border-emerald-500 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Çözüldü
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange(report.id, 'dismissed')}
                          disabled={isPending}
                          className="inline-flex items-center gap-2 rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <XCircle className="h-4 w-4" />
                          Reddet
                        </button>
                      </>
                    )}
                    {report.message && (
                      <button
                        type="button"
                        onClick={() => handleDeleteMessage(report.message_id)}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Mesajı Sil
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-4 py-2 text-sm text-soft-gold shadow-glow">
          {toast}
        </div>
      )}
    </main>
  )
}

