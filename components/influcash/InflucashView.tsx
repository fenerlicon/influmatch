'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Coins, Gift, History, Sparkles } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Chip, ConfirmDialog, EmptyState, Notice, PageHeader, StatCard } from '@/components/ui'
import { redeemInflucashAction } from '@/app/dashboard/influcash/actions'
import { INFLUCASH_REWARD_LABELS, INFLUCASH_RULE_NOTE } from '@/lib/influcash-shared'
import type { InflucashOverview } from '@/lib/influcash'

const fmtDate = (value: string) => new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
const pts = (n: number) => n.toLocaleString('tr-TR')

type CatalogItem = InflucashOverview['catalog'][number]

function itemDetail(i: CatalogItem) {
  if (i.reward_type === 'spotlight_days') return `${i.days} gün Spotlight ${i.plan === 'pro' ? 'Pro' : 'Basic'}`
  if (i.reward_type === 'discount_percent') return `Spotlight aboneliğinde %${i.percent} indirim kodu`
  return i.partner_name ? `${i.partner_name} kuponu` : INFLUCASH_REWARD_LABELS.partner_coupon
}

/** Influcash sayfası (2026-11-23): bakiye, ödül kataloğu, nasıl kazanılır, geçmiş, alınan ödüller. */
export default function InflucashView({ overview, role }: { overview: InflucashOverview; role: 'influencer' | 'brand' }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [confirm, setConfirm] = useState<CatalogItem | null>(null)
  const r = overview.rules

  const redeem = () =>
    start(async () => {
      if (!confirm) return
      const result = await redeemInflucashAction(confirm.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      setConfirm(null)
      router.refresh()
    })

  const earn: Array<{ label: string; amount: string }> = [
    { label: 'Tamamlanan iş birliği (iki taraf ödemeyi teyit edince)', amount: `${r.collab_completed}` },
    role === 'brand'
      ? { label: 'Ödemeyi vadesinde yaptığın iş birliği', amount: `${r.ontime_payment}` }
      : { label: 'Tarihinde teslim ettiğin her teslimat', amount: `${r.ontime_delivery}` },
    { label: 'Günlük giriş (günde bir)', amount: `${r.daily_login}` },
    { label: '7 / 30 günlük giriş serisi', amount: `${r.streak_7} / ${r.streak_30}` },
    { label: 'Onaylanan görev (türe göre)', amount: `${Math.min(r.task_other, r.task_story_link)}–${Math.max(r.task_promo_video, r.task_invites, r.task_other)}` },
    { label: 'Profilini tamamlamak (bir kez)', amount: `${r.profile_complete}` },
    { label: 'Hesabının doğrulanması (bir kez)', amount: `${r.account_verified}` },
  ]

  return (
    <div className="grid max-w-[1100px] gap-5">
      <PageHeader title="Influcash" description="Platformdaki etkinliğinle puan kazan, Spotlight ödüllerine çevir." />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Bakiye" value={`${pts(overview.spendable)} puan`} detail={overview.balance < 0 ? 'Geri alınan kazanımlar nedeniyle bakiye eksiye düştü.' : undefined} />
        <StatCard label="Alınan ödül" value={overview.redemptions.length} />
        <StatCard label="Hareket" value={overview.history.length} />
      </div>
      <Notice tone="info" icon={Coins}>
        {INFLUCASH_RULE_NOTE} Günlük giriş ve seri ödülünden ayda en fazla {r.daily_monthly_cap} puan kazanılır. İptal edilen iş birliğinin ya da haklı bulunan bir ödeme / teslim
        bildiriminin puanları geri alınır.
      </Notice>

      <Card>
        <CardHeader title="Ödüller" description={overview.salesOpen ? undefined : 'Spotlight günü ödülleri satış başlayınca hesabına işlenir; indirim kodları ödeme sayfasında kullanılır.'} />
        {overview.catalog.length === 0 ? (
          <EmptyState icon={Gift} title="Şu an ödül yok" description="Yeni ödüller eklendiğinde burada görünecek." />
        ) : (
          <ul className="grid gap-3 p-5 sm:grid-cols-2">
            {overview.catalog.map((i) => (
              <li key={i.id} className="grid gap-2 rounded-xl border border-line bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14.5px] font-medium text-ink">{i.title}</p>
                  <Chip tone="gold">{pts(i.cost)} puan</Chip>
                </div>
                <p className="text-xs text-ink-muted">{itemDetail(i)}</p>
                {i.description && <p className="text-xs text-ink-faint">{i.description}</p>}
                {i.stock !== null && <p className="text-[11.5px] text-ink-faint">Kalan: {i.stock}</p>}
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="primary" disabled={!!i.blocker || pending} onClick={() => setConfirm(i)} leftIcon={<Sparkles />}>
                    Puanla al
                  </Button>
                  {i.blocker && <span className="text-[11.5px] text-ink-faint">{i.blocker}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Nasıl kazanılır" />
          <CardBody>
            <ul className="grid gap-2 text-[13.5px]">
              {earn.map((e) => (
                <li key={e.label} className="flex justify-between gap-3 border-b border-line pb-2 last:border-b-0">
                  <span className="text-ink-muted">{e.label}</span>
                  <span className="font-semibold tabular-nums text-ink">{e.amount}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Alınan ödüller" />
          <CardBody>
            {overview.redemptions.length === 0 ? (
              <p className="text-[13px] text-ink-faint">Henüz ödül almadın.</p>
            ) : (
              <ul className="grid gap-2 text-[13px]">
                {overview.redemptions.map((x) => (
                  <li key={x.id} className="grid gap-0.5 border-b border-line pb-2 last:border-b-0">
                    <span className="text-ink">
                      {x.title} <span className="text-ink-faint">· {pts(x.cost)} puan · {fmtDate(x.createdAt)}</span>
                    </span>
                    {x.code && <span className="font-mono text-gold">{x.code}</span>}
                    {x.status && <span className="text-xs text-ink-faint">{x.status}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Geçmiş" />
        {overview.history.length === 0 ? (
          <EmptyState icon={History} title="Henüz hareket yok" />
        ) : (
          <ul>
            {overview.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5 text-[13px] last:border-b-0">
                <span className="min-w-0">
                  <span className="text-ink">{h.label}</span>
                  {h.note && <span className="text-ink-faint"> · {h.note}</span>}
                  <span className="block text-xs text-ink-faint">{fmtDate(h.createdAt)}</span>
                </span>
                <span className={`font-semibold tabular-nums ${h.amount > 0 ? 'text-success' : 'text-danger'}`}>
                  {h.amount > 0 ? '+' : ''}
                  {pts(h.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={redeem}
        loading={pending}
        title="Ödülü al"
        description={confirm ? `${confirm.title} için ${pts(confirm.cost)} Influcash puanı harcanacak. Bu işlem geri alınamaz.` : undefined}
        confirmLabel="Puanla al"
      />
    </div>
  )
}
