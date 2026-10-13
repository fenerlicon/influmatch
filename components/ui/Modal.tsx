'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button, type ButtonVariant } from './Button'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Alt şerit (butonlar). */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** İşlem sürerken dışarı tıklama/Esc ile kapanmayı engeller. */
  dismissible?: boolean
  className?: string
}

const widths = { sm: 'max-w-sm', md: 'max-w-[460px]', lg: 'max-w-2xl' }

/** Tek pencere bileşeni: portal, Esc, dışarı tıklama, odak tuzağı, kaydırma kilidi. */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true, className }: ModalProps) {
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  // Ebeveyn her çizimde yeni onClose verse de efekt yeniden çalışmasın (yoksa odak ilk alana atlar).
  const onCloseRef = useRef(onClose)
  const dismissibleRef = useRef(dismissible)
  onCloseRef.current = onClose
  dismissibleRef.current = dismissible

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open || !mounted) return
    const previous = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // Odak sırası: data-autofocus → içerikteki ilk alan → alt şerit → panel (Kapat düğmesi değil)
    const panel = panelRef.current
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>(`[data-modal-body] :is(${FOCUSABLE})`) ??
      panel?.querySelector<HTMLElement>(`[data-modal-footer] :is(${FOCUSABLE})`)
    ;(first ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissibleRef.current) {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, mounted])

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-line-strong bg-surface-1 shadow-modal outline-none sm:rounded-2xl',
          widths[size],
          className,
        )}
      >
        <div className="flex items-start gap-3 px-5 pb-0 pt-[18px]">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[17px] font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1.5 text-[13px] text-ink-muted">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <Button variant="ghost" size="sm" iconOnly aria-label="Kapat" onClick={onClose} className="-mr-2 -mt-1">
              <X />
            </Button>
          )}
        </div>
        {children && (
          <div data-modal-body className="overflow-y-auto px-5 pb-[18px] pt-3.5">
            {children}
          </div>
        )}
        {!children && <div className="pb-[18px]" />}
        {footer && (
          <div data-modal-footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Silme gibi geri alınamaz işlemler için 'danger'. */
  tone?: Extract<ButtonVariant, 'primary' | 'danger'>
  loading?: boolean
  children?: ReactNode
}

/** Onay penceresi (silme, reddetme vb.). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Onayla',
  cancelLabel = 'Vazgeç',
  tone = 'primary',
  loading,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      dismissible={!loading}
      footer={
        <>
          {/* Geri alınamaz işlemde odak Vazgeç'te: yanlışlıkla Enter onaylamasın */}
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading} data-autofocus={tone === 'danger' || undefined}>
            {cancelLabel}
          </Button>
          <Button variant={tone} size="sm" onClick={onConfirm} loading={loading} data-autofocus={tone !== 'danger' || undefined}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
