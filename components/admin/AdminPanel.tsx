'use client'

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { toast } from 'sonner'
import { Check, RefreshCcw, Search, Trash2, Users, X } from 'lucide-react'
import {
  adminUpdateInstagramData, deleteUser, forceVerifyEmail, getAdminUserCard, manuallyAwardSpecificBadge, rejectUser, resendVerificationEmail,
  resetVerifiedBadges, setBlueTickOverride, toggleBlueTick, toggleUserSpotlight, verifyTaxId, verifyUser,
} from '@/app/admin/actions'
import { influencerBadges, brandBadges } from '@/app/badges/data'
import { getLastSeenMap } from '@/app/admin/presence/actions'
import { isOnline } from '@/lib/presence'
import {
  Avatar, Button, Card, Chip, ConfirmDialog, EmptyState, Field, Input, Modal, PageHeader, Select, StatCard, Tabs,
} from '@/components/ui'
import { cn } from '@/utils/cn'
import UserDetail from '@/components/admin/users/UserDetail'
import { displayName, hasTick, type AdminUser } from '@/components/admin/users/types'

interface AdminPanelProps {
  pendingUsers: AdminUser[]
  verifiedUsers: AdminUser[]
  rejectedUsers: AdminUser[]
  totalUsers?: number
  initialLastSeen?: Record<string, string>
  influencerCount?: number
  brandCount?: number
}

type TabKey = 'pending' | 'verified_influencer' | 'verified_brand' | 'rejected'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending', label: 'Bekleyen' },
  { key: 'verified_influencer', label: 'Onaylı influencer' },
  { key: 'verified_brand', label: 'Onaylı marka' },
  { key: 'rejected', label: 'Reddedilen' },
]

type SpotlightPlan = 'ibasic' | 'ipro' | 'mbasic' | 'mpro'

interface Ask {
  title: string
  description?: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  run: () => Promise<void>
}

type ActionResult = { error?: string | null; message?: string | null; warning?: string | boolean | null } | null | undefined

export default function AdminPanel({ pendingUsers, verifiedUsers, rejectedUsers, totalUsers = 0, influencerCount = 0, brandCount = 0, initialLastSeen = {} }: AdminPanelProps) {
  const supabase = useSupabaseClient()
  const [all, setAll] = useState<AdminUser[]>(() => [...pendingUsers, ...verifiedUsers, ...rejectedUsers])
  const [activeTab, setActiveTab] = useState<TabKey>('pending')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [ask, setAsk] = useState<Ask | null>(null)
  const [asking, setAsking] = useState(false)
  const [spotlight, setSpotlight] = useState<{ user: AdminUser; plan: SpotlightPlan; months: number } | null>(null)
  const [badge, setBadge] = useState<{ user: AdminUser; badgeId: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Çevrimiçi / son görülme: dakikada bir sunucudan tazelenir, göreli süre 30 sn'de bir yeniden hesaplanır.
  const [lastSeen, setLastSeen] = useState<Record<string, string>>(initialLastSeen)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 30_000)
    const poll = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const result = await getLastSeenMap().catch(() => null)
      if (result?.lastSeen) {
        setLastSeen(result.lastSeen)
        setNow(Date.now())
      }
    }, 60_000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(poll)
    }
  }, [])
  const onlineCount = Object.values(lastSeen).filter((iso) => isOnline(iso, now)).length

  // Sunucu verisi yenilenirse (router.refresh) listeyi eşitle
  useEffect(() => {
    setAll([...pendingUsers, ...verifiedUsers, ...rejectedUsers])
  }, [pendingUsers, verifiedUsers, rejectedUsers])

  const replaceUser = (user: AdminUser) =>
    setAll((prev) => (prev.some((u) => u.id === user.id) ? prev.map((u) => (u.id === user.id ? user : u)) : [user, ...prev]))
  const patchUser = (id: string, patch: Partial<AdminUser>) => setAll((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  const dropUser = (id: string) => {
    setAll((prev) => prev.filter((u) => u.id !== id))
    setChecked((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    setSelectedId((prev) => (prev === id ? null : prev))
  }
  // Hassas kolonlar dahil güncel kart (service role, sunucu eylemi)
  const reloadUser = async (id: string) => {
    const { user } = await getAdminUserCard(id)
    if (user) replaceUser(user as AdminUser)
  }

  // Gerçek zamanlı: durum, rozet vb. değişen kullanıcı kartı sunucudan tazelenir.
  useEffect(() => {
    const channel = supabase
      .channel('admin-users-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        const id = (payload.new as { id?: string })?.id
        if (id) reloadUser(id)
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const inTab = (u: AdminUser, tab: TabKey) =>
    tab === 'pending'
      ? u.verification_status === 'pending'
      : tab === 'rejected'
        ? u.verification_status === 'rejected'
        : u.verification_status === 'verified' && u.role === (tab === 'verified_brand' ? 'brand' : 'influencer')

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    return all
      .filter((u) => inTab(u, activeTab))
      .filter((u) => !q || [u.full_name, u.email, u.username, u.id].some((v) => v?.toLocaleLowerCase('tr-TR').includes(q)))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [all, activeTab, query])

  const selected = all.find((u) => u.id === selectedId) ?? null

  const changeTab = (tab: TabKey) => {
    setActiveTab(tab)
    setChecked(new Set())
    setSelectedId(null)
  }

  // Tek işlem: sonucu bildirir, başarıda kartı tazeler
  const perform = (fn: () => Promise<ActionResult>, opts: { success?: string; reload?: string; after?: () => void } = {}) =>
    new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const result = await fn()
          if (result?.error) {
            toast.error(result.error)
          } else if (typeof result?.warning === 'string') {
            toast.warning(result.warning)
          } else if (result?.warning) {
            toast.warning(result.message ?? 'İşlem uyarıyla tamamlandı.')
          } else {
            toast.success(result?.message || opts.success || 'İşlem tamamlandı.')
          }
          if (!result?.error) {
            opts.after?.()
            if (opts.reload) await reloadUser(opts.reload)
          }
        } catch (error) {
          console.error('[AdminPanel]', error)
          toast.error('Bir hata oluştu. Lütfen tekrar deneyin.')
        } finally {
          resolve()
        }
      })
    })

  const confirmThen = (a: Ask) => setAsk(a)
  const runAsk = async () => {
    if (!ask) return
    setAsking(true)
    await ask.run()
    setAsking(false)
    setAsk(null)
  }

  // Toplu işlem: sırayla çalışır, sonunda özet bildirir
  const bulk = async (label: string, fn: (id: string) => Promise<ActionResult>, onSuccess: (id: string) => void) => {
    const ids = Array.from(checked)
    let ok = 0
    let lastError = ''
    for (const id of ids) {
      try {
        const result = await fn(id)
        if (result?.error) lastError = result.error
        else {
          ok++
          onSuccess(id)
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Bilinmeyen hata'
      }
    }
    const failed = ids.length - ok
    if (failed) toast.error(`${ok} kullanıcı ${label}, ${failed} hata. Son hata: ${lastError}`, { duration: 6000 })
    else toast.success(`${ok} kullanıcı ${label}.`)
    setChecked(new Set())
  }

  const actionsFor = (user: AdminUser) => {
    const isBrand = user.role === 'brand'
    const tick = hasTick(user)
    return {
      verify: () =>
        confirmThen({
          title: 'Kullanıcı onaylansın mı?',
          description: `${displayName(user)} onaylanır ve panele tam erişim kazanır.`,
          confirmLabel: 'Onayla',
          run: () => perform(() => verifyUser(user.id), { success: 'Kullanıcı onaylandı.', reload: user.id }),
        }),
      reject: () =>
        confirmThen({
          title: 'Kullanıcı reddedilsin mi?',
          description: `${displayName(user)} reddedilir ve panele giremez.`,
          confirmLabel: 'Reddet',
          tone: 'danger',
          run: () => perform(() => rejectUser(user.id), { success: 'Kullanıcı reddedildi.', reload: user.id }),
        }),
      remove: () =>
        confirmThen({
          title: 'Hesap kalıcı olarak silinsin mi?',
          description: 'Kullanıcının profili, mesajları ve tüm verileri silinir. Bu işlem geri alınamaz.',
          confirmLabel: 'Hesabı sil',
          tone: 'danger',
          run: () => perform(() => deleteUser(user.id), { success: 'Kullanıcı silindi.', after: () => dropUser(user.id) }),
        }),
      resendEmail: () =>
        confirmThen({
          title: 'Doğrulama e-postası gönderilsin mi?',
          description: user.email ?? undefined,
          confirmLabel: 'Gönder',
          run: () => perform(() => resendVerificationEmail(user.id), { success: 'Doğrulama e-postası gönderildi.' }),
        }),
      forceVerifyEmail: () =>
        confirmThen({
          title: 'E-posta elle onaylansın mı?',
          description: 'E-posta gönderilmeden kullanıcının e-postası sistemde onaylı sayılır.',
          confirmLabel: 'Onayla',
          run: () =>
            perform(() => forceVerifyEmail(user.id), {
              success: 'E-posta onaylandı.',
              after: () => patchUser(user.id, { email_verified_at: new Date().toISOString() }),
            }),
        }),
      toggleTick: () =>
        confirmThen({
          title: isBrand ? (tick ? 'Sarı tik kaldırılsın mı?' : 'Sarı tik verilsin mi?') : tick ? 'Mavi tik kaldırılsın mı?' : 'Mavi tik verilsin mi?',
          description: isBrand
            ? 'Resmi İşletme rozeti elle değiştirilir.'
            : 'Mavi tik normalde otomatik kurala göre verilir (Spotlight + performans + güven). Elle değiştirmek kalıcı bir istisna oluşturur.',
          confirmLabel: tick ? 'Kaldır' : 'Ver',
          tone: tick ? 'danger' : 'primary',
          run: () => perform(() => toggleBlueTick(user.id), { reload: user.id }),
        }),
      clearTickOverride: () =>
        perform(() => setBlueTickOverride(user.id, null), { success: 'Mavi tik otomatik kurala döndürüldü.', reload: user.id }),
      verifyTaxId: () =>
        confirmThen({
          title: 'Vergi numarası onaylansın mı?',
          description: 'Onaylanınca markaya "Resmi İşletme" rozeti verilir.',
          confirmLabel: 'Onayla',
          run: () => perform(() => verifyTaxId(user.id), { success: 'Vergi numarası onaylandı.', reload: user.id }),
        }),
      spotlight: () => {
        if (user.spotlight_active) {
          confirmThen({
            title: 'Spotlight kapatılsın mı?',
            confirmLabel: 'Kapat',
            tone: 'danger',
            run: () =>
              perform(() => toggleUserSpotlight(user.id, false, null, 0), {
                after: () => patchUser(user.id, { spotlight_active: false, spotlight_plan: null }),
              }),
          })
        } else {
          setSpotlight({ user, plan: isBrand ? 'mbasic' : 'ibasic', months: 1 })
        }
      },
      awardBadge: () => setBadge({ user, badgeId: '' }),
      updateInstagram: () =>
        confirmThen({
          title: 'Instagram verisi güncellensin mi?',
          description: 'Profil ve son gönderiler yeniden çekilir (API kredisi harcar).',
          confirmLabel: 'Güncelle',
          run: () => perform(() => adminUpdateInstagramData(user.id) as Promise<ActionResult>, { success: 'Instagram verileri güncellendi.', reload: user.id }),
        }),
    }
  }

  const resetTicks = () =>
    confirmThen({
      title: 'Mavi tikler yeniden değerlendirilsin mi?',
      description: 'Tüm mavi tikler silinir ve hemen yeni kurala (Spotlight + performans + güven) göre yeniden verilir. Elle tanımlanan istisnalar korunur.',
      confirmLabel: 'Yeniden değerlendir',
      tone: 'danger',
      run: () => perform(() => resetVerifiedBadges(), { success: 'Mavi tikler yeniden değerlendirildi.', after: () => window.location.reload() }),
    })

  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((u) => inTab(u, t.key)).length])) as Record<TabKey, number>
  const pendingBrands = all.filter((u) => u.role === 'brand' && u.verification_status === 'pending').length
  const allChecked = rows.length > 0 && rows.every((u) => checked.has(u.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map((u) => u.id)))
  const toggleOne = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const badgeOptions = badge ? (badge.user.role === 'brand' ? brandBadges : influencerBadges) : []

  return (
    <div className="max-w-[1320px]">
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Toplam kullanıcı" value={totalUsers} detail={`${influencerCount} influencer · ${brandCount} marka`} />
        <StatCard
          label="Şu an çevrimiçi"
          value={<span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success" aria-hidden />{onlineCount}</span>}
          detail="Son 5 dakika"
        />
        <StatCard label="Onay bekleyen" value={counts.pending} detail={`${pendingBrands} marka`} />
        <StatCard label="Reddedilen" value={counts.rejected} />
      </div>

      <PageHeader
        title="Kullanıcılar"
        description="Onay bekleyen hesapları inceleyin; onaylı ve reddedilen hesapları yönetin."
        actions={
          <Button variant="danger" size="sm" onClick={resetTicks} disabled={isPending} leftIcon={<RefreshCcw />}>
            Mavi tikleri yeniden değerlendir
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        label="Kullanıcı durumu"
        value={activeTab}
        onSelect={(value) => changeTab(value as TabKey)}
        items={TABS.map((t) => ({ value: t.key, label: t.label, count: counts[t.key] }))}
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input aria-label="Kullanıcı ara" className="pl-9" placeholder="İsim, e-posta, kullanıcı adı veya ID ara" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {checked.size > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-ink-muted">{checked.size} seçili</span>
            {activeTab !== 'verified_influencer' && activeTab !== 'verified_brand' && (
              <Button
                size="sm"
                variant="primary"
                disabled={isPending}
                leftIcon={<Check />}
                onClick={() =>
                  confirmThen({
                    title: `${checked.size} kullanıcı onaylansın mı?`,
                    confirmLabel: 'Onayla',
                    run: () => bulk('onaylandı', (id) => verifyUser(id), (id) => reloadUser(id)),
                  })
                }
              >
                Onayla
              </Button>
            )}
            {activeTab !== 'rejected' && (
              <Button
                size="sm"
                variant="danger"
                disabled={isPending}
                leftIcon={<X />}
                onClick={() =>
                  confirmThen({
                    title: `${checked.size} kullanıcı reddedilsin mi?`,
                    confirmLabel: 'Reddet',
                    tone: 'danger',
                    run: () => bulk('reddedildi', (id) => rejectUser(id), (id) => reloadUser(id)),
                  })
                }
              >
                Reddet
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              disabled={isPending}
              leftIcon={<Trash2 />}
              onClick={() =>
                confirmThen({
                  title: `${checked.size} hesap kalıcı olarak silinsin mi?`,
                  description: 'Seçili kullanıcıların tüm verileri silinir. Bu işlem geri alınamaz.',
                  confirmLabel: 'Sil',
                  tone: 'danger',
                  run: () => bulk('silindi', (id) => deleteUser(id), dropUser),
                })
              }
            >
              Sil
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Seçimi kaldır</Button>
          </div>
        )}
      </div>

      <div className={cn('grid items-start gap-4', selected && 'lg:grid-cols-[minmax(0,1fr)_420px]')}>
        <Card className={cn('overflow-hidden', selected && 'order-2 lg:order-none')}>
          {rows.length === 0 ? (
            <EmptyState icon={Users} title="Kullanıcı yok" description={query ? 'Aramanla eşleşen kullanıcı bulunamadı.' : 'Bu durumda kullanıcı bulunmuyor.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
                    <th className="w-10 px-4 py-2.5">
                      <input type="checkbox" aria-label="Tümünü seç" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-gold" />
                    </th>
                    <th className="px-2 py-2.5 font-medium">Kullanıcı</th>
                    <th className="hidden px-3 py-2.5 font-medium md:table-cell">Rol</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">E-posta</th>
                    <th className="hidden px-3 py-2.5 font-medium xl:table-cell">Belge / profil</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">Kayıt</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => {
                    const isBrand = u.role === 'brand'
                    const sel = u.id === selectedId
                    const tax = u.tax_verification?.status
                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedId(sel ? null : u.id)}
                        aria-selected={sel}
                        className={cn('cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2', sel && 'bg-surface-2 [&>td:first-child]:shadow-[inset_2px_0_0_theme(colors.gold.DEFAULT)]')}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`${displayName(u)} seç`} checked={checked.has(u.id)} onChange={() => toggleOne(u.id)} className="h-4 w-4 accent-gold" />
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="relative">
                              <Avatar name={displayName(u)} src={u.avatar_url ?? undefined} size="sm" square={isBrand} />
                              {isOnline(lastSeen[u.id], now) && (
                                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-1 bg-success" aria-label="Çevrimiçi" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-ink">{displayName(u)}</div>
                              <div className="truncate text-xs text-ink-faint">{u.username ? `@${u.username}` : u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-3 py-3 md:table-cell">
                          <Chip tone={isBrand ? 'gold' : 'info'}>{isBrand ? 'Marka' : 'Influencer'}</Chip>
                        </td>
                        <td className="hidden px-3 py-3 sm:table-cell">
                          <Chip tone={u.email_verified_at ? 'success' : 'warning'}>{u.email_verified_at ? 'Doğrulandı' : 'Bekliyor'}</Chip>
                        </td>
                        <td className="hidden px-3 py-3 xl:table-cell">
                          {isBrand ? (
                            u.tax_id_verified ? <Chip tone="success">Vergi no onaylı</Chip>
                              : tax === 'needs_review' ? <Chip tone="warning">İnceleme gerekli</Chip>
                                : tax === 'auto_approved' ? <Chip tone="success">Kontroller geçti</Chip>
                                  : tax === 'rejected' ? <Chip tone="danger">Levha reddedildi</Chip>
                                    : <Chip>Levha yok</Chip>
                          ) : (
                            <Chip tone={Object.values(u.social_links ?? {}).some(Boolean) ? 'neutral' : 'warning'}>
                              {Object.values(u.social_links ?? {}).filter(Boolean).length} sosyal hesap
                            </Chip>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-ink-faint md:table-cell">
                          {new Date(u.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {selected && (
          <div className="order-1 lg:order-none">
            <UserDetail
              key={selected.id}
              user={selected}
              lastSeen={lastSeen[selected.id]}
              now={now}
              busy={isPending}
              actions={actionsFor(selected)}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!ask}
        onClose={() => !asking && setAsk(null)}
        onConfirm={runAsk}
        loading={asking}
        tone={ask?.tone ?? 'primary'}
        title={ask?.title ?? ''}
        description={ask?.description}
        confirmLabel={ask?.confirmLabel}
      />

      <Modal
        open={!!spotlight}
        onClose={() => setSpotlight(null)}
        title="Spotlight'ı aç"
        description={spotlight ? displayName(spotlight.user) : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSpotlight(null)}>Vazgeç</Button>
            <Button
              variant="primary"
              size="sm"
              loading={isPending}
              onClick={() =>
                spotlight &&
                perform(() => toggleUserSpotlight(spotlight.user.id, true, spotlight.plan, spotlight.months), {
                  after: () => {
                    patchUser(spotlight.user.id, { spotlight_active: true, spotlight_plan: spotlight.plan })
                    setSpotlight(null)
                  },
                })
              }
            >
              Aç
            </Button>
          </>
        }
      >
        {spotlight && (
          <div className="grid gap-4">
            <Field label="Paket">
              {(props) => (
                <Select {...props} value={spotlight.plan} onChange={(e) => setSpotlight({ ...spotlight, plan: e.target.value as SpotlightPlan })}>
                  {spotlight.user.role === 'brand' ? (
                    <>
                      <option value="mbasic">Marka Basic</option>
                      <option value="mpro">Marka Pro</option>
                    </>
                  ) : (
                    <>
                      <option value="ibasic">Influencer Basic</option>
                      <option value="ipro">Influencer Pro</option>
                    </>
                  )}
                </Select>
              )}
            </Field>
            <Field label="Süre (ay)" hint="1–24">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={24}
                  value={spotlight.months}
                  onChange={(e) => setSpotlight({ ...spotlight, months: Math.min(24, Math.max(1, parseInt(e.target.value) || 1)) })}
                />
              )}
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!badge}
        onClose={() => setBadge(null)}
        title="Rozet ver"
        description={badge ? displayName(badge.user) : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setBadge(null)}>Vazgeç</Button>
            <Button
              variant="primary"
              size="sm"
              loading={isPending}
              disabled={!badge?.badgeId}
              onClick={() =>
                badge &&
                perform(() => manuallyAwardSpecificBadge(badge.user.id, badge.badgeId), {
                  success: 'Rozet verildi.',
                  reload: badge.user.id,
                  after: () => setBadge(null),
                })
              }
            >
              Rozeti ver
            </Button>
          </>
        }
      >
        {badge && (
          <Field label="Rozet">
            {(props) => (
              <Select {...props} value={badge.badgeId} onChange={(e) => setBadge({ ...badge, badgeId: e.target.value })}>
                <option value="">Rozet seçin…</option>
                {badgeOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.description}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
      </Modal>
    </div>
  )
}
