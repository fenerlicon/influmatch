'use client'

import { useState, useCallback } from 'react'
import SupportTicketForm from './SupportTicketForm'
import SupportTicketsList from './SupportTicketsList'

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

interface SupportSectionProps {
  userId: string
  initialTickets: SupportTicket[]
}

export default function SupportSection({ userId, initialTickets }: SupportSectionProps) {
  const [tickets, setTickets] = useState<SupportTicket[]>(initialTickets)

  const handleTicketCreated = useCallback((newTicket: SupportTicket) => {
    setTickets((prev) => [newTicket, ...prev])
  }, [])

  return (
    <div className="grid gap-5">
      <SupportTicketForm onTicketCreated={handleTicketCreated} />

      {tickets.length > 0 && <SupportTicketsList userId={userId} initialTickets={tickets} />}
    </div>
  )
}

