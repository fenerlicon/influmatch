import { Sparkles } from 'lucide-react'
import { cn } from '@/utils/cn'

/** Spotlight üyesi işareti (2026-10-19): kartlarda "Spotlight" yazısı yerine isim yanında küçük altın parıltı. */
export function SpotlightMark({ className }: { className?: string }) {
  return (
    <span title="Spotlight üyesi" aria-label="Spotlight üyesi" role="img" className={cn('inline-flex flex-none text-gold', className)}>
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
    </span>
  )
}
