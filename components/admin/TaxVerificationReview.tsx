'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, ExternalLink, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getTaxDocumentUrl, rejectTaxVerification } from '@/app/admin/actions'
import type { AdminTaxVerification } from '@/lib/tax-verification'

const STATUS: Record<AdminTaxVerification['status'], { label: string; className: string }> = {
  processing: { label: 'İşleniyor', className: 'border-white/10 bg-white/5 text-gray-300' },
  needs_review: { label: 'İnceleme bekliyor', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' },
  auto_approved: { label: 'Otomatik onaylandı', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  approved: { label: 'Admin onayladı', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' },
  rejected: { label: 'Reddedildi', className: 'border-red-500/40 bg-red-500/10 text-red-300' },
}

export default function TaxVerificationReview({ verification }: { verification: AdminTaxVerification }) {
  const [current, setCurrent] = useState(verification)
  const [isPending, startTransition] = useTransition()
  const status = STATUS[current.status]
  const extracted = current.extracted

  const openDocument = () =>
    startTransition(async () => {
      const result = await getTaxDocumentUrl(current.id)
      if ('error' in result) toast.error(result.error)
      else window.open(result.url, '_blank', 'noopener,noreferrer')
    })

  const reject = () => {
    const note = prompt('Markaya gösterilecek ret sebebi:', 'Belge okunaklı değil veya bilgiler eşleşmiyor. Lütfen güncel vergi levhanızı yükleyin.')
    if (note === null) return
    startTransition(async () => {
      const result = await rejectTaxVerification(current.id, note)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      setCurrent((prev) => ({ ...prev, status: 'rejected', reasons: [note || 'Belge admin tarafından kabul edilmedi.'] }))
    })
  }

  const fields: [string, string | number | null | undefined][] = extracted
    ? [
        ['Vergi No', extracted.tax_number],
        ['Unvan', extracted.taxpayer_name],
        ['Vergi Dairesi', extracted.tax_office],
        ['İl', extracted.city],
        ['Yıl', extracted.year],
        ['Onay Kodu', extracted.approval_code],
      ]
    : []

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-gray-300">Vergi Levhası (yapay zeka kontrolü)</span>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
      </div>
      <p className="text-[10px] text-gray-500">{new Date(current.created_at).toLocaleString('tr-TR')}</p>

      {fields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="shrink-0 text-gray-500">{label}:</dt>
              <dd className="break-words text-white">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      {current.checks && (
        <ul className="space-y-1 text-xs">
          {current.checks.map((check) => (
            <li key={check.key} className="flex items-start gap-2">
              {check.passed ? (
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              )}
              <span className={check.passed ? 'text-gray-300' : 'text-red-200'}>
                {check.label} <span className="text-gray-500">({check.detail})</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {!current.checks && current.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-yellow-200">
          {current.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {extracted?.approval_code && (
        <p className="text-[10px] text-gray-500">
          e-Vergi levhası onay kodu GİB Dijital Vergi Dairesi&apos;ndeki &quot;Vergi Levhası Doğrulama&quot; ekranından elle de kontrol edilebilir.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={openDocument}
          disabled={isPending}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1 text-xs text-gray-200 transition hover:border-soft-gold hover:text-soft-gold disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
          Belgeyi Gör
        </button>
        {(current.status === 'needs_review' || current.status === 'processing') && (
          <button
            type="button"
            onClick={reject}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" /> Reddet
          </button>
        )}
      </div>
    </div>
  )
}
