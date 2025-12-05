'use client'

import { useState, useTransition } from 'react'
import { Flag, Ban, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'
import { reportMessage, type ReportMessagePayload } from '@/app/dashboard/messages/report/actions'
import { blockUser } from '@/app/dashboard/users/block/actions'

interface MessageActionsMenuProps {
  messageId: string
  senderId: string
  roomId: string
  currentUserId: string
  onBlocked?: () => void
}

export default function MessageActionsMenu({
  messageId,
  senderId,
  roomId,
  currentUserId,
  onBlocked,
}: MessageActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isReporting, startReportTransition] = useTransition()
  const [isBlocking, startBlockTransition] = useTransition()
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState<ReportMessagePayload['reason']>('harassment')
  const [reportDescription, setReportDescription] = useState('')

  if (senderId === currentUserId) {
    return null // Don't show actions for own messages
  }

  const handleReport = () => {
    setShowReportModal(true)
    setIsOpen(false)
  }

  const handleSubmitReport = () => {
    if (!reportReason) return

    startReportTransition(async () => {
      const result = await reportMessage({
        messageId,
        reportedUserId: senderId,
        roomId,
        reason: reportReason,
        description: reportDescription || undefined,
      })

      if (result.success) {
        toast.success('Mesaj başarıyla rapor edildi. İnceleme için teşekkürler.')
        setShowReportModal(false)
        setReportDescription('')
        setReportReason('harassment')
      } else {
        toast.error(result.error || 'Rapor gönderilemedi. Lütfen tekrar deneyin.')
      }
    })
  }

  const handleBlock = () => {
    // Custom toast for confirmation or just execute? 
    // Usually a confirm dialog is good, but native confirm is ugly. 
    // For now keep native confirm but use toast for result.
    if (!confirm('Bu kullanıcıyı engellemek istediğinizden emin misiniz? Engellediğiniz kullanıcı size mesaj gönderemez.')) {
      return
    }

    startBlockTransition(async () => {
      const result = await blockUser(senderId)

      if (result.success) {
        toast.success('Kullanıcı engellendi.')
        setIsOpen(false)
        onBlocked?.()
      } else {
        toast.error(result.error || 'Kullanıcı engellenemedi. Lütfen tekrar deneyin.')
      }
    })
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Mesaj işlemleri"
        >
          <MoreVertical className="h-4 w-4" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute left-full top-full ml-2 z-20 min-w-[180px] rounded-2xl border border-white/10 bg-[#0B0C10] shadow-lg">
              <button
                type="button"
                onClick={handleReport}
                disabled={isReporting}
                className="flex w-full items-center gap-2 rounded-t-2xl px-4 py-2.5 text-left text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                <Flag className="h-4 w-4 text-red-400" />
                Mesajı Rapor Et
              </button>
              <button
                type="button"
                onClick={handleBlock}
                disabled={isBlocking}
                className="flex w-full items-center gap-2 rounded-b-2xl px-4 py-2.5 text-left text-sm text-white transition hover:bg-white/10 disabled:opacity-50"
              >
                <Ban className="h-4 w-4 text-orange-400" />
                Kullanıcıyı Engelle
              </button>
            </div>
          </>
        )}
      </div>

      {showReportModal && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowReportModal(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-40 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0B0C10] p-6 text-white shadow-2xl">
            <h3 className="mb-4 text-lg font-semibold">Mesajı Rapor Et</h3>
            <p className="mb-4 text-sm text-gray-400">
              Bu mesajı neden rapor ediyorsunuz? Raporunuz moderatörler tarafından incelenecektir.
            </p>

            <div className="mb-4 space-y-2">
              <label className="block text-sm font-medium text-gray-300">Sebep</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ReportMessagePayload['reason'])}
                className="w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-2.5 text-sm text-white outline-none transition focus:border-soft-gold"
              >
                <option value="harassment">Taciz / Rahatsız Edici</option>
                <option value="spam">Spam</option>
                <option value="inappropriate">Uygunsuz İçerik</option>
                <option value="illegal">Yasadışı İçerik</option>
                <option value="other">Diğer</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">Açıklama (İsteğe bağlı)</label>
              <textarea
                value={reportDescription}
                onChange={(e) => setReportDescription(e.target.value)}
                placeholder="Ek bilgi ekleyebilirsiniz..."
                rows={3}
                className="w-full rounded-2xl border border-white/10 bg-[#11121A] px-4 py-2.5 text-sm text-white outline-none transition focus:border-soft-gold resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/10"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSubmitReport}
                disabled={isReporting || !reportReason}
                className="flex-1 rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-400 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isReporting ? 'Gönderiliyor...' : 'Rapor Et'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

