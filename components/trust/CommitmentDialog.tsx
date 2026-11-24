'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Modal, Notice } from '@/components/ui'
import { acceptCommitmentAction } from '@/app/dashboard/collaborations/trust-actions'
import { COMMITMENT_CHECKBOX_LABEL, COMMITMENT_REQUIRED_ERROR, COMMITMENT_TEXT, COMMITMENT_VERSION } from '@/lib/collaboration-trust-shared'

const OPEN_EVENT = 'influmatch:commitment-required'
const SEEN_KEY = 'im_commitment_prompt_seen'

/** Taahhüt penceresini açar (ör. sunucu COMMITMENT_REQUIRED_ERROR döndürdüğünde). */
export function openCommitmentDialog() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Sunucu hatası taahhüt eksikliğiyse pencereyi açar ve true döner. */
export function handleCommitmentError(error: string | null | undefined): boolean {
  if (error !== COMMITMENT_REQUIRED_ERROR) return false
  openCommitmentDialog()
  return true
}

/**
 * Marka taahhüdü (2026-11-23; ilk ilan ya da ilk tekliften önce bir kez). Panel kabuğunda, yalnızca taahhüdü henüz onaylamamış markaya
 * yerleştirilir. Oturumda bir kez kendiliğinden açılır ("Şimdi değil" ile kapanır); teklif / ilan gönderiminde sunucu taahhüt isterse yeniden açılır.
 * Kayıt sunucuda (metin sürümü + zaman); ilan ve teklif oluşturma sunucuda ve veritabanında taahhüt olmadan reddedilir.
 */
export default function CommitmentDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    const show = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, show)
    try {
      if (!window.sessionStorage.getItem(SEEN_KEY)) {
        window.sessionStorage.setItem(SEEN_KEY, '1')
        setOpen(true)
      }
    } catch {
      // Depolama kapalıysa yalnızca olayla açılır.
    }
    return () => window.removeEventListener(OPEN_EVENT, show)
  }, [])

  const accept = () =>
    start(async () => {
      setError(null)
      const result = await acceptCommitmentAction({ accepted: checked, version: COMMITMENT_VERSION })
      if (!result.success) {
        setError(result.error)
        return
      }
      setOpen(false)
      toast.success('Taahhüt kaydedildi. Artık ilan açıp teklif gönderebilirsin.')
      router.refresh()
    })

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      dismissible={!pending}
      title="İş birliği taahhüdü"
      description="İlk ilanını açmadan ya da ilk teklifini göndermeden önce bir kez onaylaman gerekiyor."
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
            Şimdi değil
          </Button>
          <Button variant="primary" loading={pending} disabled={!checked} onClick={accept}>
            Onayla
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="flex gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-gold" aria-hidden />
          <p className="text-[13.5px] leading-relaxed text-ink">{COMMITMENT_TEXT}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink">
          <input type="checkbox" className="h-4 w-4 accent-gold" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          {COMMITMENT_CHECKBOX_LABEL}
        </label>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  )
}
