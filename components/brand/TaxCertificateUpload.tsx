'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { AlertCircle, CheckCircle, Clock, FileUp, Loader2, XCircle } from 'lucide-react'
import { requestTaxUploadUrl, submitTaxCertificate } from '@/app/dashboard/brand/profile/tax-actions'

export interface TaxVerificationSummary {
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
}

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const STATUS_VIEW: Record<TaxVerificationSummary['status'], { title: string; className: string; Icon: typeof Clock }> = {
  processing: { title: 'İnceleniyor', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200', Icon: Clock },
  needs_review: { title: 'Ekibimiz inceliyor', className: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200', Icon: Clock },
  auto_approved: { title: 'Vergi levhanız doğrulandı', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', Icon: CheckCircle },
  approved: { title: 'Vergi levhanız doğrulandı', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200', Icon: CheckCircle },
  rejected: { title: 'Belge kabul edilmedi', className: 'border-red-500/40 bg-red-500/10 text-red-200', Icon: XCircle },
}

export default function TaxCertificateUpload({ userId, taxIdVerified, canSubmit, latest }: TaxCertificateUploadProps) {
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
    <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div>
        <p className="text-sm font-semibold text-white">Vergi Levhası</p>
        <p className="mt-1 text-xs text-gray-400">
          e-Devlet veya GİB İnternet Vergi Dairesi&apos;nden indirdiğiniz vergi levhası PDF&apos;ini yükleyin. Belgeniz otomatik
          kontrol edilir; ekibimiz onayladığında ve kurumsal e-postanız doğrulandığında &quot;Resmi İşletme&quot; rozeti verilir. Fotoğraf ve taramalar da kabul edilir
          ancak incelemesi daha uzun sürebilir.
        </p>
      </div>

      {view && shown && !(verified && shown.status === 'rejected') && (
        <div className={`rounded-xl border p-3 text-sm ${view.className}`}>
          <p className="flex items-center gap-2 font-semibold">
            <view.Icon className="h-4 w-4" /> {view.title}
          </p>
          {shown.status !== 'auto_approved' && shown.status !== 'approved' && (shown.reasons?.length ?? 0) > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs opacity-90">
              {shown.reasons!.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showUpload && (
        <>
          <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="hidden" onChange={handleFile} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isWorking || !canSubmit || !userId}
            className="inline-flex items-center gap-2 rounded-xl border border-soft-gold/60 bg-soft-gold/10 px-4 py-2 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {isWorking ? 'Belge kontrol ediliyor...' : shown ? 'Yeni belge yükle' : 'Vergi levhası yükle'}
          </button>
          {!canSubmit && (
            <p className="text-xs text-gray-400">Önce resmi unvan, vergi numarası, vergi dairesi ve ili kaydedin.</p>
          )}
          <p className="text-[11px] text-gray-500">
            Belgeniz sadece Influmatch sunucularında kontrol edilir; yapay zeka servislerine veya üçüncü taraflara gönderilmez.
            İnceleme için güvenli bir alanda saklanır.
          </p>
        </>
      )}

      {error && (
        <p className="flex items-start gap-2 text-xs text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
