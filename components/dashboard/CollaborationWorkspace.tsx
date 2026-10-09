'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
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
} from '@/lib/collaboration-workspace-shared'
import type { CollaborationWorkspace, DeliverableView } from '@/lib/collaboration-workspace'

interface Props {
  workspace: CollaborationWorkspace
  currentUserId: string
}

const STATUS_STYLES: Record<CollaborationStatus, string> = {
  agreed: 'text-sky-200 border-sky-400/60 bg-sky-400/10',
  in_progress: 'text-yellow-200 border-yellow-400/60 bg-yellow-400/10',
  published: 'text-purple-200 border-purple-400/60 bg-purple-400/10',
  completed: 'text-emerald-200 border-emerald-400/60 bg-emerald-400/10',
  cancelled: 'text-red-200 border-red-400/60 bg-red-400/10',
}

const DELIVERABLE_STYLES: Record<DeliverableStatus, string> = {
  pending: 'text-gray-300 border-white/20 bg-white/5',
  draft_submitted: 'text-sky-200 border-sky-400/60 bg-sky-400/10',
  revision_requested: 'text-yellow-200 border-yellow-400/60 bg-yellow-400/10',
  approved: 'text-emerald-200 border-emerald-400/60 bg-emerald-400/10',
  published: 'text-purple-200 border-purple-400/60 bg-purple-400/10',
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

const inputClass = 'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-soft-gold/50'
const buttonClass = (tone: 'gold' | 'emerald' | 'yellow' | 'purple' | 'red' | 'plain') =>
  ({
    gold: 'rounded-xl bg-soft-gold px-4 py-2 text-xs font-semibold text-black transition hover:bg-soft-gold/90 disabled:opacity-50',
    emerald: 'rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:opacity-50',
    yellow: 'rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-4 py-2 text-xs font-semibold text-yellow-100 transition hover:bg-yellow-400/20 disabled:opacity-50',
    purple: 'rounded-xl border border-purple-400/40 bg-purple-400/10 px-4 py-2 text-xs font-semibold text-purple-100 transition hover:bg-purple-400/20 disabled:opacity-50',
    red: 'rounded-xl border border-red-400/30 px-4 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-400/10 disabled:opacity-50',
    plain: 'rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-gray-200 transition hover:border-soft-gold hover:text-soft-gold disabled:opacity-50',
  })[tone]

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
      deliverables: deliverables.length
        ? deliverables.map((d) => ({ id: d.id, kind: d.kind, quantity: String(d.quantity), note: d.note ?? '', due_date: d.due_date ?? '' }))
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
    <div className="space-y-6 text-white">
      {/* Başlık */}
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#141521] to-[#0C0D10] p-6 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {other?.avatar_url ? (
                <Image src={other.avatar_url} alt={otherName} fill sizes="56px" className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-soft-gold">{otherName[0]}</div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">İş birliği</p>
              <h1 className="mt-1 truncate text-2xl font-semibold">{collab.title}</h1>
              <p className="truncate text-sm text-gray-400">
                {other?.username ? (
                  <Link href={`/profile/${other.username}`} className="hover:text-soft-gold">
                    {otherName}
                  </Link>
                ) : (
                  otherName
                )}
                <span className="text-gray-500"> · {collab.source === 'offer' ? 'Teklif' : 'İlan başvurusu'} · {formatDate(collab.created_at)}</span>
              </p>
              {!isBrand && (
                <p className="mt-1 text-xs text-gray-400">
                  Marka geçmişi: <span className="text-gray-200">{reliabilityText(brandReliability.completed, brandReliability.confirmed)}</span>
                </p>
              )}
            </div>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_STYLES[collab.status]}`}>
            {COLLABORATION_STATUS_LABELS[collab.status]}
          </span>
        </div>

        {collab.auto_complete_at && (
          <p className="mt-4 text-xs text-gray-400">
            {isBrand
              ? `Onaylamazsanız ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır (${AUTO_COMPLETE_DAYS} gün).`
              : `Marka yanıt vermezse ${formatDate(collab.auto_complete_at)} tarihinde otomatik tamamlanır.`}
          </p>
        )}
        {collab.completed_at && (
          <p className="mt-2 text-xs text-gray-400">
            Tamamlandı: {formatDate(collab.completed_at)}
            {collab.auto_completed ? ' (otomatik)' : ''}
          </p>
        )}
        {collab.cancelled_at && (
          <p className="mt-2 text-xs text-gray-400">
            İptal: {formatDate(collab.cancelled_at)} · {collab.cancelled_by === currentUserId ? 'sizin tarafınızdan' : 'karşı tarafça'}
            {collab.cancel_reason ? ` · ${collab.cancel_reason}` : ''}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {collab.room_id ? (
            <Link href={`/dashboard/messages?roomId=${collab.room_id}`} className={buttonClass('plain')}>
              Sohbete git
            </Link>
          ) : (
            collab.actions.includes('open_room') && (
              <button type="button" disabled={busy} onClick={() => runCollab('open_room')} className={buttonClass('plain')}>
                Sohbeti aç
              </button>
            )
          )}
          {collab.actions.includes('publish') && (
            <button type="button" disabled={busy} onClick={() => openForm('collab_publish')} className={buttonClass('purple')}>
              Yayın linkini gir
            </button>
          )}
          {collab.actions.includes('approve') && (
            <button type="button" disabled={busy} onClick={() => runCollab('approve')} className={buttonClass('emerald')}>
              Onayla ve tamamla
            </button>
          )}
          {collab.actions.includes('cancel') && (
            <button type="button" disabled={busy} onClick={() => openForm('collab_cancel')} className={buttonClass('red')}>
              İptal et
            </button>
          )}
        </div>

        {form?.key === 'collab_publish' && (
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              runCollab('publish', { url: form.url })
            }}
          >
            <input
              type="url"
              required
              maxLength={500}
              placeholder="https://www.instagram.com/p/..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className={inputClass}
            />
            <button type="submit" disabled={busy} className={buttonClass('gold')}>
              Gönder
            </button>
          </form>
        )}
        {form?.key === 'collab_cancel' && (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              runCollab('cancel', { reason: form.note })
            }}
          >
            <textarea
              maxLength={500}
              rows={2}
              placeholder="Gerekçe (isteğe bağlı, karşı tarafa iletilir)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass}
            />
            <button type="submit" disabled={busy} className="rounded-xl bg-red-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50">
              İş birliğini iptal et
            </button>
          </form>
        )}
      </header>

      {message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            message.type === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Anlaşma özeti */}
      <section className="rounded-3xl border border-white/10 bg-[#0F1014] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Anlaşma özeti</h2>
          {agreement && (
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                workspace.agreementConfirmed ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-200' : 'border-yellow-400/60 bg-yellow-400/10 text-yellow-200'
              }`}
            >
              {workspace.agreementConfirmed ? 'İki taraf onayladı' : 'Onay bekliyor'}
            </span>
          )}
        </div>

        {editing && draft ? (
          <div className="mt-4 space-y-4">
            {workspace.agreementConfirmed && (
              <p className="rounded-xl border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-xs text-yellow-100">
                Kaydettiğinizde iki onay da sıfırlanır; kaydınız yeni hali onayınız sayılır, karşı taraf yeniden onaylar.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1 text-xs text-gray-400">
                <span>Ödeme türü</span>
                <select
                  value={draft.payment_type}
                  onChange={(e) => setDraft({ ...draft, payment_type: e.target.value as AgreementPaymentType })}
                  className={inputClass}
                >
                  {(Object.keys(PAYMENT_TYPE_LABELS) as AgreementPaymentType[]).map((t) => (
                    <option key={t} value={t} className="bg-[#0F1014]">
                      {PAYMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs text-gray-400">
                <span>Anlaşılan ücret (₺){draft.payment_type === 'barter' ? ', isteğe bağlı' : ''}</span>
                <input
                  type="number"
                  min={0}
                  max={AGREEMENT_LIMITS.maxFee}
                  step={1}
                  inputMode="numeric"
                  value={draft.fee_amount}
                  onChange={(e) => setDraft({ ...draft, fee_amount: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="space-y-1 text-xs text-gray-400">
                <span>Revize sayısı</span>
                <input
                  type="number"
                  min={0}
                  max={AGREEMENT_LIMITS.maxRevisions}
                  step={1}
                  value={draft.revision_limit}
                  onChange={(e) => setDraft({ ...draft, revision_limit: e.target.value })}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="block space-y-1 text-xs text-gray-400">
              <span>Kullanım hakkı (kısa)</span>
              <textarea
                rows={2}
                maxLength={AGREEMENT_LIMITS.usageRightsMax}
                placeholder="Ör. içerik markanın hesabında 3 ay kullanılabilir"
                value={draft.usage_rights}
                onChange={(e) => setDraft({ ...draft, usage_rights: e.target.value })}
                className={inputClass}
              />
            </label>

            <div className="space-y-2">
              <p className="text-xs text-gray-400">Teslimatlar</p>
              {draft.deliverables.map((row, index) => (
                <div key={row.id ?? `new-${index}`} className="grid gap-2 rounded-2xl border border-white/10 p-3 sm:grid-cols-[1fr_80px_150px_auto]">
                  <select value={row.kind} onChange={(e) => updateRow(index, { kind: e.target.value as DeliverableKind })} className={inputClass}>
                    {DELIVERABLE_KINDS.map((k) => (
                      <option key={k} value={k} className="bg-[#0F1014]">
                        {DELIVERABLE_KIND_LABELS[k]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={AGREEMENT_LIMITS.maxQuantity}
                    aria-label="Adet"
                    value={row.quantity}
                    onChange={(e) => updateRow(index, { quantity: e.target.value })}
                    className={inputClass}
                  />
                  <input type="date" aria-label="Teslim tarihi" value={row.due_date} onChange={(e) => updateRow(index, { due_date: e.target.value })} className={inputClass} />
                  <button
                    type="button"
                    disabled={!!row.id && lockedIds.has(row.id)}
                    title={row.id && lockedIds.has(row.id) ? 'Taslağı gönderilmiş teslimat çıkarılamaz' : undefined}
                    onClick={() => setDraft({ ...draft, deliverables: draft.deliverables.filter((_, i) => i !== index) })}
                    className={buttonClass('red')}
                  >
                    Çıkar
                  </button>
                  <input
                    maxLength={AGREEMENT_LIMITS.deliverableNoteMax}
                    placeholder="Kısa not (isteğe bağlı)"
                    value={row.note}
                    onChange={(e) => updateRow(index, { note: e.target.value })}
                    className={`${inputClass} sm:col-span-4`}
                  />
                </div>
              ))}
              {draft.deliverables.length < AGREEMENT_LIMITS.maxDeliverables && (
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, deliverables: [...draft.deliverables, { id: null, kind: 'story', quantity: '1', note: '', due_date: '' }] })}
                  className={buttonClass('plain')}
                >
                  + Teslimat ekle
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={saveAgreement} className={buttonClass('gold')}>
                Kaydet
              </button>
              <button type="button" disabled={busy} onClick={() => setEditing(false)} className={buttonClass('plain')}>
                Vazgeç
              </button>
            </div>
          </div>
        ) : agreement ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Ücret</dt>
                <dd>
                  {formatTry(agreement.fee_amount)} · {PAYMENT_TYPE_LABELS[agreement.payment_type]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Revize sayısı</dt>
                <dd>{agreement.revision_limit}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-gray-500">Kullanım hakkı</dt>
                <dd className="whitespace-pre-line">{agreement.usage_rights || '—'}</dd>
              </div>
            </dl>
            <ul className="space-y-1 text-sm">
              {deliverables.map((d) => (
                <li key={d.id} className="text-gray-200">
                  • {DELIVERABLE_KIND_LABELS[d.kind]} ×{d.quantity}
                  {d.due_date ? <span className="text-gray-400"> · teslim {formatDate(d.due_date)}</span> : null}
                  {d.note ? <span className="text-gray-400"> · {d.note}</span> : null}
                </li>
              ))}
            </ul>
            <div className="grid gap-1 text-xs text-gray-400 sm:grid-cols-2">
              <p>
                Marka onayı:{' '}
                <span className="text-gray-200">{agreement.brand_confirmed_at ? formatDateTime(agreement.brand_confirmed_at) : 'bekleniyor'}</span>
              </p>
              <p>
                Influencer onayı:{' '}
                <span className="text-gray-200">{agreement.influencer_confirmed_at ? formatDateTime(agreement.influencer_confirmed_at) : 'bekleniyor'}</span>
              </p>
            </div>
            <p className="text-xs text-gray-500">{AGREEMENT_SUMMARY_NOTE}</p>
            <div className="flex flex-wrap gap-2">
              {permissions.canConfirmAgreement && (
                <button type="button" disabled={busy} onClick={() => run({ action: 'confirm_agreement', version: agreement.version })} className={buttonClass('emerald')}>
                  Özeti onayla
                </button>
              )}
              {permissions.canEditAgreement && (
                <button type="button" disabled={busy} onClick={startEditing} className={buttonClass('plain')}>
                  Düzenle
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm text-gray-300">
            <p>
              Henüz anlaşma özeti yok. Teslimatları, ücreti, tarihleri, kullanım hakkını ve revize sayısını bir taraf yazar, diğeri onaylar.
            </p>
            {permissions.canEditAgreement && (
              <button type="button" onClick={startEditing} className={buttonClass('gold')}>
                Anlaşma özeti hazırla
              </button>
            )}
          </div>
        )}
      </section>

      {/* Teslimatlar */}
      {deliverables.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-[#0F1014] p-6">
          <h2 className="text-lg font-semibold">Teslimatlar</h2>
          {!workspace.agreementConfirmed && ['agreed', 'in_progress'].includes(collab.status) && (
            <p className="mt-2 text-xs text-gray-400">Teslimatlar, anlaşma özeti iki tarafça onaylanınca başlar.</p>
          )}
          <ul className="mt-4 space-y-4">
            {deliverables.map((d) => (
              <DeliverableCard
                key={d.id}
                d={d}
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
        </section>
      )}

      {/* Ödeme */}
      <section className="rounded-3xl border border-white/10 bg-[#0F1014] p-6">
        <h2 className="text-lg font-semibold">Ödeme</h2>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="text-gray-400">
            Marka:{' '}
            <span className="text-gray-200">
              {payment?.brand_paid_at ? `Ödeme yapıldı (${formatDate(payment.brand_paid_date) ?? formatDate(payment.brand_paid_at)})` : 'işaretlenmedi'}
            </span>
            {payment?.brand_note ? <span className="block text-xs text-gray-500">{payment.brand_note}</span> : null}
          </p>
          <p className="text-gray-400">
            Influencer:{' '}
            <span className="text-gray-200">
              {payment?.influencer_received_at
                ? `Ödeme alındı (${formatDate(payment.influencer_received_date) ?? formatDate(payment.influencer_received_at)})`
                : 'teyit edilmedi'}
            </span>
            {payment?.influencer_note ? <span className="block text-xs text-gray-500">{payment.influencer_note}</span> : null}
          </p>
        </div>
        {payment?.nonpayment_reported_at && (
          <p className="mt-3 text-xs text-yellow-200">Ödeme alınamadı bildirimi {formatDate(payment.nonpayment_reported_at)} tarihinde destek ekibine iletildi.</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {permissions.canMarkPaid && (
            <button type="button" disabled={busy} onClick={() => openForm('mark_paid')} className={buttonClass('emerald')}>
              {payment?.brand_paid_at ? 'Ödeme bilgisini güncelle' : 'Ödeme yapıldı'}
            </button>
          )}
          {permissions.canUnmarkPaid && (
            <button type="button" disabled={busy} onClick={() => run({ action: 'unmark_paid' })} className={buttonClass('plain')}>
              İşareti kaldır
            </button>
          )}
          {permissions.canConfirmPayment && (
            <button type="button" disabled={busy} onClick={() => openForm('confirm_payment')} className={buttonClass('emerald')}>
              {payment?.influencer_received_at ? 'Ödeme bilgisini güncelle' : 'Ödeme alındı'}
            </button>
          )}
          {permissions.canUnconfirmPayment && (
            <button type="button" disabled={busy} onClick={() => run({ action: 'unconfirm_payment' })} className={buttonClass('plain')}>
              Teyidi kaldır
            </button>
          )}
          {permissions.canReportNonpayment && (
            <button type="button" disabled={busy} onClick={() => openForm('report_nonpayment')} className={buttonClass('red')}>
              Ödeme alamadım
            </button>
          )}
        </div>
        {!permissions.canReportNonpayment && permissions.nonpaymentAvailableAt && !payment?.nonpayment_reported_at && (
          <p className="mt-3 text-xs text-gray-500">
            Ödemeyi alamazsanız {formatDate(permissions.nonpaymentAvailableAt)} tarihinden sonra buradan destek ekibine bildirebilirsiniz.
          </p>
        )}

        {(form?.key === 'mark_paid' || form?.key === 'confirm_payment') && (
          <form
            className="mt-4 grid gap-2 sm:grid-cols-[170px_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault()
              run({ action: form.key, date: form.date, note: form.note })
            }}
          >
            <input type="date" required max={today()} aria-label="Ödeme tarihi" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
            <input
              maxLength={AGREEMENT_LIMITS.paymentNoteMax}
              placeholder="Not (isteğe bağlı)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass}
            />
            <button type="submit" disabled={busy} className={buttonClass('gold')}>
              Kaydet
            </button>
          </form>
        )}
        {form?.key === 'report_nonpayment' && (
          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault()
              run({ action: 'report_nonpayment', note: form.note })
            }}
          >
            <p className="text-xs text-gray-400">Bildiriminiz destek ekibine iletilir ve markaya haber verilir.</p>
            <textarea
              rows={2}
              maxLength={500}
              placeholder="Kısa açıklama (isteğe bağlı)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className={inputClass}
            />
            <button type="submit" disabled={busy} className="rounded-xl bg-red-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50">
              Destek ekibine bildir
            </button>
          </form>
        )}
      </section>
    </div>
  )
}

function DeliverableCard({
  d,
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
    <li className="rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {DELIVERABLE_KIND_LABELS[d.kind]} ×{d.quantity}
          </p>
          <p className="text-xs text-gray-400">
            {d.due_date ? `Teslim: ${formatDate(d.due_date)} · ` : ''}
            {revisionUsageText(d.revisions_used, revisionLimit)}
          </p>
          {d.note && <p className="mt-1 text-xs text-gray-400">{d.note}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${DELIVERABLE_STYLES[d.status]}`}>{DELIVERABLE_STATUS_LABELS[d.status]}</span>
      </div>

      {d.draft_url && (
        <p className="mt-3 text-sm">
          <span className="text-xs text-gray-500">Son taslak: </span>
          <a href={d.draft_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-soft-gold hover:underline">
            {d.draft_url}
          </a>
          {d.draft_note && <span className="block text-xs text-gray-400">{d.draft_note}</span>}
        </p>
      )}
      {d.status === 'revision_requested' && d.review_note && <p className="mt-2 text-xs text-yellow-200">Revize isteği: {d.review_note}</p>}
      {d.publish_url && (
        <p className="mt-2 text-sm">
          <span className="text-xs text-gray-500">Yayın: </span>
          <a href={d.publish_url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-soft-gold hover:underline">
            {d.publish_url}
          </a>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {d.actions.includes('submit_draft') && (
          <button type="button" disabled={busy} onClick={() => openForm(key('submit_draft'))} className={buttonClass('purple')}>
            {d.status === 'pending' ? 'Taslak gönder' : 'Yeni taslak gönder'}
          </button>
        )}
        {d.actions.includes('approve_draft') && (
          <button type="button" disabled={busy} onClick={() => run({ action: 'approve_draft', deliverableId: d.id })} className={buttonClass('emerald')}>
            Taslağı onayla
          </button>
        )}
        {d.actions.includes('request_revision') && (
          <button type="button" disabled={busy} onClick={() => openForm(key('request_revision'))} className={buttonClass('yellow')}>
            Revize iste
          </button>
        )}
        {isBrand && d.status === 'draft_submitted' && limitReached && <span className="self-center text-xs text-gray-500">Revize hakkı doldu.</span>}
        {d.actions.includes('publish_deliverable') && (
          <button type="button" disabled={busy} onClick={() => openForm(key('publish_deliverable'))} className={buttonClass('gold')}>
            Yayın linkini gir
          </button>
        )}
        {d.submissions.length > 0 && (
          <button type="button" onClick={toggleHistory} className={buttonClass('plain')}>
            Geçmiş ({d.submissions.length})
          </button>
        )}
      </div>

      {form?.key === key('submit_draft') && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: 'submit_draft', deliverableId: d.id, url: form.url, note: form.note })
          }}
        >
          <input
            type="url"
            required
            maxLength={500}
            placeholder="https://drive.google.com/... veya WeTransfer / önizleme linki"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className={inputClass}
          />
          <textarea
            rows={2}
            maxLength={AGREEMENT_LIMITS.draftNoteMax}
            placeholder="Not (isteğe bağlı)"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputClass}
          />
          <button type="submit" disabled={busy} className={buttonClass('gold')}>
            Gönder
          </button>
        </form>
      )}
      {form?.key === key('request_revision') && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: 'request_revision', deliverableId: d.id, note: form.note })
          }}
        >
          <p className="text-xs text-gray-400">
            Bu istekle {revisionUsageText(d.revisions_used + 1, revisionLimit)}.
          </p>
          <textarea
            rows={2}
            required
            minLength={3}
            maxLength={AGREEMENT_LIMITS.reviewNoteMax}
            placeholder="Ne değişmeli?"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className={inputClass}
          />
          <button type="submit" disabled={busy} className={buttonClass('gold')}>
            Revize iste
          </button>
        </form>
      )}
      {form?.key === key('publish_deliverable') && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            run({ action: 'publish_deliverable', deliverableId: d.id, url: form.url })
          }}
        >
          <input
            type="url"
            required
            maxLength={500}
            placeholder="https://www.instagram.com/p/..."
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className={inputClass}
          />
          <button type="submit" disabled={busy} className={buttonClass('gold')}>
            Gönder
          </button>
        </form>
      )}

      {historyOpen && (
        <ol className="mt-3 space-y-2 border-l border-white/10 pl-3 text-xs text-gray-400">
          {d.submissions.map((s) => (
            <li key={s.id}>
              <span className="text-gray-300">{formatDateTime(s.created_at)}</span>
              {s.url && (
                <>
                  {' · '}
                  <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-soft-gold hover:underline">
                    taslak
                  </a>
                </>
              )}
              {s.note ? ` · ${s.note}` : ''}
              {s.review === 'approved' && <span className="text-emerald-300"> · onaylandı</span>}
              {s.review === 'revision_requested' && <span className="text-yellow-200"> · revize: {s.review_note}</span>}
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
