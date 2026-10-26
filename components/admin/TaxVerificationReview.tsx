'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getTaxDocumentUrl, rejectTaxVerification } from '@/app/admin/actions'
import type { AdminTaxVerification } from '@/lib/tax-verification'
import { Button, Chip, type ChipTone } from '@/components/ui'
import { RejectReasonFields, isReasonReady, type RejectReasonValue } from '@/components/admin/RejectReasonDialog'

const STATUS: Record<AdminTaxVerification['status'], { label: string; tone: ChipTone }> = {
  processing: { label: 'İşleniyor', tone: 'neutral' },
  needs_review: { label: 'İnceleme gerekli', tone: 'warning' },
  auto_approved: { label: 'Kontroller geçti', tone: 'success' },
  approved: { label: 'Admin onayladı', tone: 'success' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
}

/** Vergi levhası otomatik kontrol sonucu + belgeyi açma / levhayı reddetme (admin). */
export default function TaxVerificationReview({ verification }: { verification: AdminTaxVerification }) {
  const [current, setCurrent] = useState(verification)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState<RejectReasonValue>({ code: '', text: '' })
  const [isPending, startTransition] = useTransition()
  const status = STATUS[current.status]
  const extracted = current.extracted

  const openDocument = () =>
    startTransition(async () => {
      const result = await getTaxDocumentUrl(current.id)
      if ('error' in result) toast.error(result.error)
      else window.open(result.url, '_blank', 'noopener,noreferrer')
    })

  const reject = () =>
    startTransition(async () => {
      const result = await rejectTaxVerification(current.id, reason)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      setRejecting(false)
      setCurrent((prev) => ({ ...prev, status: 'rejected', reasons: [result.reason] }))
    })

  const fields: [string, string | number | null | undefined][] = extracted
    ? [
        ['Belgedeki vergi no', extracted.tax_numbers?.join(', ') || null],
        ['En yeni yıl', extracted.year],
        ['Onay kodu', extracted.approval_code],
        ['PDF üreticisi', extracted.pdf_producer],
      ]
    : []

  return (
    <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">Vergi levhası</span>
        <Chip tone={status.tone} dot>{status.label}</Chip>
      </div>
      <p className="-mt-2 text-xs text-ink-faint">{new Date(current.created_at).toLocaleString('tr-TR')}</p>

      {fields.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
          {fields.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-ink-faint">{label}</dt>
              <dd className="break-words text-ink">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      {current.checks ? (
        <ul className="grid gap-1.5 text-[12.5px]">
          {current.checks.map((check) => (
            <li key={check.key} className="flex items-start gap-2">
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-label="Geçti" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-label="Geçmedi" />
              )}
              <span className={check.passed ? 'text-ink-muted' : 'text-danger'}>
                {check.label} <span className="text-ink-faint">({check.detail})</span>
              </span>
            </li>
          ))}
        </ul>
      ) : current.reasons.length > 0 ? (
        <ul className="list-disc pl-5 text-[12.5px] text-warning">
          {current.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {extracted?.approval_code && (
        <p className="text-xs text-ink-faint">
          Onay kodu GİB Dijital Vergi Dairesi&apos;ndeki &quot;Vergi Levhası Doğrulama&quot; ekranından elle de kontrol edilebilir.
        </p>
      )}

      {rejecting && (
        <RejectReasonFields subjectType="tax_document" value={reason} onChange={setReason} />
      )}

      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <Button size="sm" variant="danger" onClick={reject} loading={isPending} disabled={!isReasonReady(reason)}>Levhayı reddet</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={isPending}>Vazgeç</Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={openDocument} loading={isPending} leftIcon={<ExternalLink />}>Belgeyi gör</Button>
            {(current.status === 'needs_review' || current.status === 'processing') && (
              <Button size="sm" variant="danger" onClick={() => { setReason({ code: '', text: '' }); setRejecting(true) }} leftIcon={<XCircle />}>Reddet</Button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
