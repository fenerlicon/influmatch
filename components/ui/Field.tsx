'use client'

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

const control =
  'w-full rounded-lg border border-line-strong bg-surface-2 px-3 text-[13.5px] text-ink outline-none transition ' +
  'placeholder:text-ink-faint focus:border-gold/40 focus:ring-[3px] focus:ring-gold/10 disabled:opacity-60 ' +
  'aria-[invalid=true]:border-danger/50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, 'h-[38px]', className)} {...props} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(control, 'h-[38px] pr-8', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(control, 'resize-none py-2.5', className)} {...props} />
})

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** Etiketin sağındaki ek (ör. "Şifremi unuttum"). */
  aside?: ReactNode
  className?: string
  /** Kontrol; id verilmezse otomatik bağlanır. */
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}

/** Etiket + kontrol + ipucu/hata. Kontrol render-prop ile alınır, id ve aria bağları otomatik. */
export function Field({ label, hint, error, aside, className, children }: FieldProps) {
  const id = useId()
  const descId = hint || error ? `${id}-desc` : undefined
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-medium text-ink-muted">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, 'aria-describedby': descId, 'aria-invalid': error ? true : undefined })}
      {(error || hint) && (
        <p id={descId} className={cn('text-xs', error ? 'text-danger' : 'text-ink-faint')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
}
