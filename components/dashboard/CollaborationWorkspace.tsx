'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Check, ExternalLink, History, MessageCircle, Pencil, Plus, Send, X } from 'lucide-react'
import CampaignBriefView from '@/components/campaigns/CampaignBriefView'
import DeliverableMetricsPanel from '@/components/dashboard/DeliverableMetricsPanel'
import { Avatar, Button, ButtonLink, Card, CardBody, CardHeader, Chip, Field, Input, Notice, Select, Textarea, type ChipTone } from '@/components/ui'
import { createSupabaseBrowserClient } from '@/utils/supabase/client'
import { workspaceAction } from '@/app/dashboard/collaborations/[id]/actions'
import { collaborationAction } from '@/app/dashboard/collaborations/actions'
import { AUTO_COMPLETE_DAYS, COLLABORATION_STATUS_LABELS, type CollaborationAction, type CollaborationStatus } from '@/lib/collaboration-shared'
import {
  AGREEMENT_LIMITS,
  AGREEMENT_SUMMARY_NOTE,
  DELIVERABLE_KIND_LABELS,
  DELIVERABLE_KINDS,
  DELIVERABLE_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  formatTry,
  reliabilityText,
  revisionUsageText,
  type AgreementPaymentType,
  type DeliverableKind,
  type DeliverableStatus,
  NONPAYMENT_REPORT_DAYS,
} from '@/lib/collaboration-workspace-shared'
import type { CollaborationWorkspace, DeliverableView } from '@/lib/collaboration-workspace'

interface Props {
  workspace: CollaborationWorkspace
  currentUserId: string
}

const STATUS_TONE: Record<CollaborationStatus, ChipTone> = {
  agreed: 'info',
  in_progress: 'warning',
  published: 'gold',
  completed: 'success',
  cancelled: 'danger',
}

const DELIVERABLE_TONE: Record<DeliverableStatus, ChipTone> = {
  pending: 'neutral',
  draft_submitted: 'info',
  revision_requested: 'warning',
  approved: 'success',
  published: 'gold',
}

const formatDate = (value: string | null | undefined) =>
  value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : null
const formatDateTime = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null
const today = () => new Date().toISOString().slice(0, 10)

interface DraftRow {
  id: string | null
  kind: DeliverableKind
  quantity: string
  note: string
  due_date: string
}

interface AgreementDraft {
  payment_type: AgreementPaymentType
  fee_amount: string
  revision_limit: string
  usage_rights: string
  deliverables: DraftRow[]
}

/** Etiket + değer satırı (anlaşma ve ödeme özetleri). */
function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-[14px] text-ink">{children}</dd>
    </div>
  )
}

const linkClass = 'break-all text-gold hover:underline'

export default function CollaborationWorkspaceView({ workspace, currentUserId }: Props) {
  const router = useRouter()
  const { collaboration: collab, agreement, deliverables, payment, permissions, brandReliability } = workspace
  const isBrand = collab.brand_id === currentUserId
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AgreementDraft | null>(null)
  // Açık form: teslimat işlemi, ödeme formu veya iş birliği işlemi.
  const [form, setForm] = useState<{ key: string; url: string; note: string; date: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({})
  const [, startTransition] = useTransition()

  // Karşı tarafın işlemlerinde sayfa yenilenir (RLS yalnızca tarafların olaylarını gönderir).
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    const refresh = () => router.refresh()
    const channel = supabase
      .channel(`collaboration-${collab.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaborations', filter: `id=eq.${collab.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaboration_agreements', filter: `collaboration_id=eq.${collab.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaboration_deliverables', filter: `collaboration_id=eq.${collab.id}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'collaboration_payments', filter: `collaboration_id=eq.${collab.id}` }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [collab.id, router])

  const run = (payload: Record<string, unknown>, after?: () => void) => {
    setBusy(true)
    setMessage(null)
    startTransition(async () => {
      const result = await workspaceAction(collab.id, payload)
      setBusy(false)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setForm(null)
      after?.()
      setMessage({ type: 'success', text: result.message ?? 'Kaydedildi.' })
      router.refresh()
    })
  }

  const runCollab = (action: CollaborationAction, extra: { url?: string; reason?: string } = {}) => {
    setBusy(true)
    setMessage(null)
    startTransition(async () => {
      const result = await collaborationAction(collab.id, { action, ...extra })
      setBusy(false)
      if (!result.success) {
        setMessage({ type: 'error', text: result.error })
        return
      }
      setForm(null)
      if (action === 'open_room' && result.roomId) {
        router.push(`/dashboard/messages?roomId=${result.roomId}`)
        return
      }
      setMessage({ type: 'success', text: 'Kaydedildi.' })
      router.refresh()
    })
  }

  const openForm = (key: string) => setForm(form?.key === key ? null : { key, url: '', note: '', date: today() })

  const startEditing = () => {
    setDraft({
      payment_type: agreement?.payment_type ?? 'cash',
      fee_amount: agreement?.fee_amount != null ? String(agreement.fee_amount) : '',
      revision_limit: String(agreement?.revision_limit ?? 2),
      usage_rights: agreement?.usage_rights ?? '',
      // Teslimat yoksa kampanyanın varsayılan teslimatlarıyla (3.19) ya da tek Reels satırıyla başlar.
      deliverables: deliverables.length
        ? deliverables.map((d) => ({ id: d.id, kind: d.kind, quantity: String(d.quantity), note: d.note ?? '', due_date: d.due_date ?? '' }))
        : workspace.campaignBrief?.default_deliverables.length
          ? workspace.campaignBrief.default_deliverables.map((d) => ({ id: null, kind: d.kind, quantity: String(d.quantity), note: '', due_date: '' }))
          : [{ id: null, kind: 'reel', quantity: '1', note: '', due_date: '' }],
    })
    setEditing(true)
    setMessage(null)
  }

  const saveAgreement = () => {
    if (!draft) return
    run(
      {
        action: 'save_agreement',
        version: agreement?.version ?? null,
        agreement: {
          payment_type: draft.payment_type,
          fee_amount: draft.fee_amount.trim() === '' ? null : Number(draft.fee_amount),
          revision_limit: Number(draft.revision_limit),
          usage_rights: draft.usage_rights,
          deliverables: draft.deliverables.map((d) => ({
            id: d.id,
            kind: d.kind,
            quantity: Number(d.quantity),
            note: d.note,
            due_date: d.due_date || null,
          })),
        },
      },
      () => setEditing(false),
    )
  }

  const updateRow = (index: number, patch: Partial<DraftRow>) =>
    setDraft((d) => (d ? { ...d, deliverables: d.deliverables.map((row, i) => (i === index ? { ...row, ...patch } : row)) } : d))

  const other = collab.other
  const otherName = other?.full_name || (other?.username ? `@${other.username}` : 'Kullanıcı')
  const lockedIds = new Set(deliverables.filter((d) => d.status !== 'pending' || d.draft_submitted_at || d.revisions_used > 0).map((d) => d.id))

  return (
    <div className="grid gap-5">
      {/* Başlık */}
      <Card padded className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar name={otherName} src={other?.avatar_url} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate font-display text-[24px] leading-tight tracking-tight text-ink">{collab.title}</h1>
              <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                {other?.username ? (
                  <Link href={`/profile/${other.username}`} className="text-ink hover:text-gold">
                    {otherName}
                  </Link>
                ) : (
                  otherName
                )}
                <span className="text-ink-faint"> · {collab.source === 'offer' ? 'Teklif' : 'İlan başvurusu'} · {formatDate(collab.created_at)}</span>
              </p>
              {!isBrand && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  Marka geçmişi: <span className="text-ink-muted">{reliabilityText(brandReliability.completed, brandReliability.confirmed)}</span>
                </p>
              )}
            </div>
          </div>
          <Chip tone={STATUS_TONE[collab.status]} dot>{COLLABORATION_STATUS_LABELS[collab.status]}</Chip>
        </div>

        {(collab.auto_complete_at || collab.completed_at || collab.cancelled_at) && (
          <div className="grid gap-1 text-xs text-ink-muted">
            {collab.auto_complete_at && (
              <p>
                {isBrand
                  ? `Onaylamazsan ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır (${AUTO_COMPLETE_DAYS} gün).`
                  : `Marka yanıt vermezse ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır.`}
              </p>
            )}
            {collab.completed_at && (
              <p>
                Tamamlandı: {formatDate(collab.completed_at)}
                {collab.auto_completed ? ' (otomatik)' : ''}
              </p>
            )}
            {collab.cancelled_at && (
              <p>
                İptal: {formatDate(collab.cancelled_at)} · {collab.cancelled_by === currentUserId ? 'senin tarafından' : 'karşı tarafça'}
                {collab.cancel_reason ? ` · ${collab.cancel_reason}` : ''}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {collab.room_id ? (
            <ButtonLink href={`/dashboard/messages?roomId=${collab.room_id}`} size="sm" leftIcon={<MessageCircle />}>
              Sohbete git
            </ButtonLink>
          ) : (
            collab.actions.includes('open_room') && (
              <Button size="sm" disabled={busy} onClick={() => runCollab('open_room')} leftIcon={<MessageCircle />}>
                Sohbeti aç
              </Button>
            )
          )}
          {collab.actions.includes('publish') && (
            <Button size="sm" variant="primary" disabled={busy} onClick={() => openForm('collab_publish')}>
              Yayın linkini gir
            </Button>
          )}
          {collab.actions.includes('approve') && (
            <Button size="sm" variant="primary" disabled={busy} onClick={() => runCollab('approve')} leftIcon={<Check />}>
              Onayla ve tamamla
            </Button>
          )}
          {collab.actions.includes('cancel') && (
            <Button size="sm" variant="danger" disabled={busy} onClick={() => openForm('collab_cancel')}>
              İptal et
            </Button>
          )}
        </div>

        {form?.key === 'collab_publish' && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              runCollab('publish', { url: form.url })
            }}
          >
            <Input
              type="url"
              required
              maxLength={500}
              aria-label="Yayın linki"
              placeholder="https://www.instagram.com/p/..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <Button type="submit" variant="primary" loading={busy} leftIcon={<Send />}>Gönder</Button>
          </form>
        )}
        {form?.key === 'collab_cancel' && (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              runCollab('cancel', { reason: form.note })
            }}
          >
            <Textarea
              maxLength={500}
              rows={2}
              aria-label="İptal gerekçesi"
              placeholder="Gerekçe (isteğe bağlı, karşı tarafa iletilir)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
            <div>
              <Button type="submit" variant="danger" loading={busy}>İş birliğini iptal et</Button>
            </div>
          </form>
        )}
      </Card>

      {message && <Notice tone={message.type === 'error' ? 'danger' : 'success'}>{message.text}</Notice>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-5">
          {/* Kampanya brief'i (3.19, salt okunur) */}
          {workspace.campaignBrief && (
            <Card padded>
              <CampaignBriefView brief={workspace.campaignBrief} />
            </Card>
          )}

          {/* Anlaşma özeti */}
          <Card>
            <CardHeader
              title="Anlaşma özeti"
              action={
                agreement ? (
                  <Chip tone={workspace.agreementConfirmed ? 'success' : 'warning'} dot>
                    {workspace.agreementConfirmed ? 'İki taraf onayladı' : 'Onay bekliyor'}
                  </Chip>
                ) : undefined
              }
            />
            <CardBody>
              {editing && draft ? (
                <div className="grid gap-4">
                  {workspace.agreementConfirmed && (
                    <Notice tone="warning">Kaydettiğinde iki onay da sıfırlanır; kaydın yeni hali onayın sayılır, karşı taraf yeniden onaylar.</Notice>
                  )}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Ödeme türü">
                      {(props) => (
                        <Select {...props} value={draft.payment_type} onChange={(e) => setDraft({ ...draft, payment_type: e.target.value as AgreementPaymentType })}>
                          {(Object.keys(PAYMENT_TYPE_LABELS) as AgreementPaymentType[]).map((t) => (
                            <option key={t} value={t}>
                              {PAYMENT_TYPE_LABELS[t]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                    <Field label={`Anlaşılan ücret (₺)${draft.payment_type === 'barter' ? ', isteğe bağlı' : ''}`}>
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          min={0}
                          max={AGREEMENT_LIMITS.maxFee}
                          step={1}
                          inputMode="numeric"
                          value={draft.fee_amount}
                          onChange={(e) => setDraft({ ...draft, fee_amount: e.target.value })}
                        />
                      )}
                    </Field>
                    <Field label="Revize sayısı">
                      {(props) => (
                        <Input
                          {...props}
                          type="number"
                          min={0}
                          max={AGREEMENT_LIMITS.maxRevisions}
                          step={1}
                          value={draft.revision_limit}
                          onChange={(e) => setDraft({ ...draft, revision_limit: e.target.value })}
                        />
                      )}
                    </Field>
                  </div>
                  <Field label="Kullanım hakkı (kısa)">
                    {(props) => (
                      <Textarea
                        {...props}
                        rows={2}
                        maxLength={AGREEMENT_LIMITS.usageRightsMax}
                        placeholder="Ör. içerik markanın hesabında 3 ay kullanılabilir"
                        value={draft.usage_rights}
                        onChange={(e) => setDraft({ ...draft, usage_rights: e.target.value })}
                      />
                    )}
                  </Field>

                  <div className="grid gap-2">
                    <p className="text-[13px] text-ink-muted">Teslimatlar</p>
                    {draft.deliverables.map((row, index) => {
                      const locked = !!row.id && lockedIds.has(row.id)
                      return (
                        <div key={row.id ?? `new-${index}`} className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_80px_150px_auto]">
                          <Select aria-label="Teslimat türü" value={row.kind} onChange={(e) => updateRow(index, { kind: e.target.value as DeliverableKind })}>
                            {DELIVERABLE_KINDS.map((k) => (
                              <option key={k} value={k}>
                                {DELIVERABLE_KIND_LABELS[k]}
                              </option>
                            ))}
                          </Select>
                          <Input
                            type="number"
                            min={1}
                            max={AGREEMENT_LIMITS.maxQuantity}
                            aria-label="Adet"
                            value={row.quantity}
                            onChange={(e) => updateRow(index, { quantity: e.target.value })}
                          />
                          <Input type="date" aria-label="Teslim tarihi" value={row.due_date} onChange={(e) => updateRow(index, { due_date: e.target.value })} />
                          <Button
                            variant="ghost"
                            iconOnly
                            aria-label="Teslimatı çıkar"
                            disabled={locked}
                            title={locked ? 'Taslağı gönderilmiş teslimat çıkarılamaz' : undefined}
                            onClick={() => setDraft({ ...draft, deliverables: draft.deliverables.filter((_, i) => i !== index) })}
                          >
                            <X />
                          </Button>
                          <Input
                            maxLength={AGREEMENT_LIMITS.deliverableNoteMax}
                            aria-label="Teslimat notu"
                            placeholder="Kısa not (isteğe bağlı)"
                            value={row.note}
                            onChange={(e) => updateRow(index, { note: e.target.value })}
                            className="sm:col-span-4"
                          />
                        </div>
                      )
                    })}
                    {draft.deliverables.length < AGREEMENT_LIMITS.maxDeliverables && (
                      <div>
                        <Button
                          size="sm"
                          variant="ghost"
                          leftIcon={<Plus />}
                          onClick={() => setDraft({ ...draft, deliverables: [...draft.deliverables, { id: null, kind: 'story', quantity: '1', note: '', due_date: '' }] })}
                        >
                          Teslimat ekle
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button variant="ghost" disabled={busy} onClick={() => setEditing(false)}>Vazgeç</Button>
                    <Button variant="primary" loading={busy} onClick={saveAgreement}>Kaydet</Button>
                  </div>
                </div>
              ) : agreement ? (
                <div className="grid gap-4">
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Fact label="Ücret">
                      {formatTry(agreement.fee_amount)} · {PAYMENT_TYPE_LABELS[agreement.payment_type]}
                    </Fact>
                    <Fact label="Revize sayısı">{agreement.revision_limit}</Fact>
                    <Fact label="Kullanım hakkı" className="sm:col-span-2">
                      <span className="whitespace-pre-line">{agreement.usage_rights || '—'}</span>
                    </Fact>
                  </dl>
                  {deliverables.length > 0 && (
                    <ul className="grid gap-1 text-[13.5px] text-ink">
                      {deliverables.map((d) => (
                        <li key={d.id}>
                          {DELIVERABLE_KIND_LABELS[d.kind]} ×{d.quantity}
                          {d.due_date ? <span className="text-ink-faint"> · teslim {formatDate(d.due_date)}</span> : null}
                          {d.note ? <span className="text-ink-faint"> · {d.note}</span> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="grid gap-1 text-xs text-ink-faint sm:grid-cols-2">
                    <p>
                      Marka onayı:{' '}
                      <span className="text-ink-muted">{agreement.brand_confirmed_at ? formatDateTime(agreement.brand_confirmed_at) : 'bekleniyor'}</span>
                    </p>
                    <p>
                      Influencer onayı:{' '}
                      <span className="text-ink-muted">{agreement.influencer_confirmed_at ? formatDateTime(agreement.influencer_confirmed_at) : 'bekleniyor'}</span>
                    </p>
                  </div>
                  <p className="text-xs text-ink-faint">{AGREEMENT_SUMMARY_NOTE}</p>
                  {(permissions.canConfirmAgreement || permissions.canEditAgreement) && (
                    <div className="flex flex-wrap gap-2">
                      {permissions.canConfirmAgreement && (
                        <Button size="sm" variant="primary" disabled={busy} onClick={() => run({ action: 'confirm_agreement', version: agreement.version })} leftIcon={<Check />}>
                          Özeti onayla
                        </Button>
                      )}
                      {permissions.canEditAgreement && (
                        <Button size="sm" disabled={busy} onClick={startEditing} leftIcon={<Pencil />}>
                          Düzenle
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-3">
                  <p className="text-[13.5px] text-ink-muted">
                    Henüz anlaşma özeti yok. Teslimatları, ücreti, tarihleri, kullanım hakkını ve revize sayısını bir taraf yazar, diğeri onaylar.
                  </p>
                  {permissions.canEditAgreement && (
                    <div>
                      <Button variant="primary" onClick={startEditing}>Anlaşma özeti hazırla</Button>
                    </div>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Teslimatlar */}
          {deliverables.length > 0 && (
            <Card>
              <CardHeader
                title="Teslimatlar"
                description={
                  !workspace.agreementConfirmed && ['agreed', 'in_progress'].includes(collab.status)
                    ? 'Teslimatlar, anlaşma özeti iki tarafça onaylanınca başlar.'
                    : undefined
                }
              />
              <ul>
                {deliverables.map((d) => (
                  <DeliverableCard
                    key={d.id}
                    d={d}
                    collaborationId={collab.id}
                    revisionLimit={agreement?.revision_limit ?? 0}
                    isBrand={isBrand}
                    busy={busy}
                    form={form}
                    setForm={setForm}
                    openForm={openForm}
                    historyOpen={!!historyOpen[d.id]}
                    toggleHistory={() => setHistoryOpen((h) => ({ ...h, [d.id]: !h[d.id] }))}
                    run={run}
                  />
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Ödeme */}
        <Card as="aside">
          <CardHeader title="Ödeme" description="Ödeme taraflar arasında yapılır; burada yalnızca kaydı tutulur." />
          <CardBody className="grid gap-4">
            <dl className="grid gap-3">
              <Fact label="Marka">
                {payment?.brand_paid_at ? `Ödeme yapıldı (${formatDate(payment.brand_paid_date) ?? formatDate(payment.brand_paid_at)})` : 'İşaretlenmedi'}
                {payment?.brand_note ? <span className="block text-xs text-ink-faint">{payment.brand_note}</span> : null}
              </Fact>
              <Fact label="Influencer">
                {payment?.influencer_received_at
                  ? `Ödeme alındı (${formatDate(payment.influencer_received_date) ?? formatDate(payment.influencer_received_at)})`
                  : 'Teyit edilmedi'}
                {payment?.influencer_note ? <span className="block text-xs text-ink-faint">{payment.influencer_note}</span> : null}
              </Fact>
            </dl>
            {payment?.nonpayment_reported_at && (
              <Notice tone="warning">Ödeme alınamadı bildirimi {formatDate(payment.nonpayment_reported_at)} tarihinde destek ekibine iletildi.</Notice>
            )}

            {(permissions.canMarkPaid || permissions.canUnmarkPaid || permissions.canConfirmPayment || permissions.canUnconfirmPayment || permissions.canReportNonpayment) && (
              <div className="flex flex-wrap gap-2">
                {permissions.canMarkPaid && (
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => openForm('mark_paid')}>
                    {payment?.brand_paid_at ? 'Ödeme bilgisini güncelle' : 'Ödeme yapıldı'}
                  </Button>
                )}
                {permissions.canUnmarkPaid && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'unmark_paid' })}>
                    İşareti kaldır
                  </Button>
                )}
                {permissions.canConfirmPayment && (
                  <Button size="sm" variant="primary" disabled={busy} onClick={() => openForm('confirm_payment')}>
                    {payment?.influencer_received_at ? 'Ödeme bilgisini güncelle' : 'Ödeme alındı'}
                  </Button>
                )}
                {permissions.canUnconfirmPayment && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => run({ action: 'unconfirm_payment' })}>
                    Teyidi kaldır
                  </Button>
                )}
                {permissions.canReportNonpayment && (
                  <Button size="sm" variant="danger" disabled={busy} onClick={() => openForm('report_nonpayment')}>
                    Ödeme alamadım
                  </Button>
                )}
              </div>
            )}
            {!permissions.canReportNonpayment && permissions.nonpaymentAvailableAt && !payment?.nonpayment_reported_at && (
              <p className="text-xs text-ink-faint">
                Ödemeyi alamazsan {formatDate(permissions.nonpaymentAvailableAt)} tarihinden sonra buradan destek ekibine bildirebilirsin (iş birliği tamamlandıktan ya da bütün teslimatlar onaylandıktan {NONPAYMENT_REPORT_DAYS} gün sonra açılır).
              </p>
            )}

            {(form?.key === 'mark_paid' || form?.key === 'confirm_payment') && (
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run({ action: form.key, date: form.date, note: form.note })
                }}
              >
                <Field label="Ödeme tarihi">
                  {(props) => <Input {...props} type="date" required max={today()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}
                </Field>
                <Field label="Not (isteğe bağlı)">
                  {(props) => <Input {...props} maxLength={AGREEMENT_LIMITS.paymentNoteMax} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}
                </Field>
                <div>
                  <Button type="submit" size="sm" variant="primary" loading={busy}>Kaydet</Button>
                </div>
              </form>
            )}
            {form?.key === 'report_nonpayment' && (
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  run({ action: 'report_nonpayment', note: form.note })
                }}
              >
                <p className="text-xs text-ink-muted">Bildirimin destek ekibine iletilir ve markaya haber verilir.</p>
                <Textarea
                  rows={2}
                  maxLength={500}
                  aria-label="Açıklama"
                  placeholder="Kısa açıklama (isteğe bağlı)"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
                <div>
                  <Button type="submit" size="sm" variant="danger" loading={busy}>Destek ekibine bildir</Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function DeliverableCard({
  d,
  collaborationId,
  revisionLimit,
  isBrand,
  busy,
  form,
  setForm,
  openForm,
  historyOpen,
  toggleHistory,
  run,
}: {
  d: DeliverableView
  collaborationId: string
  revisionLimit: number
  isBrand: boolean
  busy: boolean
  form: { key: string; url: string; note: string; date: string } | null
  setForm: (f: { key: string; url: string; note: string; date: string } | null) => void
  openForm: (key: string) => void
  historyOpen: boolean
  toggleHistory: () => void
  run: (payload: Record<string, unknown>) => void
}) {
  const key = (name: string) => `${name}:${d.id}`
  const limitReached = d.revisions_used >= revisionLimit
  return (
    <li className="grid gap-3 border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-medium text-ink">
            {DELIVERABLE_KIND_LABELS[d.kind]} ×{d.quantity}
          </p>
          <p className="text-xs text-ink-faint">
            {d.due_date ? `Teslim: ${formatDate(d.due_date)} · ` : ''}
            {revisionUsageText(d.revisions_used, revisionLimit)}
          </p>
          {d.note && <p className="mt-1 text-xs text-ink-muted">{d.note}</p>}
        </div>
        <Chip tone={DELIVERABLE_TONE[d.status]} dot>{DELIVERABLE_STATUS_LABELS[d.status]}</Chip>
      </div>

      {(d.draft_url || d.publish_url || (d.status === 'revision_requested' && d.review_note)) && (
        <div className="grid gap-1.5 text-[13px]">
          {d.draft_url && (
            <p>
              <span className="text-xs text-ink-faint">Son taslak: </span>
              <a href={d.draft_url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
                {d.draft_url}
              </a>
              {d.draft_note && <span className="block text-xs text-ink-muted">{d.draft_note}</span>}
            </p>
          )}
          {d.status === 'revision_requested' && d.review_note && <Notice tone="warning">Revize isteği: {d.review_note}</Notice>}
          {d.publish_url && (
            <p>
              <span className="text-xs text-ink-faint">Yayın: </span>
              <a href={d.publish_url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
                {d.publish_url}
              </a>
            </p>
          )}
        </div>
      )}
      {d.metrics && <DeliverableMetricsPanel collaborationId={collaborationId} metrics={d.metrics} />}

      <div className="flex flex-wrap items-center gap-2">
        {d.actions.includes('submit_draft') && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => openForm(key('submit_draft'))}>
            {d.status === 'pending' ? 'Taslak gönder' : 'Yeni taslak gönder'}
          </Button>
        )}
        {d.actions.includes('approve_draft') && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => run({ action: 'approve_draft', deliverableId: d.id })} leftIcon={<Check />}>
            Taslağı onayla
          </Button>
        )}
        {d.actions.includes('request_revision') && (
          <Button size="sm" disabled={busy} onClick={() => openForm(key('request_revision'))}>
            Revize iste
          </Button>
        )}
        {isBrand && d.status === 'draft_submitted' && limitReached && <span className="text-xs text-ink-faint">Revize hakkı doldu.</span>}
        {d.actions.includes('publish_deliverable') && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => openForm(key('publish_deliverable'))} leftIcon={<ExternalLink />}>
            Yayın linkini gir
          </Button>
        )}
        {d.submissions.length > 0 && (
          <Button size="sm" variant="ghost" onClick={toggleHistory} leftIcon={<History />} aria-expanded={historyOpen}>
            Geçmiş ({d.submissions.length})
          </Button>
        )}
      </div>

      {form?.key === key('submit_draft') && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: 'submit_draft', deliverableId: d.id, url: form.url, note: form.note })
          }}
        >
          <Input
            type="url"
            required
            maxLength={500}
            aria-label="Taslak linki"
            placeholder="https://drive.google.com/... veya WeTransfer / önizleme linki"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <Textarea
            rows={2}
            maxLength={AGREEMENT_LIMITS.draftNoteMax}
            aria-label="Not"
            placeholder="Not (isteğe bağlı)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div>
            <Button type="submit" size="sm" variant="primary" loading={busy} leftIcon={<Send />}>Gönder</Button>
          </div>
        </form>
      )}
      {form?.key === key('request_revision') && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: 'request_revision', deliverableId: d.id, note: form.note })
          }}
        >
          <p className="text-xs text-ink-muted">Bu istekle {revisionUsageText(d.revisions_used + 1, revisionLimit)}.</p>
          <Textarea
            rows={2}
            required
            minLength={3}
            maxLength={AGREEMENT_LIMITS.reviewNoteMax}
            aria-label="Revize notu"
            placeholder="Ne değişmeli?"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
          <div>
            <Button type="submit" size="sm" variant="primary" loading={busy}>Revize iste</Button>
          </div>
        </form>
      )}
      {form?.key === key('publish_deliverable') && (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: 'publish_deliverable', deliverableId: d.id, url: form.url })
          }}
        >
          <Input
            type="url"
            required
            maxLength={500}
            aria-label="Yayın linki"
            placeholder="https://www.instagram.com/p/..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <Button type="submit" variant="primary" loading={busy} leftIcon={<Send />}>Gönder</Button>
        </form>
      )}

      {historyOpen && (
        <ol className="grid gap-1.5 border-l border-line pl-3 text-xs text-ink-muted">
          {d.submissions.map((s) => (
            <li key={s.id}>
              <span className="text-ink">{formatDateTime(s.created_at)}</span>
              {s.url && (
                <>
                  {' · '}
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className={linkClass}>
                    taslak
                  </a>
                </>
              )}
              {s.note ? ` · ${s.note}` : ''}
              {s.review === 'approved' && <span className="text-success"> · onaylandı</span>}
              {s.review === 'revision_requested' && <span className="text-warning"> · revize: {s.review_note}</span>}
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
