import Image from 'next/image'
import { cn } from '@/utils/cn'

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AvatarSize, { box: string; px: number; text: string }> = {
  sm: { box: 'h-7 w-7', px: 28, text: 'text-[11px]' },
  md: { box: 'h-9 w-9', px: 36, text: 'text-[13px]' },
  lg: { box: 'h-14 w-14', px: 56, text: 'text-lg' },
  xl: { box: 'h-24 w-24', px: 96, text: 'text-3xl' },
}

// Fotoğraf yoksa isimden sabit (rastgele olmayan) bir ton seçilir.
const tints = ['#2A2433', '#1F2B2A', '#2E2620', '#232838', '#302228', '#262B1F']

function initials(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toLocaleUpperCase('tr-TR')
}

function tintFor(name?: string | null) {
  let h = 0
  for (const ch of name ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return tints[h % tints.length]
}

interface AvatarProps {
  name?: string | null
  src?: string | null
  size?: AvatarSize
  /** Markalar için köşeli. */
  square?: boolean
  className?: string
}

export function Avatar({ name, src, size = 'md', square, className }: AvatarProps) {
  const s = sizes[size]
  const radius = square ? (size === 'xl' ? 'rounded-[20px]' : 'rounded-[10px]') : 'rounded-full'
  return (
    <span
      className={cn('relative grid flex-none place-items-center overflow-hidden border border-line-strong font-semibold text-ink', s.box, s.text, radius, className)}
      style={src ? undefined : { backgroundColor: tintFor(name) }}
    >
      {src ? (
        <Image src={src} alt={name ?? ''} fill sizes={`${s.px}px`} className="object-cover" unoptimized style={{ imageOrientation: 'from-image' }} />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  )
}
