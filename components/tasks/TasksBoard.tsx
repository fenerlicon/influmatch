'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, Clock, Copy, Gift, ImagePlus, Link2, Lock, Trophy } from 'lucide-react'
import type { TaskView, TasksOverview } from '@/lib/tasks'
import { TASK_PROOF_BUCKET, TASK_PROOF_MAX_BYTES, TASK_STATE_CHIPS } from '@/lib/tasks-shared'
import { createTaskProofUploadUrl, submitTask } from '@/app/dashboard/tasks/actions'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { Button, Card, CardBody, CardHeader, Chip, EmptyState, Input, Notice, Progress } from '@/components/ui'
import AppealBox from '@/components/appeals/AppealBox'

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
const formatCount = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('tr-TR') : '—')

function TaskCard({ task, inviteLink }: { task: TaskView; inviteLink: string | null }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [postUrl, setPostUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const chip = TASK_STATE_CHIPS[task.state]
  const canAct = task.state === 'available' || task.state === 'ready'

  const send = (input: { postUrl?: string; proofPath?: string }) =>
    startTransition(async () => {
      const result = await submitTask({ taskId: task.id, ...input })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.status === 'measuring' ? 'Gönderildi. Bekleme süresi dolunca izlenme ölçülecek.' : 'Gönderildi, incelemeye alındı.')
      setPostUrl('')
      router.refresh()
    })

  const uploadProof = async (file: File) => {
    if (file.size > TASK_PROOF_MAX_BYTES) return toast.error('Görsel en fazla 5 MB olabilir.')
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    setUploading(true)
    try {
      const upload = await createTaskProofUploadUrl(ext === 'jpeg' ? 'jpg' : ext)
      if (!upload.success) return toast.error(upload.error)
      const { error } = await createSupabaseBrowserClient()
        .storage.from(TASK_PROOF_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, file, { contentType: file.type || 'image/jpeg' })
      if (error) return toast.error('Görsel yüklenemedi. Lütfen tekrar dene.')
      send({ proofPath: upload.path })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const latest = task.latest
  const showRejected = latest?.status === 'rejected' && canAct

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {task.title}
            <Chip tone={chip.tone}>{chip.label}</Chip>
          </span>
        }
        description={task.description}
        action={<Chip tone="gold">{task.reward}</Chip>}
      />
      <CardBody className="grid gap-3 text-[13px] text-ink-muted">
        {task.maxRounds > 1 && (
          <p>
            Tur: {task.approvedRounds} / {task.maxRounds} tamamlandı
          </p>
        )}

        {task.progress.length > 0 && task.state !== 'completed' && (
          <ul className="grid gap-2">
            {task.progress.map((p) => (
              <li key={p.label} className="grid gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className={p.met ? 'text-ink' : undefined}>
                    {p.met ? <Check className="mr-1 inline h-3.5 w-3.5 text-success" /> : null}
                    {p.label}
                  </span>
                  <span className="tabular-nums">
                    {p.current} / {p.target}
                  </span>
                </span>
                <Progress value={Math.round((p.current / Math.max(1, p.target)) * 100)} label={p.label} />
              </li>
            ))}
          </ul>
        )}

        {task.kind === 'promo_video' && task.requiredViews !== null && task.state !== 'completed' && (
          <p>
            Hedef: {task.holdDays}. günde en az <strong className="text-ink">{formatCount(task.requiredViews)}</strong> izlenme.
          </p>
        )}

        {task.state === 'blocked' && task.blockedReason && (
          <p className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" /> {task.blockedReason}
          </p>
        )}

        {task.state === 'measuring' && latest && (
          <Notice tone="info" icon={Clock} title="Ölçüm bekleniyor">
            {formatDate(latest.measureDueAt)} sonrasında izlenme ölçülecek (gerekli: {formatCount(latest.requiredViews)}). Gönderiyi o zamana kadar silme.
          </Notice>
        )}
        {task.state === 'in_review' && latest && (
          <Notice tone="info" title="İncelemede">
            {latest.checkNote ?? 'Gönderin admin incelemesinde.'}
          </Notice>
        )}
        {showRejected && latest && (
          <Notice tone="warning" title="Son gönderim onaylanmadı">
            {latest.reviewNote ?? latest.checkNote ?? 'Yeni bir gönderimle tekrar deneyebilirsin.'}
          </Notice>
        )}
        {latest?.status === 'rejected' && latest.decision && (latest.decision.canAppeal || latest.decision.appeal) && (
          <AppealBox decision={latest.decision} showReason={!showRejected} />
        )}

        {canAct && task.evidence === 'post_url' && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              send({ postUrl })
            }}
          >
            <Input
              aria-label="Gönderi bağlantısı"
              placeholder="https://www.instagram.com/reel/... ya da https://www.tiktok.com/@.../video/..."
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              maxLength={500}
            />
            <Button type="submit" variant="primary" leftIcon={<Link2 />} loading={isPending} disabled={!postUrl.trim()}>
              Gönder
            </Button>
          </form>
        )}

        {canAct && task.evidence === 'proof_image' && (
          <div className="grid gap-2">
            {inviteLink && <p>Story&apos;ye eklenecek bağlantı: <span className="break-all text-ink">{inviteLink}</span></p>}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadProof(file)
              }}
            />
            <div>
              <Button variant="primary" leftIcon={<ImagePlus />} loading={uploading || isPending} onClick={() => fileRef.current?.click()}>
                Ekran görüntüsü yükle
              </Button>
            </div>
          </div>
        )}

        {task.state === 'ready' && task.evidence === 'auto' && (
          <div>
            <Button variant="primary" leftIcon={<Gift />} loading={isPending} onClick={() => send({})}>
              Ödülü talep et
            </Button>
          </div>
        )}

        {task.endsAt && task.state !== 'completed' && <p className="text-[12px] text-ink-faint">Son tarih: {formatDate(task.endsAt)}</p>}
      </CardBody>
    </Card>
  )
}

/** Görevler sayfası (web): davet kodu, görev kartları, bekleyen ödüller. */
export default function TasksBoard({ overview }: { overview: TasksOverview }) {
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Kopyalandı.')
    } catch {
      toast.error('Kopyalanamadı.')
    }
  }

  return (
    <div className="grid gap-4">
      {!overview.verified && (
        <Notice tone="warning" title="Hesabın henüz onaylanmadı">
          Görevleri görebilirsin; gönderim hesabın onaylandıktan sonra açılır.
        </Notice>
      )}
      {overview.promoPeriod && overview.audience === 'creator' && (
        <Notice tone="gold" title="0₺ döneminde mavi tik">
          Mavi tik için mevcut şartlara ek olarak tanıtım videosu görevini tamamlaman ve en az 1 iş birliğini bitirmen gerekir.
        </Notice>
      )}

      {overview.invite && (
        <Card>
          <CardHeader
            title="Davet kodun"
            description={`${overview.invite.total} kişi kodunla kaydoldu, ${overview.invite.verified} kişinin hesabı onaylandı.`}
          />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[18px] tracking-[0.12em] text-ink">{overview.invite.code}</span>
              <Button size="sm" variant="ghost" iconOnly aria-label="Kodu kopyala" onClick={() => copy(overview.invite!.code)}>
                <Copy />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="min-w-0 truncate text-[13px] text-ink-muted">{overview.invite.link}</span>
              <Button size="sm" variant="secondary" leftIcon={<Copy />} onClick={() => copy(overview.invite!.link)}>
                Bağlantıyı kopyala
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {overview.tasks.length === 0 ? (
        <Card>
          <EmptyState icon={Trophy} title="Şu an açık görev yok" description="Yeni görevler açıldığında burada görünecek." />
        </Card>
      ) : (
        overview.tasks.map((task) => <TaskCard key={task.id} task={task} inviteLink={overview.invite?.link ?? null} />)
      )}

      <Card>
        <CardHeader title="Ödüllerim" description="Ödüller satış başlayınca hesabına işlenir. İndirim kodu ilk ay indirimiyle birleşmez; büyük olan geçerli olur." />
        {overview.rewards.length === 0 ? (
          <CardBody className="text-[13px] text-ink-muted">Henüz ödül yok.</CardBody>
        ) : (
          <ul>
            {overview.rewards.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[13px]">
                <span className="min-w-0">
                  <span className="block text-ink">{r.text}</span>
                  <span className="block text-ink-muted">
                    {r.taskTitle}
                    {r.code ? ` · Kod: ${r.code}` : ''}
                    {r.appliedUntil ? ` · Bitiş: ${formatDate(r.appliedUntil)}` : ''}
                  </span>
                </span>
                <Chip tone={r.status === 'applied' ? 'success' : r.status === 'pending' ? 'warning' : 'neutral'}>{r.statusLabel}</Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
