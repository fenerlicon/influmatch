'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { FileDown, Paperclip, Scale } from 'lucide-react'
import { Button, Card, CardBody, Chip, EmptyState, Field, Modal, PageHeader, Tabs, Textarea, type ChipTone } from '@/components/ui'
import { RejectReasonFields, isReasonReady, type RejectReasonValue } from '@/components/admin/RejectReasonDialog'
import { decideDispute, getDisputeProof, getRecordLink } from '@/app/admin/disputes/actions'
import type { AdminDisputeDecision, AdminDisputeView } from '@/lib/collaboration-disputes'
import type { DisputeStatus } from '@/lib/collaboration-trust-shared'

const TONE: Record<DisputeStatus, ChipTone> = {
  open: 'warning',
  responded: 'info',
  resolved: 'success',
  escalated: 'danger',
  upheld: 'danger',
  dismissed: 'neutral',
  paid: 'success',
}

const fmt = (value: string | null | undefined, withTime = false) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        ...(withTime && value.length !== 10 ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—'

const ACTIVE: DisputeStatus[] = ['open', 'responded', 'escalated']

/** Admin anlaşmazlık kuyruğu: iki tarafın kayıtları, zaman çizelgesi, karar (askıya al / kapat / ödendi). */
export default function DisputesPanel({
  disputes,
  counts,
  filter,
}: {
  disputes: AdminDisputeView[]
  counts: Record<'active' | 'escalated' | 'closed', number>
  filter: 'escalated' | 'active' | 'closed' | 'all'
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [decision, setDecision] = useState<{ dispute: AdminDisputeView; kind: AdminDisputeDecision } | null>(null)
  const [reason, setReason] = useState<RejectReasonValue>({ code: '', text: '' })
  const [note, setNote] = useState('')

  const open = (dispute: AdminDisputeView, kind: AdminDisputeDecision) => {
    setDecision({ dispute, kind })
    setReason({ code: '', text: '' })
    setNote('')
  }

  const submit = () =>
    start(async () => {
      if (!decision) return
      const result = await decideDispute(decision.dispute.id, decision.kind, decision.kind === 'suspend' ? { reason } : { note })
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.message ?? 'Kaydedildi.')
      setDecision(null)
      router.refresh()
    })

  const openUrl = (load: () => Promise<{ success: true; url?: string } | { success: false; error: string }>) =>
    start(async () => {
      const result = await load()
      if (!result.success || !result.url) {
        toast.error(result.success ? 'Bağlantı yok.' : result.error)
        return
      }
      window.open(result.url, '_blank', 'noopener')
    })

  const ready = decision?.kind === 'suspend' ? isReasonReady(reason) : note.trim().length >= 3

  return (
    <div className="max-w-[1100px]">
      <PageHeader
        title="Anlaşmazlıklar"
        description="Ödeme alınamadı / teslim edilmedi bildirimleri. Karşı taraf 7 gün içinde kanıt ya da yanıt vermezse hesabı incelemeye alınır; askıya alma kararı yalnızca buradan verilir ve kullanıcı karara itiraz edebilir."
      />
      <Tabs
        className="mb-4"
        label="Anlaşmazlık durumu"
        value={filter}
        items={[
          { value: 'escalated', label: 'İncelemede', count: counts.escalated, href: '/admin/disputes?durum=escalated' },
          { value: 'active', label: 'Yanıt süresinde', count: counts.active, href: '/admin/disputes?durum=active' },
          { value: 'closed', label: 'Kapanan', count: counts.closed, href: '/admin/disputes?durum=closed' },
          { value: 'all', label: 'Tümü', href: '/admin/disputes?durum=all' },
        ]}
      />

      {disputes.length === 0 ? (
        <Card>
          <EmptyState icon={Scale} title="Kayıt yok" description="Bu filtrede anlaşmazlık bulunmuyor." />
        </Card>
      ) : (
        <div className="grid gap-4">
          {disputes.map((d) => (
            <Card key={d.id}>
              <CardBody className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">
                      {d.kindLabel} · {d.collaboration.title}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Bildiren: {d.reporter.name}
                      {d.reporter.username ? ` (@${d.reporter.username})` : ''} · Karşı taraf: {d.respondent.name}
                      {d.respondent.username ? ` (@${d.respondent.username})` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone={TONE[d.status]} dot>
                      {d.statusLabel}
                    </Chip>
                    {d.activeHold && <Chip tone="danger">{d.activeHold === 'suspended' ? 'Hesap askıda' : 'Hesap incelemede'}</Chip>}
                  </div>
                </div>

                <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[11.5px] text-ink-faint">Anlaşma</dt>
                    <dd>{d.agreement ? `${d.agreement.fee} · vade ${fmt(d.agreement.paymentDueDate)}` : 'Anlaşma özeti yok'}</dd>
                  </div>
                  <div>
                    <dt className="text-[11.5px] text-ink-faint">Ödeme işaretleri</dt>
                    <dd>
                      Marka: {d.payment?.brandPaidDate ? fmt(d.payment.brandPaidDate) : 'yok'} · Influencer: {d.payment?.influencerReceivedDate ? fmt(d.payment.influencerReceivedDate) : 'yok'}
                    </dd>
                  </div>
                  {d.deliverable && (
                    <div>
                      <dt className="text-[11.5px] text-ink-faint">Teslimat</dt>
                      <dd>
                        {d.deliverable.label} · teslim {fmt(d.deliverable.dueDate)} · {d.deliverable.status}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-[11.5px] text-ink-faint">İş birliği</dt>
                    <dd>
                      {d.collaboration.status}
                      {d.collaboration.completedAt ? ` · tamamlandı ${fmt(d.collaboration.completedAt)}` : ''} · yanıt süresi {fmt(d.responseDueAt)}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11.5px] text-ink-faint">Bildiren tarafın notu</dt>
                    <dd className="whitespace-pre-line">{d.reporterNote || '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[11.5px] text-ink-faint">Karşı tarafın yanıtı</dt>
                    <dd className="whitespace-pre-line">{d.responseNote || '—'}</dd>
                  </div>
                </dl>

                <ol className="grid gap-0.5 border-l border-line pl-3 text-xs text-ink-muted">
                  {d.timeline.map((e, i) => (
                    <li key={`${e.at}-${i}`}>
                      <span className="text-ink">{fmt(e.at, true)}</span> · {e.text}
                    </li>
                  ))}
                </ol>

                <div className="flex flex-wrap gap-2">
                  {d.hasProof && (
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => openUrl(() => getDisputeProof(d.id))} leftIcon={<Paperclip />}>
                      Kanıtı aç
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => openUrl(() => getRecordLink(d.collaboration.id))} leftIcon={<FileDown />}>
                    İş birliği kaydı (sohbet dahil)
                  </Button>
                  {ACTIVE.includes(d.status) && (
                    <>
                      <Button size="sm" variant="danger" disabled={pending} onClick={() => open(d, 'suspend')}>
                        Karşı tarafı askıya al
                      </Button>
                      {d.kind === 'nonpayment' && (
                        <Button size="sm" disabled={pending} onClick={() => open(d, 'mark_paid')}>
                          Ödendi olarak kapat
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" disabled={pending} onClick={() => open(d, 'dismiss')}>
                        Kapat
                      </Button>
                    </>
                  )}
                </div>
                {d.supportTicketId && <p className="text-[11.5px] text-ink-faint">Bağlı destek talebi: /admin/support</p>}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!decision}
        onClose={() => setDecision(null)}
        dismissible={!pending}
        title={decision?.kind === 'suspend' ? 'Hesabı askıya al' : decision?.kind === 'mark_paid' ? 'Ödendi olarak kapat' : 'Anlaşmazlığı kapat'}
        description={
          decision?.kind === 'suspend'
            ? `${decision.dispute.respondent.name} hesabı askıya alınır: yeni ilan, teklif ve başvuru yapamaz. Neden kullanıcıya gösterilir; karara bir kez itiraz edebilir.`
            : 'İnceleme kısıtı kalkar; açıklama iki tarafa gösterilir.'
        }
        footer={
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setDecision(null)}>
              Vazgeç
            </Button>
            <Button variant={decision?.kind === 'suspend' ? 'danger' : 'primary'} loading={pending} disabled={!ready} onClick={submit}>
              Kararı kaydet
            </Button>
          </>
        }
      >
        {decision?.kind === 'suspend' ? (
          <RejectReasonFields subjectType="collaboration_dispute" value={reason} onChange={setReason} />
        ) : (
          <Field label="Açıklama (iki tarafa gösterilir)">
            {(props) => <Textarea {...props} rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        )}
      </Modal>
    </div>
  )
}
