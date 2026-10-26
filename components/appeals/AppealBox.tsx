'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MessageSquareWarning, Paperclip, X } from 'lucide-react'
import { requestAppealUploadUrl, submitAppeal } from '@/app/actions/appeals'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { Button, Chip, Field, Textarea, type ChipTone } from '@/components/ui'
import {
  APPEAL_FILES_BUCKET,
  APPEAL_FILE_MAX_BYTES,
  APPEAL_TEXT_MAX,
  appealFileExtension,
  type AppealStatus,
  type DecisionView,
} from '@/lib/moderation-shared'

const STATUS_TONE: Record<AppealStatus, ChipTone> = { open: 'warning', accepted: 'success', rejected: 'danger' }
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

/**
 * Ret nedeni + itiraz (2026-10-26). Karar başına bir itiraz; yanıtlanınca sonuç ve admin yanıtı görünür.
 * Hesap reddi ekranında, vergi levhası kartında ve görev kartında kullanılır (mobil: components/AppealCard.js).
 */
export default function AppealBox({ decision, showReason = true, className }: { decision: DecisionView; showReason?: boolean; className?: string }) {
  const router = useRouter()
  const [appeal, setAppeal] = useState(decision.appeal)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const pickFile = (picked: File | undefined) => {
    if (!picked) return
    if (!appealFileExtension(picked.name.split('.').pop()) || !ACCEPT.split(',').includes(picked.type)) {
      toast.error('Yalnızca PDF, JPG, PNG veya WEBP ekleyebilirsin.')
      return
    }
    if (picked.size > APPEAL_FILE_MAX_BYTES) {
      toast.error('Dosya en fazla 5 MB olabilir.')
      return
    }
    setFile(picked)
  }

  const send = async () => {
    let attachmentPath: string | undefined
    if (file) {
      setUploading(true)
      try {
        const upload = await requestAppealUploadUrl(appealFileExtension(file.name.split('.').pop()) ?? '')
        if (!upload.success) {
          toast.error(upload.error)
          return
        }
        const { error } = await createSupabaseBrowserClient()
          .storage.from(APPEAL_FILES_BUCKET)
          .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type })
        if (error) {
          toast.error('Dosya yüklenemedi. Ek olmadan da itiraz edebilirsin.')
          return
        }
        attachmentPath = upload.path
      } finally {
        setUploading(false)
      }
    }
    startTransition(async () => {
      const result = await submitAppeal({ decisionId: decision.id, message, attachmentPath })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success('İtirazın alındı. Sonucu bildirimle haber vereceğiz.')
      setAppeal(result.appeal)
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className={className ?? 'grid gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-[13px]'}>
      {showReason && (
        <p className="text-ink">
          <span className="font-medium">Neden:</span> <span className="text-ink-muted">{decision.reason}</span>
          <span className="ml-1.5 text-xs text-ink-faint">({formatDate(decision.decidedAt)})</span>
        </p>
      )}

      {appeal ? (
        <div className="grid gap-1.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-ink">İtirazın</span>
            <Chip tone={STATUS_TONE[appeal.status]} dot>
              {appeal.statusLabel}
            </Chip>
            <span className="text-xs text-ink-faint">{formatDate(appeal.createdAt)}</span>
          </span>
          <p className="whitespace-pre-line text-ink-muted">{appeal.message}</p>
          {appeal.hasAttachment && <p className="text-xs text-ink-faint">Ek dosya gönderildi.</p>}
          {appeal.response && (
            <p className="rounded-lg bg-surface-1 px-3 py-2 text-ink">
              <span className="font-medium">Yanıt:</span> <span className="whitespace-pre-line text-ink-muted">{appeal.response}</span>
            </p>
          )}
          {appeal.status === 'rejected' && <p className="text-xs text-ink-faint">Bu karara yeniden itiraz edilemez.</p>}
        </div>
      ) : decision.canAppeal ? (
        open ? (
          <div className="grid gap-2.5">
            <Field label="İtirazın" hint={`${message.length} / ${APPEAL_TEXT_MAX} · Karar başına bir kez itiraz edebilirsin.`}>
              {(props) => (
                <Textarea
                  {...props}
                  rows={4}
                  maxLength={APPEAL_TEXT_MAX}
                  value={message}
                  placeholder="Kararın neden yanlış olduğunu ve varsa düzelttiğin şeyi açıkla."
                  onChange={(e) => setMessage(e.target.value)}
                />
              )}
            </Field>
            <input ref={fileRef} type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pickFile(e.target.files?.[0])} />
            {file ? (
              <span className="flex items-center gap-2 text-xs text-ink-muted">
                <Paperclip className="h-3.5 w-3.5" aria-hidden /> {file.name}
                <button type="button" aria-label="Eki kaldır" onClick={() => setFile(null)} className="text-ink-faint hover:text-ink">
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" onClick={send} loading={uploading || isPending} disabled={message.trim().length < 10}>
                İtirazı gönder
              </Button>
              {!file && (
                <Button size="sm" variant="ghost" leftIcon={<Paperclip />} onClick={() => fileRef.current?.click()} disabled={uploading || isPending}>
                  Dosya ekle (isteğe bağlı)
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={uploading || isPending}>
                Vazgeç
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button size="sm" variant="secondary" leftIcon={<MessageSquareWarning />} onClick={() => setOpen(true)}>
              Karara itiraz et
            </Button>
          </div>
        )
      ) : null}
    </div>
  )
}
