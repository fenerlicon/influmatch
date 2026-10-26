'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { CheckCircle, Clock, FileUp, XCircle } from 'lucide-react'
import { Button, Notice } from '@/components/ui'
import { requestTaxUploadUrl, submitTaxCertificate } from '@/app/dashboard/brand/profile/tax-actions'
import AppealBox from '@/components/appeals/AppealBox'
import type { DecisionView } from '@/lib/moderation-shared'

export interface TaxVerificationSummary {
  id?: string
  status: 'processing' | 'auto_approved' | 'needs_review' | 'approved' | 'rejected'
  reasons: string[] | null
  created_at: string
}

interface TaxCertificateUploadProps {
  userId?: string
  taxIdVerified: boolean
  /** Vergi no, daire ve il kaydedilmiş ve geçerli mi */
  canSubmit: boolean
  latest: TaxVerificationSummary | null
  /** Bu levhanın admin ret kararı + itiraz durumu (2026-10-26). */
  decision?: DecisionView | null
}

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const STATUS_VIEW: Record<TaxVerificationSummary['status'], { title: string; tone: 'warning' | 'success' | 'danger'; Icon: typeof Clock }> = {
  processing: { title: 'İnceleniyor', tone: 'warning', Icon: Clock },
  needs_review: { title: 'Ekibimiz inceliyor', tone: 'warning', Icon: Clock },
  auto_approved: { title: 'Vergi levhanız doğrulandı', tone: 'success', Icon: CheckCircle },
  approved: { title: 'Vergi levhanız doğrulandı', tone: 'success', Icon: CheckCircle },
  rejected: { title: 'Belge kabul edilmedi', tone: 'danger', Icon: XCircle },
}

export default function TaxCertificateUpload({ userId, taxIdVerified, canSubmit, latest, decision = null }: TaxCertificateUploadProps) {
  const supabase = useSupabaseClient()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isWorking, setIsWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<TaxVerificationSummary | null>(latest)
  const [submittedNow, setSubmittedNow] = useState(false)

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return
    setError(null)

    if (!ACCEPTED.includes(file.type)) return setError('Sadece PDF, JPG, PNG veya WEBP yükleyebilirsiniz.')
    if (file.size > MAX_BYTES) return setError('Belge en fazla 5 MB olabilir.')

    setIsWorking(true)
    try {
      const extension = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1].replace('jpeg', 'jpg')
      // Yükleme yalnızca sunucunun verdiği imzalı adresle (günlük sınır orada kontrol edilir).
      const upload = await requestTaxUploadUrl(extension)
      if (!upload.success) {
        setError(upload.error)
        return
      }
      const path = upload.path
      const { error: uploadError } = await supabase.storage
        .from('tax-documents')
        .uploadToSignedUrl(path, upload.token, file, { contentType: file.type })
      if (uploadError) {
        setError('Belge yüklenemedi. Lütfen tekrar deneyin.')
        return
      }

      const result = await submitTaxCertificate(path)
      if (!result.success) {
        setError(result.error)
        return
      }
      setCurrent({ status: result.status, reasons: result.reasons, created_at: new Date().toISOString() })
      setSubmittedNow(true)
      router.refresh()
    } catch (err) {
      console.error('Tax certificate upload failed:', err)
      setError('Belge işlenirken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setIsWorking(false)
    }
  }

  // Onaylı levha sonrası yasal bilgiler değiştiyse onay düşmüştür; eski "doğrulandı" sonucu gösterilmez.
  const isApproved = current?.status === 'approved' || current?.status === 'auto_approved'
  const approvedButReset = !submittedNow && !taxIdVerified && isApproved
  const verified = taxIdVerified || (submittedNow && isApproved)
  const shown = approvedButReset ? null : current
  const view = shown ? STATUS_VIEW[shown.status] : null
  const showUpload = !verified && shown?.status !== 'processing'

  return (
    <div className="grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
      <div>
        <p className="text-[14px] font-medium text-ink">Vergi levhası</p>
        <p className="mt-1 text-xs text-ink-faint">
          e-Devlet veya GİB İnternet Vergi Dairesi&apos;nden indirdiğiniz vergi levhası PDF&apos;ini yükleyin. Belgeniz otomatik
          kontrol edilir; ekibimiz onayladığında ve kurumsal e-postanız doğrulandığında &quot;Resmi İşletme&quot; rozeti verilir. Fotoğraf ve taramalar da kabul edilir
          ancak incelemesi daha uzun sürebilir.
        </p>
      </div>

      {view && shown && !(verified && shown.status === 'rejected') && (
        <Notice tone={view.tone} icon={view.Icon} title={view.title}>
          {shown.status !== 'auto_approved' && shown.status !== 'approved' && (shown.reasons?.length ?? 0) > 0 ? shown.reasons!.join(' · ') : null}
        </Notice>
      )}

      {decision && shown?.id && decision.subjectId === shown.id && !verified && (decision.canAppeal || decision.appeal) && (
        <AppealBox decision={decision} showReason={false} />
      )}

      {showUpload && (
        <div className="grid gap-2">
          <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="sr-only" onChange={handleFile} />
          <div>
            <Button onClick={() => inputRef.current?.click()} loading={isWorking} disabled={!canSubmit || !userId} leftIcon={<FileUp />}>
              {isWorking ? 'Belge kontrol ediliyor…' : shown ? 'Yeni belge yükle' : 'Vergi levhası yükle'}
            </Button>
          </div>
          {!canSubmit && <p className="text-xs text-ink-faint">Önce resmi unvan, vergi numarası, vergi dairesi ve ili kaydedin.</p>}
          <p className="text-[11px] text-ink-faint">
            Belgeniz sadece Influmatch sunucularında kontrol edilir; yapay zeka servislerine veya üçüncü taraflara gönderilmez.
            İnceleme için güvenli bir alanda saklanır.
          </p>
        </div>
      )}

      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
