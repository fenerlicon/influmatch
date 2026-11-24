'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileDown, Paperclip, ShieldAlert, X } from 'lucide-react'
import { Button, ButtonLink, Chip, Notice, Textarea, type ChipTone } from '@/components/ui'
import { workspaceAction } from '@/app/dashboard/collaborations/[id]/actions'
import { disputeProofUploadAction, disputeProofUrlAction } from '@/app/dashboard/collaborations/trust-actions'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import {
  DISPUTE_NOTE_MAX,
  DISPUTE_PROOF_BUCKET,
  DISPUTE_PROOF_MAX_BYTES,
  proofExtension,
  type DisputeStatus,
  type PaymentProgress,
} from '@/lib/collaboration-trust-shared'
import type { WorkspaceTrust } from '@/lib/collaboration-workspace'
import type { DisputeView } from '@/lib/collaboration-disputes'

const PROGRESS_TONE: Record<PaymentProgress, ChipTone> = { none: 'neutral', awaiting_brand: 'warning', awaiting_influencer: 'info', confirmed: 'success' }
const DISPUTE_TONE: Record<DisputeStatus, ChipTone> = {
  open: 'warning',
  responded: 'info',
  resolved: 'success',
  escalated: 'danger',
  upheld: 'danger',
  dismissed: 'neutral',
  paid: 'success',
}
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'

/** Ödeme durumu çipi ve kısa uyarı (ödeme bölümünün başında). */
export function PaymentProgressRow({ trust }: { trust: WorkspaceTrust }) {
  if (!trust.enabled && trust.paymentProgress === 'none') return null
  return (
    <div className="grid gap-2">
      {trust.paymentProgress !== 'none' && (
        <div>
          <Chip tone={PROGRESS_TONE[trust.paymentProgress]} dot>
            {trust.paymentProgressLabel}
          </Chip>
        </div>
      )}
      {trust.enabled && (
        <p className="flex gap-1.5 text-xs text-ink-muted">
          <ShieldAlert className="mt-px h-3.5 w-3.5 flex-none text-gold" aria-hidden />
          {trust.warning}
        </p>
      )}
    </div>
  )
}

/**
 * Güvenli iş birliği bölümü (2026-11-23): hatırlatma geçmişi, bildirimler (anlaşmazlıklar) ve işlemleri, iş birliği kaydını indirme.
 * Yetki sunucuda (lib/collaboration-disputes.ts); düğmeler sunucunun verdiği izin listesine göre görünür.
 */
export default function CollaborationTrustPanel({ collaborationId, trust }: { collaborationId: string; trust: WorkspaceTrust }) {
  return (
    <div className="grid gap-4">
      {trust.enabled && trust.reminderBase && trust.paymentProgress === 'awaiting_brand' && (
        <p className="text-xs text-ink-faint">Markaya ödeme hatırlatmaları {formatDate(trust.reminderBase)} tarihinden itibaren 0, 3, 7 ve 14. günde gider.</p>
      )}
      {trust.reminders.length > 0 && (
        <div className="grid gap-1">
          <p className="text-[11.5px] text-ink-faint">Gönderilen hatırlatmalar</p>
          <ul className="grid gap-0.5 text-xs text-ink-muted">
            {trust.reminders.map((r) => (
              <li key={`${r.kind}-${r.step}`}>
                {formatDate(r.sentAt)} · {r.kind === 'payment_brand' ? `Markaya ödeme hatırlatması (${r.step}. gün)` : `Influencer'a teyit hatırlatması (${r.step}. gün)`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {trust.disputes.map((d) => (
        <DisputeCard key={d.id} collaborationId={collaborationId} dispute={d} />
      ))}
      <div>
        <ButtonLink href={trust.recordUrl} target="_blank" rel="noopener" size="sm" variant="ghost" leftIcon={<FileDown />}>
          İş birliği kaydını indir
        </ButtonLink>
        <p className="mt-1 text-[11.5px] text-ink-faint">Anlaşma, teslimatlar, ödeme işaretleri, olaylar ve sohbet; yazdırılabilir sayfa.</p>
      </div>
    </div>
  )
}

function DisputeCard({ collaborationId, dispute: d }: { collaborationId: string; dispute: DisputeView }) {
  const router = useRouter()
  const [form, setForm] = useState<'respond' | 'resolve' | 'escalate' | null>(null)
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const busy = pending || uploading

  const run = (payload: Record<string, unknown>) =>
    start(async () => {
      setError(null)
      const result = await workspaceAction(collaborationId, { ...payload, disputeId: d.id })
      if (!result.success) {
        setError(result.error)
        return
      }
      toast.success(result.message ?? 'Kaydedildi.')
      setForm(null)
      setNote('')
      setFile(null)
      router.refresh()
    })

  const respond = async () => {
    setError(null)
    let proofPath: string | null = null
    if (file) {
      const ext = proofExtension(file.name.split('.').pop())
      if (!ext) return setError('Yalnızca PDF, JPG, PNG ya da WEBP yüklenebilir.')
      if (file.size > DISPUTE_PROOF_MAX_BYTES) return setError('Dosya en fazla 10 MB olabilir.')
      setUploading(true)
      try {
        const signed = await disputeProofUploadAction(collaborationId, d.id, ext)
        if (!signed.success) return setError(signed.error)
        const { error: uploadError } = await createSupabaseBrowserClient().storage.from(DISPUTE_PROOF_BUCKET).uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined })
        if (uploadError) return setError('Dosya yüklenemedi. Lütfen tekrar dene.')
        proofPath = signed.path
      } finally {
        setUploading(false)
      }
    }
    run({ action: 'dispute_respond', note, proofPath })
  }

  const openProof = () =>
    start(async () => {
      const result = await disputeProofUrlAction(d.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener')
    })

  const dueText = formatDate(d.responseDueAt)
  return (
    <div className="grid gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-medium text-ink">{d.kindLabel}</p>
        <Chip tone={DISPUTE_TONE[d.status]} dot>
          {d.statusLabel}
        </Chip>
      </div>
      <div className="grid gap-1 text-xs text-ink-muted">
        <p>
          Bildirim: {formatDate(d.openedAt)}
          {d.status === 'open' ? ` · yanıt süresi ${dueText}` : ''}
        </p>
        {d.reporterNote && <p className="whitespace-pre-line">Not: {d.reporterNote}</p>}
        {d.responseNote && <p className="whitespace-pre-line">Yanıt: {d.responseNote}</p>}
        {d.respondentResolvedAt && <p>Karşı taraf {formatDate(d.respondentResolvedAt)} tarihinde çözüldüğünü bildirdi.</p>}
        {d.escalatedAt && <p>{formatDate(d.escalatedAt)} tarihinde destek ekibine taşındı.</p>}
        {d.decisionNote && <p>Karar: {d.decisionNote}</p>}
      </div>
      {d.status === 'open' && !d.viewerIsReporter && (
        <Notice tone="warning">
          {dueText} tarihine kadar {d.kind === 'nonpayment' ? 'ödeme dekontunu' : 'teslim kanıtını'} yükle ya da durumu açıkla. Yanıt verilmezse hesabın incelemeye alınır ve
          yeni {d.kind === 'nonpayment' ? 'ilan / teklif açamazsın' : 'başvuru yapamazsın'}.
        </Notice>
      )}
      <div className="flex flex-wrap gap-2">
        {d.hasProof && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={openProof} leftIcon={<Paperclip />}>
            Kanıtı aç
          </Button>
        )}
        {d.actions.includes('respond') && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => setForm(form === 'respond' ? null : 'respond')}>
            {d.kind === 'nonpayment' ? 'Dekont yükle / yanıtla' : 'Kanıt yükle / yanıtla'}
          </Button>
        )}
        {d.actions.includes('mark_resolved') && (
          <Button size="sm" disabled={busy} onClick={() => setForm(form === 'resolve' ? null : 'resolve')}>
            {d.kind === 'nonpayment' ? 'Ödendi, çözüldü' : 'Teslim edildi, çözüldü'}
          </Button>
        )}
        {d.actions.includes('confirm_resolved') && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run({ action: 'dispute_confirm_resolved' })}>
            {d.kind === 'nonpayment' ? 'Ödemeyi aldım, çözüldü' : 'Teslim aldım, çözüldü'}
          </Button>
        )}
        {d.actions.includes('escalate') && (
          <Button size="sm" variant="danger" disabled={busy} onClick={() => setForm(form === 'escalate' ? null : 'escalate')}>
            Destek ekibine taşı
          </Button>
        )}
      </div>

      {form && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (form === 'respond') void respond()
            else if (form === 'resolve') run({ action: 'dispute_mark_resolved', note })
            else run({ action: 'dispute_escalate', note })
          }}
        >
          <Textarea
            rows={3}
            maxLength={form === 'escalate' ? 500 : DISPUTE_NOTE_MAX}
            aria-label="Açıklama"
            placeholder={
              form === 'respond'
                ? 'Durumu açıkla (dosya yüklemiyorsan en az 10 karakter)'
                : form === 'resolve'
                  ? 'Kısa not (isteğe bağlı)'
                  : 'Neden çözülmedi? (isteğe bağlı)'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {form === 'respond' && (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()} leftIcon={<Paperclip />}>
                {file ? 'Dosyayı değiştir' : 'Dosya seç (PDF / görsel, en fazla 10 MB)'}
              </Button>
              {file && (
                <span className="flex items-center gap-1 text-xs text-ink-muted">
                  {file.name}
                  <button type="button" aria-label="Dosyayı kaldır" onClick={() => setFile(null)} className="text-ink-faint hover:text-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <div>
            <Button type="submit" size="sm" variant={form === 'escalate' ? 'danger' : 'primary'} loading={busy}>
              Gönder
            </Button>
          </div>
        </form>
      )}
      {!form && error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
