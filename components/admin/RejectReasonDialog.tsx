'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button, Field, Modal, Select, Textarea } from '@/components/ui'
import { MODERATION_REASONS, REASON_TEXT_MAX, type ModerationSubjectType } from '@/lib/moderation-shared'

export interface RejectReasonValue {
  code: string
  text: string
}

/** Ret nedeni alanları: hazır kategori + açıklama ("Diğer"de zorunlu). Kullanıcıya gösterilir, itiraz bu karara bağlanır. */
export function RejectReasonFields({
  subjectType,
  value,
  onChange,
}: {
  subjectType: ModerationSubjectType
  value: RejectReasonValue
  onChange: (value: RejectReasonValue) => void
}) {
  const other = value.code === 'other'
  return (
    <div className="grid gap-3">
      <Field label="Ret nedeni (kullanıcıya gösterilir)">
        {(props) => (
          <Select {...props} value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value })}>
            <option value="">Neden seçin…</option>
            {MODERATION_REASONS[subjectType].map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field
        label={other ? 'Açıklama (zorunlu)' : 'Açıklama (isteğe bağlı)'}
        hint={`${value.text.length} / ${REASON_TEXT_MAX}`}
      >
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            maxLength={REASON_TEXT_MAX}
            value={value.text}
            placeholder="Kullanıcının neyi düzeltmesi gerektiğini kısaca yazın."
            onChange={(e) => onChange({ ...value, text: e.target.value })}
          />
        )}
      </Field>
    </div>
  )
}

export function isReasonReady(value: RejectReasonValue) {
  return !!value.code && (value.code !== 'other' || value.text.trim().length >= 3)
}

/** Ret penceresi: neden seçilmeden "Reddet" pasif. */
export default function RejectReasonDialog({
  open,
  onClose,
  onConfirm,
  loading,
  subjectType,
  title,
  description,
  confirmLabel = 'Reddet',
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: RejectReasonValue) => void | Promise<void>
  loading?: boolean
  subjectType: ModerationSubjectType
  title: string
  description?: ReactNode
  confirmLabel?: string
}) {
  const [value, setValue] = useState<RejectReasonValue>({ code: '', text: '' })
  useEffect(() => {
    if (open) setValue({ code: '', text: '' })
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!loading}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" loading={loading} disabled={!isReasonReady(value)} onClick={() => onConfirm(value)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <RejectReasonFields subjectType={subjectType} value={value} onChange={setValue} />
      <p className="mt-3 text-xs text-ink-faint">Kullanıcı nedeni bildirimde görür ve bu karara bir kez itiraz edebilir.</p>
    </Modal>
  )
}
