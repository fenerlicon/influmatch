'use client'

import { useState, useEffect, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { updateSupportTicketStatus, addAdminResponse } from '@/app/admin/support/actions'
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  User,
  Calendar,
  Send,
  X,
  Eye,
} from 'lucide-react'

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

export default function SupportTicketsPanel({ initialTickets }: SupportTicketsPanelProps) {
  const supabase = useSupabaseClient()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [adminResponse, setAdminResponse] = useState('')
  const [isPending, startTransition] = useTransition()

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
                  email,
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
                  newTickets[existingIndex] = updatedTicket as unknown as SupportTicket
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
      if (result.success) {
        setTickets((prev) =>
          prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket)),
        )
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null))
        }
      }
    })
  }

  const handleSendResponse = (ticketId: string) => {
    if (!adminResponse.trim()) return

    startTransition(async () => {
      const result = await addAdminResponse(ticketId, adminResponse.trim())
      if (result.success) {
        setTickets((prev) =>
          prev.map((ticket) =>
            ticket.id === ticketId ? { ...ticket, admin_response: adminResponse.trim() } : ticket,
          ),
        )
        if (selectedTicket?.id === ticketId) {
          setSelectedTicket((prev) => (prev ? { ...prev, admin_response: adminResponse.trim() } : null))
        }
        setAdminResponse('')
      }
    })
  }

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
    const userTickets = tickets
      .filter((t) => t.user_id === ticket.user_id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const index = userTickets.findIndex((t) => t.id === ticket.id)
    return index + 1
  }

  return (
    <main className="min-h-screen bg-background px-6 py-24 md:px-12 lg:px-24">
      <div className="mx-auto max-w-7xl">
        <div className="glass-panel rounded-[32px] p-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-soft-gold">Admin Paneli</p>
              <h1 className="mt-4 text-3xl font-semibold text-white">Destek Talepleri</h1>
              <p className="mt-2 text-gray-300">Kullanıcıların gönderdiği destek taleplerini inceleyin ve yönetin.</p>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-soft-gold hover:text-soft-gold"
            >
              <ArrowLeft className="h-4 w-4" /> Hesap Yönetimi
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-[#0c0d13] p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              const count =
                tab.key === 'all'
                  ? tickets.length
                  : tickets.filter((t) => t.status === tab.key).length
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${isActive
                    ? 'bg-soft-gold/20 text-soft-gold shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                    : 'text-gray-400 hover:text-white'
                    }`}
                >
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Tickets List */}
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {/* Left: Tickets List */}
            <div className="lg:col-span-1 space-y-4 max-h-[600px] overflow-y-auto">
              {filteredTickets.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-gray-400">
                  <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>Destek talebi bulunamadı.</p>
                </div>
              ) : (
                filteredTickets.map((ticket) => {
                  const ticketNumber = getTicketNumber(ticket)
                  const isSelected = selectedTicket?.id === ticket.id
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${isSelected
                        ? 'border-soft-gold/60 bg-soft-gold/10 shadow-[0_0_20px_rgba(212,175,55,0.25)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-semibold text-soft-gold">#{ticketNumber}</span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${priorityColors[ticket.priority]
                                }`}
                            >
                              {ticket.priority}
                            </span>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase ${statusColors[ticket.status]
                                }`}
                            >
                              {statusLabels[ticket.status]}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-white line-clamp-1">{ticket.subject}</p>
                          <p className="mt-1 text-xs text-gray-400 line-clamp-1">{ticket.message}</p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                            <User className="h-3 w-3" />
                            <span className="truncate">
                              {ticket.users?.full_name ?? ticket.users?.email ?? 'Kullanıcı'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{formatDate(ticket.created_at)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>

            {/* Right: Ticket Detail */}
            <div className="lg:col-span-2">
              {selectedTicket ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="mb-6 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-lg font-semibold text-soft-gold">#{getTicketNumber(selectedTicket)}</span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase ${priorityColors[selectedTicket.priority]
                            }`}
                        >
                          {selectedTicket.priority}
                        </span>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium uppercase ${statusColors[selectedTicket.status]
                            }`}
                        >
                          {statusLabels[selectedTicket.status]}
                        </span>
                      </div>
                      <h2 className="text-2xl font-semibold text-white">{selectedTicket.subject}</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(null)}
                      className="rounded-lg border border-white/20 bg-black/60 p-2 text-gray-400 transition hover:border-white/40 hover:text-white"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* User Info */}
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-3">
                      {selectedTicket.users?.avatar_url ? (
                        <Image
                          src={selectedTicket.users.avatar_url}
                          alt={selectedTicket.users.full_name ?? 'Kullanıcı'}
                          width={48}
                          height={48}
                          className="rounded-xl border border-white/10"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-lg font-semibold text-soft-gold">
                          {(selectedTicket.users?.full_name?.[0] ?? selectedTicket.users?.email?.[0] ?? 'U').toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">
                          {selectedTicket.users?.full_name ?? 'Kullanıcı'}
                        </p>
                        <p className="text-xs text-gray-400">{selectedTicket.users?.email}</p>
                        {selectedTicket.users?.username && (
                          <p className="text-xs text-gray-500">@{selectedTicket.users.username}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.2em] text-soft-gold">Mesaj</p>
                    <p className="whitespace-pre-wrap text-sm text-gray-200">{selectedTicket.message}</p>
                  </div>

                  {/* File */}
                  {selectedTicket.file_url && (
                    <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-soft-gold">Ekli Dosya</p>
                      <a
                        href={selectedTicket.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 transition hover:border-soft-gold/50 hover:text-soft-gold"
                      >
                        <Eye className="h-4 w-4" />
                        Görüntüyü Aç
                      </a>
                    </div>
                  )}

                  {/* Admin Response */}
                  {selectedTicket.admin_response && (
                    <div className="mb-6 rounded-2xl border border-soft-gold/30 bg-soft-gold/10 p-4">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-soft-gold">Admin Yanıtı</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-200">{selectedTicket.admin_response}</p>
                    </div>
                  )}

                  {/* Admin Response Form */}
                  <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <label htmlFor="adminResponse" className="mb-2 block text-xs uppercase tracking-[0.2em] text-soft-gold">
                      Yanıt Ekle / Güncelle
                    </label>
                    <textarea
                      id="adminResponse"
                      value={adminResponse}
                      onChange={(e) => setAdminResponse(e.target.value)}
                      disabled={isPending}
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 transition focus:border-soft-gold/50 focus:outline-none focus:ring-2 focus:ring-soft-gold/20 disabled:opacity-50 resize-none"
                      placeholder="Kullanıcıya yanıt yazın..."
                    />
                    <button
                      type="button"
                      onClick={() => handleSendResponse(selectedTicket.id)}
                      disabled={isPending || !adminResponse.trim()}
                      className="mt-3 flex items-center gap-2 rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      Yanıtı Kaydet
                    </button>
                  </div>

                  {/* Status Actions */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedTicket.id, 'open')}
                      disabled={isPending || selectedTicket.status === 'open'}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${selectedTicket.status === 'open'
                        ? 'border-yellow-500/60 bg-yellow-500/20 text-yellow-300'
                        : 'border-white/10 bg-white/5 text-white hover:border-white/20'
                        }`}
                    >
                      Açık
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedTicket.id, 'in_progress')}
                      disabled={isPending || selectedTicket.status === 'in_progress'}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${selectedTicket.status === 'in_progress'
                        ? 'border-blue-500/60 bg-blue-500/20 text-blue-300'
                        : 'border-white/10 bg-white/5 text-white hover:border-white/20'
                        }`}
                    >
                      İşlemde
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedTicket.id, 'closed')}
                      disabled={isPending || selectedTicket.status === 'closed'}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${selectedTicket.status === 'closed'
                        ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-white hover:border-white/20'
                        }`}
                    >
                      Kapat
                    </button>
                  </div>

                  {/* Timestamps */}
                  <div className="mt-6 flex gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>Oluşturulma: {formatDate(selectedTicket.created_at)}</span>
                    </div>
                    {selectedTicket.updated_at !== selectedTicket.created_at && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        <span>Güncelleme: {formatDate(selectedTicket.updated_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[400px] items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
                  <div>
                    <FileText className="mx-auto h-12 w-12 mb-4 text-gray-400 opacity-50" />
                    <p className="text-gray-400">Bir destek talebi seçin</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

