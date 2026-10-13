'use client'

import { useState, useTransition } from 'react'
import { Hourglass, Mail, UserRoundPlus } from 'lucide-react'
import { toast } from 'sonner'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { Button, ButtonLink, Notice, type NoticeTone } from '@/components/ui'

// Panelin üstündeki bantların yerine tek bildirim alanı (docs/REDESIGN.md).
// Öncelik sırası sunucuda belirlenir; en önemlisi görünür, diğerleri "+N bildirim" ile açılır.
export type ShellNotice =
  | { kind: 'email_unconfirmed'; email: string }
  | { kind: 'social_missing'; profileHref: string }
  | { kind: 'verification_pending' }

function ResendEmailButton({ email }: { email: string }) {
  const supabase = useSupabaseClient()
  const [pending, start] = useTransition()
  const resend = () =>
    start(async () => {
      try {
        const { error } = await supabase.auth.resend({ type: 'signup', email })
        if (!error) {
          toast.success('Doğrulama e-postası tekrar gönderildi.')
          return
        }
        const msg = error.message?.toLowerCase() ?? ''
        const limited = ['rate limit', 'too many requests', 'exceeded', 'seconds'].some((k) => msg.includes(k))
        toast.error(limited ? 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.' : 'E-posta gönderilemedi. Lütfen tekrar deneyin.')
      } catch {
        toast.error('Bir hata oluştu. Lütfen tekrar deneyin.')
      }
    })
  return (
    <Button size="sm" onClick={resend} loading={pending}>
      Tekrar gönder
    </Button>
  )
}

function render(n: ShellNotice, meta?: React.ReactNode) {
  const common: { meta?: React.ReactNode } = { meta }
  switch (n.kind) {
    case 'email_unconfirmed':
      return (
        <Notice key={n.kind} tone="warning" icon={Mail} title="E-posta adresini doğrula." action={<ResendEmailButton email={n.email} />} {...common}>
          Hesabının güvenliği ve bildirimler için gerekli.
        </Notice>
      )
    case 'social_missing':
      return (
        <Notice
          key={n.kind}
          tone="warning"
          icon={UserRoundPlus}
          title="En az bir sosyal medya hesabı ekle."
          action={<ButtonLink href={n.profileHref} size="sm">Profile git</ButtonLink>}
          {...common}
        >
          Profilinin onaylanması ve eşleşebilmen için gerekli.
        </Notice>
      )
    case 'verification_pending':
      return (
        <Notice key={n.kind} tone="info" icon={Hourglass} title="Hesabın henüz onaylanmadı." {...common}>
          Tüm özelliklere erişmek için profilini tamamla ve onay bekle.
        </Notice>
      )
  }
}

export default function ShellNotices({ notices }: { notices: ShellNotice[] }) {
  const [expanded, setExpanded] = useState(false)
  if (notices.length === 0) return null

  const rest = notices.length - 1
  const more =
    rest > 0 ? (
      <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[12.5px] text-ink-faint underline-offset-4 hover:text-ink hover:underline" aria-expanded={expanded}>
        {expanded ? 'Daha az göster' : `+${rest} bildirim`}
      </button>
    ) : undefined

  return (
    <div className="mb-5 grid gap-2">
      {render(notices[0], more)}
      {expanded && notices.slice(1).map((n) => render(n))}
    </div>
  )
}
