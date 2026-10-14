'use client'

import { useMemo, useState, useTransition, type FormEvent } from 'react'
import { Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { sendNotification, type NotificationType } from '@/app/actions/notifications'
import { Button, Card, CardBody, Field, Input, PageHeader, Segmented, Textarea } from '@/components/ui'
import { cn } from '@/utils/cn'

interface User {
  id: string
  full_name: string | null
  email: string | null
  role: 'influencer' | 'brand' | 'admin' | null
  username: string | null
}

const TYPES: { value: NotificationType; label: string }[] = [
  { value: 'info', label: 'Bilgi' },
  { value: 'success', label: 'Başarılı' },
  { value: 'warning', label: 'Uyarı' },
  { value: 'system', label: 'Sistem' },
]

const EMPTY = { title: '', message: '', type: 'info' as NotificationType, link: '' }

/** Site içi bildirim gönderme (tüm kullanıcılara ya da seçilenlere). */
export default function NotificationsPanel({ users }: { users: User[] }) {
  const [isPending, startTransition] = useTransition()
  const [target, setTarget] = useState<'all' | 'specific'>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(EMPTY)

  const matches = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return []
    return users
      .filter((u) => [u.full_name, u.email, u.username].some((v) => v?.toLocaleLowerCase('tr-TR').includes(q)))
      .slice(0, 30)
  }, [users, query])

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (target === 'specific' && picked.size === 0) {
      toast.error('En az bir kullanıcı seçin.')
      return
    }
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Başlık ve mesaj zorunlu.')
      return
    }
    startTransition(async () => {
      const ids = target === 'all' ? users.map((u) => u.id) : Array.from(picked)
      const result = await sendNotification(ids, form.title, form.message, form.type, form.link || undefined)
      if (!result.success) {
        toast.error(result.error || 'Bildirim gönderilemedi.')
        return
      }
      toast.success(`Bildirim ${ids.length} kullanıcıya gönderildi.`)
      setForm(EMPTY)
      setPicked(new Set())
      setTarget('all')
    })
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Bildirim gönder" description="Kullanıcıların panelindeki bildirimlere düşer." />

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <span className="text-[12.5px] font-medium text-ink-muted">Kime</span>
              <Segmented
                label="Hedef"
                value={target}
                onSelect={(v) => setTarget(v as 'all' | 'specific')}
                items={[
                  { value: 'all', label: `Tüm kullanıcılar (${users.length})` },
                  { value: 'specific', label: `Seçilenler${picked.size ? ` (${picked.size})` : ''}` },
                ]}
              />
            </div>

            {target === 'specific' && (
              <div className="grid gap-2">
                <Input aria-label="Kullanıcı ara" placeholder="İsim, e-posta veya kullanıcı adı ara" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query.trim() && (
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-line">
                    {matches.length === 0 ? (
                      <p className="px-3 py-3 text-center text-[13px] text-ink-faint">Kullanıcı bulunamadı</p>
                    ) : (
                      matches.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => toggle(u.id)}
                          aria-pressed={picked.has(u.id)}
                          className={cn('flex w-full items-center justify-between gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-surface-2', picked.has(u.id) && 'bg-surface-2')}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] text-ink">{u.full_name || u.username || 'İsimsiz'}</span>
                            <span className="block truncate text-xs text-ink-faint">{u.email}</span>
                          </span>
                          {picked.has(u.id) && <span className="text-xs text-gold">Seçili</span>}
                        </button>
                      ))
                    )}
                  </div>
                )}
                {picked.size > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(picked).map((id) => {
                      const u = users.find((x) => x.id === id)
                      if (!u) return null
                      return (
                        <span key={id} className="inline-flex h-[26px] items-center gap-1 rounded-full border border-gold/30 bg-gold/10 pl-2.5 pr-1 text-xs text-gold">
                          {u.full_name || u.username}
                          <button type="button" onClick={() => toggle(id)} aria-label={`${u.full_name || u.username} çıkar`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-gold/20">
                            <X className="h-3 w-3" aria-hidden />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <span className="text-[12.5px] font-medium text-ink-muted">Tür</span>
                <Segmented label="Bildirim türü" value={form.type} onSelect={(v) => setForm({ ...form, type: v as NotificationType })} items={TYPES} />
              </div>
              <Field label="Yönlendirme bağlantısı" hint="İsteğe bağlı, ör. /dashboard/works">
                {(props) => <Input {...props} placeholder="/dashboard/…" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />}
              </Field>
            </div>

            <Field label="Başlık">
              {(props) => <Input {...props} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}
            </Field>
            <Field label="Mesaj">
              {(props) => <Textarea {...props} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />}
            </Field>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={isPending} leftIcon={<Send />}>
                Bildirimi gönder
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
