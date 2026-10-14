'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Archive, CheckCircle, Eye, EyeOff, MessagesSquare } from 'lucide-react'
import { getAttachmentUrl } from '@/app/admin/attachments/actions'
import { updateFeedbackNote, updateFeedbackStatus } from '@/app/admin/feedback/actions'
import { Button, Card, Chip, EmptyState, PageHeader, Tabs, Textarea, type ChipTone } from '@/components/ui'

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

type Status = FeedbackSubmission['status']

const STATUS: Record<Status, { label: string; tone: ChipTone }> = {
  pending: { label: 'Bekleyen', tone: 'warning' },
  reviewed: { label: 'İncelenen', tone: 'info' },
  resolved: { label: 'Çözülen', tone: 'success' },
  archived: { label: 'Arşivlenen', tone: 'neutral' },
}

const TABS: Array<'all' | Status> = ['all', 'pending', 'reviewed', 'resolved', 'archived']

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function FeedbackAdminPanel({ feedbackSubmissions }: FeedbackAdminPanelProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | Status>('all')
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const runAction = (key: string, action: () => Promise<{ error?: string | null }>, after?: () => void) => {
    setBusy(key)
    startTransition(async () => {
      const result = await action()
      setBusy(null)
      if (result.error) {
        toast.error(result.error)
        return
      }
      after?.()
      router.refresh()
    })
  }

  const toggleImage = async (submission: FeedbackSubmission) => {
    if (expandedId === submission.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(submission.id)
    if (!signedUrls[submission.id] && submission.imageUrl) {
      const result = await getAttachmentUrl(submission.imageUrl)
      if (result.url) setSignedUrls((prev) => ({ ...prev, [submission.id]: result.url as string }))
    }
  }

  const count = (tab: 'all' | Status) => (tab === 'all' ? feedbackSubmissions.length : feedbackSubmissions.filter((s) => s.status === tab).length)
  const filtered = activeTab === 'all' ? feedbackSubmissions : feedbackSubmissions.filter((s) => s.status === activeTab)

  return (
    <div className="max-w-5xl">
      <PageHeader title="Geri bildirimler" description="Kullanıcıların uygulama içinden gönderdiği hata bildirimleri ve öneriler." />

      <Tabs
        className="mb-4"
        label="Geri bildirim durumu"
        value={activeTab}
        onSelect={(value) => setActiveTab(value as 'all' | Status)}
        items={TABS.map((tab) => ({ value: tab, label: tab === 'all' ? 'Tümü' : STATUS[tab].label, count: count(tab) }))}
      />

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon={MessagesSquare} title="Geri bildirim yok" description="Bu durumda bekleyen kayıt bulunmuyor." />
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((submission) => {
            const status = STATUS[submission.status]
            const name = submission.user?.full_name || submission.user?.username || submission.user?.email || 'Bilinmeyen'
            const editing = editingNoteId === submission.id
            return (
              <Card key={submission.id} padded className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={status.tone} dot>{status.label}</Chip>
                  <Chip tone={submission.role === 'brand' ? 'gold' : 'info'}>{submission.role === 'influencer' ? 'Influencer' : 'Marka'}</Chip>
                  <span className="text-xs text-ink-faint">{formatDate(submission.createdAt)}</span>
                </div>

                <div>
                  <p className="text-[13.5px] font-medium text-ink">{name}</p>
                  {submission.user?.email && <p className="text-xs text-ink-faint">{submission.user.email}</p>}
                </div>

                <p className="whitespace-pre-wrap text-[14px] text-ink">{submission.description}</p>

                {submission.imageUrl && (
                  <div>
                    <Button size="sm" variant="ghost" onClick={() => toggleImage(submission)} leftIcon={expandedId === submission.id ? <EyeOff /> : <Eye />}>
                      {expandedId === submission.id ? 'Görseli gizle' : 'Ekran görüntüsünü göster'}
                    </Button>
                    {expandedId === submission.id && (
                      <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
                        {signedUrls[submission.id] ? (
                          // İmzalı bağlantı kısa ömürlü ve özel kovadan; görsel optimizasyonundan geçirilmez.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={signedUrls[submission.id]} alt="Geri bildirim ekran görüntüsü" className="w-full rounded-lg object-contain" />
                        ) : (
                          <p className="text-[13px] text-ink-muted">Görsel yükleniyor…</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {editing ? (
                  <div className="grid gap-2 rounded-xl border border-gold/30 bg-gold/5 p-3">
                    <p className="text-xs font-medium text-gold">Admin notu</p>
                    <Textarea
                      aria-label="Admin notu"
                      value={noteDrafts[submission.id] ?? submission.adminNotes ?? ''}
                      onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [submission.id]: e.target.value }))}
                      maxLength={2000}
                      rows={3}
                      placeholder="Yalnızca adminlerin göreceği not"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        loading={isPending && busy === `note:${submission.id}`}
                        onClick={() => runAction(`note:${submission.id}`, () => updateFeedbackNote(submission.id, noteDrafts[submission.id] ?? submission.adminNotes ?? ''), () => setEditingNoteId(null))}
                      >
                        Kaydet
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>Vazgeç</Button>
                    </div>
                  </div>
                ) : submission.adminNotes ? (
                  <div className="rounded-xl border border-gold/30 bg-gold/5 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-gold">Admin notu</p>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(submission.id)}>Düzenle</Button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">{submission.adminNotes}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {!editing && !submission.adminNotes && (
                    <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(submission.id)}>Not ekle</Button>
                  )}
                  {submission.status !== 'reviewed' && (
                    <Button
                      size="sm"
                      onClick={() => runAction(`reviewed:${submission.id}`, () => updateFeedbackStatus(submission.id, 'reviewed'))}
                      loading={isPending && busy === `reviewed:${submission.id}`}
                      disabled={isPending}
                      leftIcon={<Eye />}
                    >
                      İncelendi
                    </Button>
                  )}
                  {submission.status !== 'resolved' && (
                    <Button
                      size="sm"
                      onClick={() => runAction(`resolved:${submission.id}`, () => updateFeedbackStatus(submission.id, 'resolved'))}
                      loading={isPending && busy === `resolved:${submission.id}`}
                      disabled={isPending}
                      leftIcon={<CheckCircle />}
                    >
                      Çözüldü
                    </Button>
                  )}
                  {submission.status !== 'archived' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => runAction(`archived:${submission.id}`, () => updateFeedbackStatus(submission.id, 'archived'))}
                      loading={isPending && busy === `archived:${submission.id}`}
                      disabled={isPending}
                      leftIcon={<Archive />}
                    >
                      Arşivle
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
