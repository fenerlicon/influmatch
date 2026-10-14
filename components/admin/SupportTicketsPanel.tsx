'use client'

import { ticketCode } from '@/lib/support-ticket'
import { useState, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { getAttachmentUrl } from '@/app/admin/attachments/actions'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { updateSupportTicketStatus, addAdminResponse } from '@/app/admin/support/actions'
import { FileText, LifeBuoy, Paperclip, Send, X } from 'lucide-react'
import { Avatar, Button, Card, CardBody, CardHeader, Chip, EmptyState, Eyebrow, Field, PageHeader, Segmented, Tabs, Textarea, type ChipTone } from '@/components/ui'
import { cn } from '@/utils/cn'

interface SupportTicket {
  id: string
  user_id: string
  subject: 'Ödeme Sorunu' | 'Teknik Hata' | 'Şikayet/Bildirim' | 'Öneri'
  priority: 'Düşük' | 'Orta' | 'Acil'
  message: string
  file_url: string | null
  status: 'open' | 'in_progress' | 'closed'
  admin_response: string | null
  created_at: string
  updated_at: string
  users: {
    id: string
    full_name: string | null
    email: string | null
    username: string | null
    avatar_url: string | null
    role: 'influencer' | 'brand' | null
  } | null
}

interface SupportTicketsPanelProps {
  initialTickets: SupportTicket[]
}

const tabs = [
  { key: 'all', label: 'Tümü' },
  { key: 'open', label: 'Açık' },
  { key: 'in_progress', label: 'İşlemde' },
  { key: 'closed', label: 'Kapatılmış' },
] as const

type TabKey = (typeof tabs)[number]['key']

const PRIORITY_TONES: Record<SupportTicket['priority'], ChipTone> = {
  Düşük: 'neutral',
  Orta: 'warning',
  Acil: 'danger',
}

const STATUS: Record<SupportTicket['status'], { label: string; tone: ChipTone }> = {
  open: { label: 'Açık', tone: 'warning' },
  in_progress: { label: 'İşlemde', tone: 'info' },
  closed: { label: 'Kapatıldı', tone: 'success' },
}

const formatDate = (dateString: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(dateString))

export default function SupportTicketsPanel({ initialTickets }: SupportTicketsPanelProps) {
  const supabase = useSupabaseClient()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [isPending, startTransition] = useTransition()
  const [sending, setSending] = useState(false)

  // Reset admin response when ticket changes
  useEffect(() => {
    if (selectedTicket) {
      setAdminResponse(selectedTicket.admin_response || '')
    } else {
      setAdminResponse('')
    }
  }, [selectedTicket])

  // Filter tickets by tab
  const filteredTickets = tickets.filter((ticket) => {
    if (activeTab === 'all') return true
    return ticket.status === activeTab
  })

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-support-tickets')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch updated ticket with user info
            const { data: updatedTicket } = await supabase
              .from('support_tickets')
              .select(`
                id,
                user_id,
                subject,
                priority,
                message,
                file_url,
                status,
                admin_response,
                created_at,
                updated_at,
                users:user_id (
                  id,
                  full_name,
                  username,
                  avatar_url,
                  role
                )
              `)
              .eq('id', payload.new.id)
              .single()

            if (updatedTicket) {
              setTickets((prev) => {
                const existingIndex = prev.findIndex((t) => t.id === updatedTicket.id)
                if (existingIndex >= 0) {
                  const newTickets = [...prev]
                  const merged = updatedTicket as unknown as SupportTicket
                  // E-posta istemciden okunamaz; sunucudan gelen ilk yüklemedeki değeri koru.
                  if (merged.users && prev[existingIndex].users?.email) {
                    merged.users = { ...merged.users, email: prev[existingIndex].users?.email }
                  }
                  newTickets[existingIndex] = merged
                  return newTickets
                } else {
                  return [updatedTicket as unknown as SupportTicket, ...prev]
                }
              })
            }
          } else if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id !== payload.old.id))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const handleStatusChange = (ticketId: string, newStatus: 'open' | 'in_progress' | 'closed') => {
    startTransition(async () => {
      const result = await updateSupportTicketStatus(ticketId, newStatus)
      if (!result.success) {
        toast.error(result.error || 'Durum güncellenemedi.')
        return
      }
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket)))
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null))
      }
    })
  }

  const handleSendResponse = (ticketId: string) => {
    if (!adminResponse.trim()) return

    setSending(true)
    startTransition(async () => {
      const result = await addAdminResponse(ticketId, adminResponse.trim())
      setSending(false)
      if (!result.success) {
        toast.error(result.error || 'Yanıt kaydedilemedi.')
        return
      }
      toast.success('Yanıt gönderildi.')
      const response = adminResponse.trim()
      setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, admin_response: response } : ticket)))
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, admin_response: response } : null))
      }
      setAdminResponse('')
    })
  }

  const openAttachment = async (fileUrl: string) => {
    // Ek özel kovada; kısa süreli imzalı bağlantı istenir. Sekme tıklama anında açılır
    // (açılır pencere engelleyicisine takılmaması için), adres sonra verilir.
    const tab = window.open('', '_blank')
    const result = await getAttachmentUrl(fileUrl)
    if (result.url && tab) tab.location.href = result.url
    else {
      tab?.close()
      toast.error(result.error ?? 'Dosya açılamadı.')
    }
  }

  const count = (key: TabKey) => (key === 'all' ? tickets.length : tickets.filter((t) => t.status === key).length)
  const t = selectedTicket

  return (
    <div>
      <PageHeader title="Destek talepleri" description="Kullanıcıların gönderdiği talepleri inceleyin, yanıtlayın ve durumunu güncelleyin." />

      <Tabs
        className="mb-4"
        label="Talep durumu"
        value={activeTab}
        onSelect={(value) => setActiveTab(value as TabKey)}
        items={tabs.map((tab) => ({ value: tab.key, label: tab.label, count: count(tab.key) }))}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        {/* Liste */}
        <Card className="overflow-hidden">
          {filteredTickets.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="Talep yok" description="Bu durumda destek talebi bulunmuyor." />
          ) : (
            <div className="max-h-[70vh] overflow-y-auto">
              {filteredTickets.map((ticket) => {
                const selected = t?.id === ticket.id
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicket(ticket)}
                    aria-current={selected || undefined}
                    className={cn(
                      'block w-full border-b border-l-2 border-b-line border-l-transparent px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-2',
                      selected && 'border-l-gold bg-surface-2',
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-semibold tabular-nums text-gold">#{ticketCode(ticket.id)}</span>
                      <Chip tone={PRIORITY_TONES[ticket.priority]}>{ticket.priority}</Chip>
                      <Chip tone={STATUS[ticket.status].tone} dot>{STATUS[ticket.status].label}</Chip>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-[13.5px] font-medium text-ink">{ticket.subject}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">{ticket.message}</p>
                    <p className="mt-1 truncate text-xs text-ink-faint">
                      {ticket.users?.full_name ?? ticket.users?.email ?? 'Kullanıcı'} · {formatDate(ticket.created_at)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </Card>

        {/* Ayrıntı */}
        {t ? (
          <Card>
            <CardHeader
              title={t.subject}
              description={`#${ticketCode(t.id)} · Oluşturulma ${formatDate(t.created_at)}${t.updated_at !== t.created_at ? ` · Güncelleme ${formatDate(t.updated_at)}` : ''}`}
              action={
                <Button size="sm" variant="ghost" iconOnly aria-label="Kapat" onClick={() => setSelectedTicket(null)}>
                  <X />
                </Button>
              }
            />
            <CardBody className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone={PRIORITY_TONES[t.priority]}>{t.priority}</Chip>
                <Chip tone={STATUS[t.status].tone} dot>{STATUS[t.status].label}</Chip>
              </div>

              <div className="flex items-center gap-3">
                <Avatar name={t.users?.full_name ?? t.users?.email ?? '?'} src={t.users?.avatar_url ?? undefined} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-ink">{t.users?.full_name ?? 'Kullanıcı'}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {[t.users?.email, t.users?.username ? `@${t.users.username}` : null].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              <div>
                <Eyebrow className="mb-1.5">Mesaj</Eyebrow>
                <p className="whitespace-pre-wrap text-[13.5px] text-ink">{t.message}</p>
              </div>

              {t.file_url && (
                <div>
                  <Button size="sm" onClick={() => openAttachment(t.file_url as string)} leftIcon={<Paperclip />}>
                    Ekli dosyayı aç
                  </Button>
                </div>
              )}

              {t.admin_response && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-3.5">
                  <p className="text-xs font-medium text-gold">Gönderilen yanıt</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">{t.admin_response}</p>
                </div>
              )}

              <Field label={t.admin_response ? 'Yanıtı güncelle' : 'Yanıt yaz'} hint="Kullanıcıya bildirim gider; e-posta tercihine göre e-posta da.">
                {(props) => (
                  <Textarea
                    {...props}
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    disabled={isPending}
                    rows={4}
                    placeholder="Kullanıcıya yanıt yazın…"
                  />
                )}
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <Segmented
                  label="Talep durumu"
                  value={t.status}
                  onSelect={(value) => value !== t.status && handleStatusChange(t.id, value as SupportTicket['status'])}
                  items={(['open', 'in_progress', 'closed'] as const).map((s) => ({ value: s, label: STATUS[s].label }))}
                />
                <Button
                  variant="primary"
                  onClick={() => handleSendResponse(t.id)}
                  loading={isPending && sending}
                  disabled={isPending || !adminResponse.trim()}
                  leftIcon={<Send />}
                >
                  Yanıtı gönder
                </Button>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card className="hidden lg:block">
            <EmptyState icon={FileText} title="Bir talep seçin" description="Ayrıntılar, yanıt ve durum burada görünür." />
          </Card>
        )}
      </div>
    </div>
  )
}
