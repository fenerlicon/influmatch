'use client'

// Marka: "Ödemeyi yaptım ama onaylanmadı" başvurusu (2026-11-24). Influencer "Ödeme yapıldı" işaretinden sonraki 24 saatte
// teyit etmediyse marka dekontu yükler; başvuru destek ekibine gider (lib/collaboration-disputes.ts claimPayment).

import { useState } from 'react'
import { Button, Field, Input, Notice, Textarea } from '@/components/ui'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { claimProofUploadAction } from '@/app/dashboard/collaborations/trust-actions'
import { DISPUTE_PROOF_BUCKET, DISPUTE_PROOF_MAX_BYTES, proofExtension } from '@/lib/collaboration-trust-shared'

export default function PaymentClaimForm({
  collaborationId,
  busy,
  run,
}: {
  collaborationId: string
  busy: boolean
  run: (payload: Record<string, unknown>) => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    if (!file) return setError('Ödeme dekontunu yükleyin.')
    const ext = proofExtension(file.name.split('.').pop())
    if (!ext) return setError('Yalnızca PDF, JPG, PNG ya da WEBP yüklenebilir.')
    if (file.size > DISPUTE_PROOF_MAX_BYTES) return setError('Dosya en fazla 10 MB olabilir.')
    setUploading(true)
    try {
      const signed = await claimProofUploadAction(collaborationId, ext)
      if (!signed.success) return setError(signed.error)
      const { error: uploadError } = await createSupabaseBrowserClient()
        .storage.from(DISPUTE_PROOF_BUCKET)
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type || undefined })
      if (uploadError) return setError('Dosya yüklenemedi. Lütfen tekrar deneyin.')
      run({ action: 'claim_payment', proofPath: signed.path, note })
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="text-xs text-ink-muted">
        Dekontunuz destek ekibine iletilir, influencer da bilgilendirilir. Ekip iki tarafın kayıtlarına bakıp karar verir; ödeme doğrulanırsa
        teslim dosyalarının indirilmesi açılır.
      </p>
      <Field label="Ödeme dekontu" hint="PDF, JPG, PNG ya da WEBP; en fazla 10 MB">
        {(props) => <Input {...props} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
      </Field>
      <Textarea rows={2} maxLength={500} aria-label="Açıklama" placeholder="Kısa açıklama (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <Notice tone="danger">{error}</Notice>}
      <div>
        <Button type="submit" size="sm" variant="primary" loading={busy || uploading}>
          Destek ekibine başvur
        </Button>
      </div>
    </form>
  )
}
