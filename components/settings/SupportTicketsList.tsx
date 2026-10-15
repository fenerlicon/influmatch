'use client'

import { ticketCode } from '@/lib/support-ticket'
import { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { MessageSquare } from 'lucide-react'
import { Card, CardHeader, Chip, ListRow, Modal, Notice, type ChipTone } from '@/components/ui'

interface SupportTicket {
  id: string
  subject: string
  priority: 'Düşük' | 'Orta' | 'Acil'
  status: 'open' | 'in_progress' | 'closed'
  message: string
  admin_response: string | null
  created_at: string
  updated_at: string
}

interface SupportTicketsListProps {
  userId: string
  initialTickets: SupportTicket[]
}

const priorityTone: Record<SupportTicket['priority'], ChipTone> = { Düşük: 'neutral', Orta: 'warning', Acil: 'danger' }
const statusTone: Record<SupportTicket['status'], ChipTone> = { open: 'warning', in_progress: 'info', closed: 'success' }
const statusLabels = { open: 'Açık', in_progress: 'İşlemde', closed: 'Kapandı' }

export default function SupportTicketsList({ userId, initialTickets }: SupportTicketsListProps) {
  const supabase = useSupabaseClient()
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Formdan yeni oluşturulan talep üst bileşenden gelir; realtime beklemeden listeye eklenir.
  useEffect(() => {
    setTickets((prev) => {
      const known = new Set(prev.map((t) => t.id))
      const added = initialTickets.filter((t) => !known.has(t.id))
      return added.length > 0 ? [...added, ...prev] : prev
    })
  }, [initialTickets])

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel(`user-support-tickets-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            // Fetch updated ticket
            const { data: updatedTicket } = await supabase
              .from('support_tickets')
              .select('*')
              .eq('id', payload.new.id)
              .single()

            if (updatedTicket) {
              const updated = updatedTicket as SupportTicket
              setTickets((prev) => {
                const existingIndex = prev.findIndex((t) => t.id === updated.id)
                if (existingIndex >= 0) {
                  const newTickets = [...prev]
                  newTickets[existingIndex] = updated
                  return newTickets
                } else {
                  return [updated, ...prev]
                }
              })
              
              // Açık olan talep güncellendiyse detay da güncellenir
              setSelectedTicket((prev) => (prev && prev.id === updated.id ? updated : prev))
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('tr-TR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  const getTicketNumber = (ticket: SupportTicket) => ticketCode(ticket.id)

  if (tickets.length === 0) {
    return null
  }

  const close = () => {
    setIsModalOpen(false)
    setSelectedTicket(null)
  }

  return (
    <Card>
      <CardHeader title="Taleplerin" description="Gönderdiğin destek talepleri ve yanıtları" />
      {tickets.map((ticket) => (
        <ListRow key={ticket.id} className="p-0">
          <button
            type="button"
            onClick={() => {
              setSelectedTicket(ticket)
              setIsModalOpen(true)
            }}
            className="flex w-full flex-col gap-1.5 px-5 py-3 text-left"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold tabular-nums text-gold">#{getTicketNumber(ticket)}</span>
              <span className="text-[14px] text-ink">{ticket.subject}</span>
              <Chip tone={statusTone[ticket.status]} dot>{statusLabels[ticket.status]}</Chip>
              <Chip tone={priorityTone[ticket.priority]}>{ticket.priority}</Chip>
              {ticket.admin_response && (
                <Chip tone="gold">
                  <MessageSquare className="h-3 w-3" aria-hidden />
                  Yanıtlandı
                </Chip>
              )}
            </div>
            <p className="line-clamp-1 text-[12.5px] text-ink-muted">{ticket.message}</p>
            <p className="text-[11.5px] text-ink-faint">{formatDate(ticket.created_at)}</p>
          </button>
        </ListRow>
      ))}

      <Modal
        open={isModalOpen && !!selectedTicket}
        onClose={close}
        size="lg"
        title={selectedTicket ? `#${getTicketNumber(selectedTicket)} · ${selectedTicket.subject}` : ''}
        description={selectedTicket ? formatDate(selectedTicket.created_at) : undefined}
      >
        {selectedTicket && (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Chip tone={statusTone[selectedTicket.status]} dot>{statusLabels[selectedTicket.status]}</Chip>
              <Chip tone={priorityTone[selectedTicket.priority]}>Öncelik: {selectedTicket.priority}</Chip>
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">Talebin</p>
              <p className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2 p-3.5 text-[13.5px] text-ink">{selectedTicket.message}</p>
            </div>
            <div>
              <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-ink-faint">Destek ekibinin yanıtı</p>
              {selectedTicket.admin_response ? (
                <p className="whitespace-pre-wrap rounded-xl border border-gold/30 bg-gold/5 p-3.5 text-[13.5px] text-ink">{selectedTicket.admin_response}</p>
              ) : (
                <Notice tone="info">Henüz yanıtlanmadı. Yanıt geldiğinde burada görünür.</Notice>
              )}
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}
