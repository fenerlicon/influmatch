'use client'

import { useState, type FormEvent } from 'react'
import { Link2 } from 'lucide-react'
import { adminManualConnectInstagram } from '@/app/admin/actions'
import { Button, Card, CardBody, Field, Input, Notice, PageHeader } from '@/components/ui'

type Outcome = { ok: true; message: string; posts: string[] } | { ok: false; message: string }

export default function ManualConnectPage() {
  const [identifier, setIdentifier] = useState('')
  const [username, setUsername] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault()
    if (!identifier.trim() || !username.trim()) {
      setOutcome({ ok: false, message: 'Lütfen iki alanı da doldurun.' })
      return
    }
    setLoading(true)
    setOutcome(null)
    try {
      const result = await adminManualConnectInstagram(identifier.trim(), username.trim())
      if (result.success) {
        setOutcome({ ok: true, message: result.message ?? 'Hesap bağlandı.', posts: (result.analyzed_posts as string[] | undefined) ?? [] })
      } else {
        setOutcome({ ok: false, message: result.error ?? 'Bağlanamadı.' })
      }
    } catch (e) {
      setOutcome({ ok: false, message: e instanceof Error ? e.message : 'Beklenmeyen bir hata oluştu.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl">
      <PageHeader title="Manuel Instagram bağlama" description="Sorunlu hesapları admin yetkisiyle bağlar; profil verisi ve son gönderiler analiz edilir." />

      <Card>
        <CardBody>
          <form onSubmit={handleConnect} className="grid gap-4">
            <Field label="Kullanıcı ID (UUID) veya e-posta">
              {(props) => <Input {...props} placeholder="9e8250fc-…" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="off" />}
            </Field>
            <Field label="Instagram kullanıcı adı">
              {(props) => <Input {...props} placeholder="kullaniciadi" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />}
            </Field>
            <div>
              <Button type="submit" variant="primary" loading={loading} leftIcon={<Link2 />}>
                Bağla ve onayla
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      {outcome && (
        <div className="mt-4 grid gap-3">
          <Notice tone={outcome.ok ? 'success' : 'danger'} title={outcome.ok ? 'Bağlandı.' : 'Hata.'}>
            {outcome.message}
          </Notice>
          {outcome.ok && outcome.posts.length > 0 && (
            <Card padded>
              <p className="mb-2 text-[13px] font-medium text-ink">Analiz edilen son gönderiler</p>
              <ol className="list-decimal space-y-1 pl-5 text-[13px]">
                {outcome.posts.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-gold hover:underline">
                      {url}
                    </a>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
