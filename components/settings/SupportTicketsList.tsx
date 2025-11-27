'use client'

import { useState, useEffect } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, X } from 'lucide-react'

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

const priorityColors = {
  Düşük: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  Orta: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  Acil: 'border-red-500/30 bg-red-500/10 text-red-300',
}

const statusColors = {
  open: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  in_progress: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  closed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
}

const statusLabels = {
  open: 'Açık',
  in_progress: 'İşlemde',
  closed: 'Kapatılmış',
}

export default function SupportTicketsList({ userId, initialTickets }: SupportTicketsListProps) {
  const supabase = useSupabaseClient()
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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
              
              // Update selected ticket if it's the one being updated
              if (selectedTicket && selectedTicket.id === updated.id) {
                setSelectedTicket(updated)
              }
            }
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, selectedTicket])

  // Close modal with ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false)
        setSelectedTicket(null)
      }
    }

    if (isModalOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isModalOpen])

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

  const getTicketNumber = (ticket: SupportTicket) => {
    const sortedTickets = [...tickets].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    const index = sortedTickets.findIndex((t) => t.id === ticket.id)
    return index + 1
  }

  if (tickets.length === 0) {
    return null
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-2">
          <FileText className="h-5 w-5 text-soft-gold" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Açılan Talepler</h2>
          <p className="mt-1 text-sm text-gray-400">Gönderdiğiniz destek talepleriniz ve yanıtları</p>
        </div>
      </div>

      <div className="space-y-3">
        {tickets.map((ticket) => {
          const ticketNumber = getTicketNumber(ticket)
          return (
            <div
              key={ticket.id}
              onClick={() => {
                setSelectedTicket(ticket)
                setIsModalOpen(true)
              }}
              className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-semibold text-soft-gold">#{ticketNumber}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${
                        priorityColors[ticket.priority]
                      }`}
                    >
                      {ticket.priority}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${
                        statusColors[ticket.status]
                      }`}
                    >
                      {statusLabels[ticket.status]}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{ticket.subject}</h3>
                  <p className="text-xs text-gray-400 line-clamp-2 mb-2">{ticket.message}</p>
                  {ticket.admin_response && (
                    <div className="mt-3 rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="h-3 w-3 text-soft-gold" />
                        <span className="text-xs font-semibold text-soft-gold">Admin Yanıtı Var</span>
                      </div>
                      <p className="text-xs text-gray-300 line-clamp-2">{ticket.admin_response}</p>
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    <span>{formatDate(ticket.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalOpen(false)
              setSelectedTicket(null)
            }
          }}
        >
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#131421] to-[#090a0f] p-6 shadow-glow max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false)
                setSelectedTicket(null)
              }}
              className="absolute right-4 top-4 rounded-xl border border-white/10 bg-white/5 p-2 text-white transition hover:border-white/20 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="mb-6 pr-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-xl border border-soft-gold/30 bg-soft-gold/10 p-2">
                  <FileText className="h-5 w-5 text-soft-gold" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-lg font-semibold text-soft-gold">
                      #{getTicketNumber(selectedTicket)}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${
                        priorityColors[selectedTicket.priority]
                      }`}
                    >
                      {selectedTicket.priority}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium uppercase ${
                        statusColors[selectedTicket.status]
                      }`}
                    >
                      {statusLabels[selectedTicket.status]}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-white">{selectedTicket.subject}</h2>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                    <Clock className="h-4 w-4" />
                    <span>{formatDate(selectedTicket.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Question Section */}
            <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-soft-gold" />
                <h3 className="text-base font-semibold text-soft-gold">Sorunuz</h3>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedTicket.message}
              </p>
            </div>

            {/* Admin Response Section */}
            {selectedTicket.admin_response ? (
              <div className="rounded-2xl border border-soft-gold/30 bg-soft-gold/10 p-6">
                <div className="mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-soft-gold" />
                  <h3 className="text-base font-semibold text-soft-gold">Admin Yanıtı</h3>
                </div>
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.admin_response}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  <p className="text-sm text-yellow-300">
                    Henüz yanıtlanmadı. Yanıtlandığında burada görünecektir.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

