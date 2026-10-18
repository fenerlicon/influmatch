'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { LogOut, Menu, Settings, Sparkles, X } from 'lucide-react'
import { Avatar } from '@/components/ui'
import { cn } from '@/utils/cn'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import NotificationsPopover from '@/components/dashboard/NotificationsPopover'
import { useUnreadMessageCount } from '@/components/dashboard/useUnreadMessageCount'
import { MOBILE_TABS, NAV, SETTINGS_HREF, SPOTLIGHT_HREF, isNavActive, titleFor, type NavItem, type ShellRole } from './nav-config'

export interface ShellUser {
  id: string
  role: ShellRole
  name: string
  /** @kullanıcı adı ya da e-posta (kenar çubuğunda isim altında). */
  subtitle: string | null
  avatarUrl: string | null
  spotlight: { active: boolean; planLabel: string | null; expiresText: string | null }
}

function Logo() {
  return (
    <span className="text-[15px] font-bold tracking-[0.02em] text-ink">
      INFLU<span className="text-gold">MATCH</span>
    </span>
  )
}

function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null
  return (
    <span className={cn('grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-[5px] text-[11px] font-semibold text-gold-ink', className)}>
      {count > 9 ? '9+' : count}
    </span>
  )
}

function NavLink({ item, active, unread, onNavigate }: { item: NavItem; active: boolean; unread: number; onNavigate?: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors',
        active ? 'bg-surface-2 text-ink shadow-[inset_2px_0_0_theme(colors.gold.DEFAULT)]' : 'text-ink-muted hover:bg-surface-1 hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4 flex-none" aria-hidden />
      {item.label}
      {item.unread && <UnreadBadge count={unread} className="ml-auto" />}
    </Link>
  )
}

function SignOutLink({ className }: { className?: string }) {
  const { signOut } = useSupabaseAuth()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      aria-label="Çıkış yap"
      title="Çıkış yap"
      onClick={async () => {
        setBusy(true)
        try {
          await signOut()
          // Tam sayfa geçiş: istemci önbelleğindeki oturumlu sayfalar temizlenir (girişteki boş ekran sorunuyla aynı neden).
          window.location.assign('/login')
        } finally {
          setBusy(false)
        }
      }}
      className={cn('grid h-8 w-8 flex-none place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50', className)}
    >
      <LogOut className="h-[15px] w-[15px]" aria-hidden />
    </button>
  )
}

/** Kenar çubuğunun ve mobil menünün ortak içeriği. */
function NavBody({ user, pathname, unread, onNavigate }: { user: ShellUser; pathname: string; unread: number; onNavigate?: () => void }) {
  const settingsHref = SETTINGS_HREF[user.role]
  const spotlightHref = SPOTLIGHT_HREF[user.role]
  const sp = user.spotlight
  return (
    <>
      <nav aria-label="Ana menü" className="min-h-0 flex-1 overflow-y-auto">
        {NAV[user.role].map((group, i) => (
          <div key={group.label ?? i} className={cn(i > 0 && 'mt-3.5')}>
            {group.label && <div className="px-2.5 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-faint">{group.label}</div>}
            <div className="grid gap-0.5">
              {group.items.map((item) => (
                <NavLink key={item.id} item={item} active={isNavActive(item, pathname)} unread={unread} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-line pt-3">
        {spotlightHref && (
          <Link
            href={spotlightHref}
            onClick={onNavigate}
            className="mx-1 mb-2.5 block rounded-xl border border-gold/30 bg-gold/10 p-3 transition-colors hover:border-gold/50"
          >
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gold">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {sp.active ? `Spotlight${sp.planLabel ? ` ${sp.planLabel}` : ''}` : 'Spotlight'}
            </span>
            <span className="mt-1 block text-[12.5px] text-ink-muted">
              {sp.active ? (sp.expiresText ? `${sp.expiresText} tarihine kadar aktif` : 'Aktif') : 'Paketleri incele'}
            </span>
          </Link>
        )}
        {settingsHref && (
          <Link
            href={settingsHref}
            onClick={onNavigate}
            aria-current={pathname === settingsHref ? 'page' : undefined}
            className={cn(
              'flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] transition-colors',
              pathname === settingsHref ? 'bg-surface-2 text-ink' : 'text-ink-muted hover:bg-surface-1 hover:text-ink',
            )}
          >
            <Settings className="h-4 w-4" aria-hidden />
            Ayarlar
          </Link>
        )}
        <div className="mt-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <Avatar name={user.name} src={user.avatarUrl} square={user.role === 'brand'} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-ink">{user.name}</div>
            {user.subtitle && <div className="truncate text-[12px] text-ink-faint">{user.subtitle}</div>}
          </div>
          <SignOutLink />
        </div>
        {/* MVP notu: tek bildirim alanını meşgul etmesin diye burada (karar: MVP bilgisi kalır). */}
        <p className="px-2.5 pt-2 text-[11.5px] leading-snug text-ink-faint">
          Influmatch MVP sürümünde.{' '}
          <Link href="/feedback" onClick={onNavigate} className="text-ink-muted underline underline-offset-[3px] hover:text-ink">
            Geri bildirim gönder
          </Link>
        </p>
      </div>
    </>
  )
}

/** Panel kabuğu: kenar çubuğu, üst çubuk, mobil alt sekme çubuğu ve menü. */
export default function AppShell({ user, notices, children }: { user: ShellUser; notices?: ReactNode; children: ReactNode }) {
  const pathname = usePathname() ?? ''
  const unread = useUnreadMessageCount()
  const [menuOpen, setMenuOpen] = useState(false)

  // Sayfa değişince mobil menü kapanır; açıkken arka plan kaymaz.
  useEffect(() => setMenuOpen(false), [pathname])
  useEffect(() => {
    if (!menuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const allItems = NAV[user.role].flatMap((g) => g.items)
  const tabs = MOBILE_TABS[user.role].map((id) => allItems.find((i) => i.id === id)).filter((i): i is NavItem => !!i)

  return (
    <div className="min-h-screen bg-background text-ink lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Masaüstü kenar çubuğu */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-background px-3 py-[18px] lg:flex">
        <Link href={NAV[user.role][0].items[0].href} className="px-2.5 pb-[18px] pt-1">
          <Logo />
        </Link>
        <NavBody user={user} pathname={pathname} unread={unread} />
      </aside>

      <div className="min-w-0">
        {/* Üst çubuk */}
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-background/85 px-4 backdrop-blur-md lg:px-7">
          <Link href={NAV[user.role][0].items[0].href} className="lg:hidden" aria-label="Ana sayfa">
            <Logo />
          </Link>
          <span className="text-[13px] font-medium text-ink">{titleFor(user.role, pathname)}</span>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsPopover userId={user.id} />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-6 sm:px-6 lg:px-7 lg:pb-12">
          {notices}
          {children}
        </main>
      </div>

      {/* Mobil alt sekme çubuğu */}
      <nav aria-label="Hızlı menü" className="fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-background/95 px-1 pb-[max(10px,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-md lg:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((item) => {
          const Icon = item.icon
          const active = isNavActive(item, pathname)
          return (
            <Link key={item.id} href={item.href} aria-current={active ? 'page' : undefined} className={cn('relative grid justify-items-center gap-[3px] text-[10.5px]', active ? 'text-gold' : 'text-ink-faint')}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
              {item.unread && <UnreadBadge count={unread} className="absolute left-1/2 top-[-4px] ml-1.5" />}
            </Link>
          )
        })}
        <button type="button" onClick={() => setMenuOpen(true)} aria-expanded={menuOpen} className="grid justify-items-center gap-[3px] text-[10.5px] text-ink-faint">
          <Menu className="h-5 w-5" aria-hidden />
          Menü
        </button>
      </nav>

      {/* Mobil tam menü */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[84%] max-w-[320px] flex-col border-l border-line bg-background px-3 py-4">
            <div className="mb-4 flex items-center justify-between px-2.5">
              <Logo />
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Menüyü kapat" className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <NavBody user={user} pathname={pathname} unread={unread} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
