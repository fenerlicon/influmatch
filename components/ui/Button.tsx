import Link from 'next/link'
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'

// Altın (primary) = ana eylem: sayfa başlığında en fazla bir, listelerde satırın kendi ana eylemi.
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:pointer-events-none disabled:opacity-50 ' +
  '[&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-gold text-gold-ink hover:bg-gold-hover',
  secondary: 'border-line-strong bg-surface-3 text-ink hover:border-white/20',
  ghost: 'border-transparent bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border-danger/35 bg-transparent text-danger hover:bg-danger/10',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-[30px] px-[11px] text-[12.5px] [&_svg]:h-3.5 [&_svg]:w-3.5',
  md: 'h-[38px] px-4 text-[13.5px] [&_svg]:h-4 [&_svg]:w-4',
  lg: 'h-[46px] px-[22px] text-[15px] rounded-[10px] [&_svg]:h-4 [&_svg]:w-4',
}

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-[30px] px-0',
  md: 'w-9 px-0',
  lg: 'w-[46px] px-0',
}

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  iconOnly = false,
  block = false,
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
  block?: boolean
  className?: string
} = {}) {
  return cn(base, variants[variant], sizes[size], iconOnly && iconSizes[size], block && 'w-full', className)
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Yalnızca ikon; erişilebilirlik için aria-label verilmeli. */
  iconOnly?: boolean
  block?: boolean
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, iconOnly, block, loading, leftIcon, rightIcon, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, iconOnly, block, className })}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  )
})

type ButtonLinkProps = ComponentProps<typeof Link> & {
  variant?: ButtonVariant
  size?: ButtonSize
  iconOnly?: boolean
  block?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

/** Buton görünümlü bağlantı (sayfa geçişleri için). */
export function ButtonLink({ variant, size, iconOnly, block, leftIcon, rightIcon, className, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, iconOnly, block, className })} {...props}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}
