'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, CheckCircle, XCircle, Trash2, Flag, ImageIcon } from 'lucide-react'
import { updateReportStatus, deleteMessage } from '@/app/admin/messages/actions'
import { getAttachmentUrl } from '@/app/admin/attachments/actions'
import { parseChatImageUrl } from '@/lib/chat-image'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Avatar, Button, Card, Chip, ConfirmDialog, EmptyState, Eyebrow, PageHeader, Tabs, type ChipTone } from '@/components/ui'

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
  message_snapshot?: string | null
  message_removed_at?: string | null
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

const STATUS: Record<MessageReport['status'], { label: string; tone: ChipTone }> = {
  pending: { label: 'Beklemede', tone: 'warning' },
  reviewed: { label: 'İncelendi', tone: 'info' },
  resolved: { label: 'Çözüldü', tone: 'success' },
  dismissed: { label: 'Reddedildi', tone: 'neutral' },
}

const REASON_LABELS: Record<MessageReport['reason'], string> = {
  harassment: 'Taciz',
  spam: 'Spam',
  inappropriate: 'Uygunsuz İçerik',
  illegal: 'Yasadışı İçerik',
  other: 'Diğer',
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function Party({ label, user }: { label: string; user: MessageReport['reporter'] }) {
  return (
    <div>
      <Eyebrow className="mb-2">{label}</Eyebrow>
      <div className="flex items-center gap-2.5">
        <Avatar name={user?.full_name ?? '?'} src={user?.avatar_url ?? undefined} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-medium text-ink">{user?.full_name ?? 'Bilinmeyen'}</p>
          {user?.email && <p className="truncate text-xs text-ink-faint">{user.email}</p>}
        </div>
      </div>
    </div>
  )
}

export default function MessageReportsPanel({ initialReports }: MessageReportsPanelProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [reports, setReports] = useState<MessageReport[]>(initialReports)
  const [isPending, startTransition] = useTransition()
  const [toRemove, setToRemove] = useState<string | null>(null)
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
        toast.error(result.error)
      } else {
        toast.success('Rapor durumu güncellendi.')
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
    startTransition(async () => {
      const result = await deleteMessage(messageId)
      setToRemove(null)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success('Mesaj kaldırıldı.')
        const removedAt = 'removedAt' in result ? result.removedAt : new Date().toISOString()
        setReports((prev) =>
          prev.map((r) =>
            r.message_id === messageId
              ? {
                  ...r,
                  status: 'resolved',
                  message_snapshot: r.message_snapshot ?? r.message?.content ?? null,
                  message_removed_at: removedAt,
                }
              : r,
          ),
        )
      }
    })
  }

  const openImage = async (content: string) => {
    const stored = parseChatImageUrl(content)
    if (!stored) return
    const result = await getAttachmentUrl(stored)
    if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer')
    else toast.error(result.error ?? 'Fotoğraf açılamadı.')
  }

  return (
    <div className="max-w-5xl">
      <PageHeader title="Raporlanan mesajlar" description="Kullanıcıların şikâyet ettiği mesajları inceleyin; gerekirse mesajı sohbetten kaldırın." />

      <Tabs
        className="mb-4"
        label="Rapor durumu"
        value={activeTab}
        onSelect={(value) => setActiveTab(value as TabKey)}
        items={tabs.map((tab) => ({
          value: tab.key,
          label: tab.label,
          count: reports.filter((r) => (tab.key === 'all' ? true : r.status === tab.key)).length,
        }))}
      />

      {filteredReports.length === 0 ? (
        <Card>
          <EmptyState icon={Flag} title="Rapor yok" description="Bu durumda bekleyen rapor bulunmuyor." />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredReports.map((report) => {
            const status = STATUS[report.status]
            const content = report.message ? report.message_snapshot ?? report.message.content : null
            return (
              <Card key={report.id} padded className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={status.tone} dot>{status.label}</Chip>
                  <Chip>{REASON_LABELS[report.reason]}</Chip>
                  <span className="text-xs text-ink-faint">{formatDate(report.created_at)}</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Party label="Raporlayan" user={report.reporter} />
                  <Party label="Raporlanan" user={report.reported} />
                </div>

                {report.message && content !== null && (
                  <div>
                    <Eyebrow className="mb-2">Raporlanan mesaj</Eyebrow>
                    <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                      {parseChatImageUrl(content) ? (
                        <Button size="sm" variant="ghost" onClick={() => openImage(content)} leftIcon={<ImageIcon />}>
                          Fotoğrafı aç (10 dk geçerli bağlantı)
                        </Button>
                      ) : (
                        <p className="whitespace-pre-wrap text-[13.5px] text-ink">{content}</p>
                      )}
                      {report.message_removed_at && <p className="mt-2 text-xs font-medium text-danger">Sohbetten kaldırıldı</p>}
                      <p className="mt-2 text-xs text-ink-faint">{formatDate(report.message.created_at)}</p>
                    </div>
                  </div>
                )}

                {report.description && (
                  <div>
                    <Eyebrow className="mb-2">Açıklama</Eyebrow>
                    <p className="text-[13.5px] text-ink-muted">{report.description}</p>
                  </div>
                )}

                {(report.status === 'pending' || (report.message && !report.message_removed_at)) && (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    {report.status === 'pending' && (
                      <>
                        <Button size="sm" onClick={() => handleStatusChange(report.id, 'reviewed')} disabled={isPending} leftIcon={<Eye />}>
                          İncelendi
                        </Button>
                        <Button size="sm" onClick={() => handleStatusChange(report.id, 'resolved')} disabled={isPending} leftIcon={<CheckCircle />}>
                          Çözüldü
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleStatusChange(report.id, 'dismissed')} disabled={isPending} leftIcon={<XCircle />}>
                          Reddet
                        </Button>
                      </>
                    )}
                    {report.message && !report.message_removed_at && (
                      <Button size="sm" variant="danger" onClick={() => setToRemove(report.message_id)} disabled={isPending} leftIcon={<Trash2 />}>
                        Mesajı kaldır
                      </Button>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        onConfirm={() => toRemove && handleDeleteMessage(toRemove)}
        loading={isPending && !!toRemove}
        tone="danger"
        title="Mesaj kaldırılsın mı?"
        description="Mesaj sohbetten kaldırılır; orijinal içerik şikâyet kaydında saklanır."
        confirmLabel="Kaldır"
      />
    </div>
  )
}
