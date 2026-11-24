'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button, Card, CardBody, CardHeader, Chip, ConfirmDialog, Field, Input, Notice, PageHeader, Select, StatCard, Switch, Textarea } from '@/components/ui'
import {
  addInflucashCoupons,
  adjustInflucash,
  lookupInflucashUser,
  saveInflucashFlags,
  saveInflucashItem,
  saveInflucashRules,
} from '@/app/admin/influcash/actions'
import {
  INFLUCASH_AUDIENCE_LABELS,
  INFLUCASH_REASON_LABELS,
  INFLUCASH_REWARD_LABELS,
  INFLUCASH_RULE_LABELS,
  INFLUCASH_RULE_NOTE,
  type InflucashAudience,
  type InflucashRewardType,
  type InflucashRules,
} from '@/lib/influcash-shared'
import type { InflucashAdminData, InflucashCatalogItem } from '@/lib/influcash'

const fmt = (v: string) => new Date(v).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

type ItemForm = {
  id: string | null
  title: string
  description: string
  cost: string
  audience: InflucashAudience
  reward_type: InflucashRewardType
  plan: 'basic' | 'pro'
  days: string
  percent: string
  partner_name: string
  active: boolean
  stock: string
  sort_order: string
}

const emptyItem: ItemForm = {
  id: null,
  title: '',
  description: '',
  cost: '',
  audience: 'all',
  reward_type: 'discount_percent',
  plan: 'basic',
  days: '7',
  percent: '20',
  partner_name: '',
  active: false,
  stock: '',
  sort_order: '0',
}

const toForm = (i: InflucashCatalogItem): ItemForm => ({
  id: i.id,
  title: i.title,
  description: i.description ?? '',
  cost: String(i.cost),
  audience: i.audience,
  reward_type: i.reward_type,
  plan: i.plan ?? 'basic',
  days: String(i.days ?? 7),
  percent: String(i.percent ?? 20),
  partner_name: i.partner_name ?? '',
  active: i.active,
  stock: i.stock === null ? '' : String(i.stock),
  sort_order: String(i.sort_order),
})

type Lookup = Extract<Awaited<ReturnType<typeof lookupInflucashUser>>, { success: true }>

/** Influcash admin (2026-11-23): bayraklar (onaylı), puan kuralları, katalog, iş ortağı kodları (altyapı), kullanıcı hareketleri ve elle düzeltme. */
export default function InflucashAdmin({ data }: { data: InflucashAdminData }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [flagConfirm, setFlagConfirm] = useState<{ key: 'enabled' | 'partnerCouponsEnabled'; value: boolean } | null>(null)
  const [rules, setRules] = useState<Record<keyof InflucashRules, string>>(
    Object.fromEntries(Object.entries(data.settings.rules).map(([k, v]) => [k, String(v)])) as Record<keyof InflucashRules, string>,
  )
  const [item, setItem] = useState<ItemForm | null>(null)
  const [coupons, setCoupons] = useState<{ itemId: string; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Lookup | null>(null)
  const [adjust, setAdjust] = useState({ amount: '', note: '' })

  const act = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string, after?: () => void) =>
    start(async () => {
      const r = await fn()
      if (!r.success) {
        toast.error(r.error ?? 'İşlem yapılamadı.')
        return
      }
      toast.success(ok)
      after?.()
      router.refresh()
    })

  const search = () =>
    start(async () => {
      const r = await lookupInflucashUser(query)
      if (!r.success) {
        toast.error(r.error)
        setFound(null)
        return
      }
      setFound(r)
    })

  return (
    <div className="grid max-w-[1100px] gap-5">
      <PageHeader title="Influcash" description={`Puan sistemi. ${INFLUCASH_RULE_NOTE}`} />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Verilen puan" value={data.totals.issued.toLocaleString('tr-TR')} />
        <StatCard label="Harcanan / geri alınan" value={data.totals.spent.toLocaleString('tr-TR')} />
        <StatCard label="Bakiyesi olan kullanıcı" value={data.totals.holders} />
      </div>

      <Card>
        <CardHeader title="Bayraklar" />
        <CardBody className="grid gap-3 text-[13.5px]">
          <label className="flex items-center justify-between gap-3">
            <span>
              Influcash açık
              <span className="block text-xs text-ink-faint">Kapalıyken hiçbir puan yazılmaz, kullanıcı arayüzü gizlidir.</span>
            </span>
            <Switch checked={data.settings.enabled} disabled={pending} onChange={(v) => setFlagConfirm({ key: 'enabled', value: v })} label="Influcash açık" />
          </label>
          <label className="flex items-center justify-between gap-3">
            <span>
              İş ortağı kuponları
              <span className="block text-xs text-ink-faint">Yalnızca altyapı; açılınca kupon ödülleri kullanıcı kataloğunda görünür.</span>
            </span>
            <Switch
              checked={data.settings.partnerCouponsEnabled}
              disabled={pending}
              onChange={(v) => setFlagConfirm({ key: 'partnerCouponsEnabled', value: v })}
              label="İş ortağı kuponları"
            />
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Puan kuralları" description="Puan tutarları ve sınırlar. Değişiklik yeni kazanımlara uygulanır." />
        <CardBody className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(INFLUCASH_RULE_LABELS) as Array<keyof InflucashRules>).map((key) => (
              <Field key={key} label={INFLUCASH_RULE_LABELS[key]}>
                {(props) => <Input {...props} type="number" min={0} step={1} value={rules[key]} onChange={(e) => setRules({ ...rules, [key]: e.target.value })} />}
              </Field>
            ))}
          </div>
          <div>
            <Button variant="primary" loading={pending} onClick={() => act(() => saveInflucashRules(rules), 'Kurallar kaydedildi.')}>
              Kuralları kaydet
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Ödül kataloğu"
          action={
            <Button size="sm" onClick={() => setItem({ ...emptyItem })}>
              Yeni ödül
            </Button>
          }
        />
        <CardBody className="grid gap-2">
          {data.catalog.length === 0 && <p className="text-[13px] text-ink-faint">Katalog boş.</p>}
          {data.catalog.map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 text-[13px] last:border-b-0">
              <span className="min-w-0">
                <span className="text-ink">{i.title}</span>
                <span className="text-ink-faint">
                  {' '}
                  · {i.cost} puan · {INFLUCASH_REWARD_LABELS[i.reward_type]} · {INFLUCASH_AUDIENCE_LABELS[i.audience]}
                  {i.stock !== null ? ` · stok ${i.stock}` : ''}
                  {i.reward_type === 'partner_coupon' ? ` · boş kod ${i.freeCoupons}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Chip tone={i.active ? 'success' : 'neutral'}>{i.active ? 'Aktif' : 'Kapalı'}</Chip>
                {i.reward_type === 'partner_coupon' && (
                  <Button size="sm" variant="ghost" onClick={() => setCoupons({ itemId: i.id, text: '' })}>
                    Kod ekle
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setItem(toForm(i))}>
                  Düzenle
                </Button>
              </span>
            </div>
          ))}

          {item && (
            <div className="mt-2 grid gap-3 rounded-xl border border-line bg-surface-2 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ödül adı">{(p) => <Input {...p} maxLength={120} value={item.title} onChange={(e) => setItem({ ...item, title: e.target.value })} />}</Field>
                <Field label="Puan">{(p) => <Input {...p} type="number" min={1} value={item.cost} onChange={(e) => setItem({ ...item, cost: e.target.value })} />}</Field>
                <Field label="Kitle">
                  {(p) => (
                    <Select {...p} value={item.audience} onChange={(e) => setItem({ ...item, audience: e.target.value as InflucashAudience })}>
                      {(Object.keys(INFLUCASH_AUDIENCE_LABELS) as InflucashAudience[]).map((a) => (
                        <option key={a} value={a}>
                          {INFLUCASH_AUDIENCE_LABELS[a]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field label="Ödül türü">
                  {(p) => (
                    <Select {...p} value={item.reward_type} onChange={(e) => setItem({ ...item, reward_type: e.target.value as InflucashRewardType })}>
                      {(Object.keys(INFLUCASH_REWARD_LABELS) as InflucashRewardType[]).map((t) => (
                        <option key={t} value={t}>
                          {INFLUCASH_REWARD_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
                {item.reward_type === 'spotlight_days' && (
                  <>
                    <Field label="Paket">
                      {(p) => (
                        <Select {...p} value={item.plan} onChange={(e) => setItem({ ...item, plan: e.target.value as 'basic' | 'pro' })}>
                          <option value="basic">Basic</option>
                          <option value="pro">Pro</option>
                        </Select>
                      )}
                    </Field>
                    <Field label="Gün">{(p) => <Input {...p} type="number" min={1} max={365} value={item.days} onChange={(e) => setItem({ ...item, days: e.target.value })} />}</Field>
                  </>
                )}
                {item.reward_type === 'discount_percent' && (
                  <Field label="İndirim yüzdesi" hint="iyzico'da bu yüzdenin indirimli planı olmalı (scripts/iyzico-sync-plans.mjs --discounts).">
                    {(p) => <Input {...p} type="number" min={1} max={90} value={item.percent} onChange={(e) => setItem({ ...item, percent: e.target.value })} />}
                  </Field>
                )}
                {item.reward_type === 'partner_coupon' && (
                  <Field label="İş ortağı">{(p) => <Input {...p} maxLength={120} value={item.partner_name} onChange={(e) => setItem({ ...item, partner_name: e.target.value })} />}</Field>
                )}
                <Field label="Stok (boş = sınırsız)">{(p) => <Input {...p} type="number" min={0} value={item.stock} onChange={(e) => setItem({ ...item, stock: e.target.value })} />}</Field>
                <Field label="Sıra">{(p) => <Input {...p} type="number" value={item.sort_order} onChange={(e) => setItem({ ...item, sort_order: e.target.value })} />}</Field>
              </div>
              <Field label="Açıklama (isteğe bağlı)">
                {(p) => <Textarea {...p} rows={2} maxLength={500} value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} />}
              </Field>
              <label className="flex items-center gap-2 text-[13px]">
                <Switch checked={item.active} onChange={(v) => setItem({ ...item, active: v })} label="Aktif" /> Aktif (kullanıcı kataloğunda görünür)
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setItem(null)}>
                  Vazgeç
                </Button>
                <Button variant="primary" loading={pending} onClick={() => act(() => saveInflucashItem(item), 'Ödül kaydedildi.', () => setItem(null))}>
                  Kaydet
                </Button>
              </div>
            </div>
          )}

          {coupons && (
            <div className="mt-2 grid gap-2 rounded-xl border border-line bg-surface-2 p-4">
              <Field label="Kupon kodları (satır başına bir)">
                {(p) => <Textarea {...p} rows={5} value={coupons.text} onChange={(e) => setCoupons({ ...coupons, text: e.target.value })} />}
              </Field>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setCoupons(null)}>
                  Vazgeç
                </Button>
                <Button variant="primary" loading={pending} onClick={() => act(() => addInflucashCoupons(coupons.itemId, coupons.text), 'Kodlar eklendi.', () => setCoupons(null))}>
                  Ekle
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Kullanıcı hareketleri ve düzeltme" />
        <CardBody className="grid gap-3">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              search()
            }}
          >
            <Input placeholder="Kullanıcı adı, e-posta ya da kimlik" aria-label="Kullanıcı ara" value={query} onChange={(e) => setQuery(e.target.value)} />
            <Button type="submit" loading={pending}>
              Ara
            </Button>
          </form>
          {found && (
            <div className="grid gap-3">
              <p className="text-[13.5px] text-ink">
                {found.user.label} · bakiye <b>{found.balance}</b>
              </p>
              <div className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto]">
                <Input type="number" placeholder="± puan" aria-label="Tutar" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} />
                <Input placeholder="Neden (zorunlu, kullanıcıya görünür)" aria-label="Neden" maxLength={300} value={adjust.note} onChange={(e) => setAdjust({ ...adjust, note: e.target.value })} />
                <Button
                  variant="primary"
                  loading={pending}
                  disabled={!adjust.amount || adjust.note.trim().length < 3}
                  onClick={() =>
                    act(() => adjustInflucash(found.user.id, Number(adjust.amount), adjust.note), 'Düzeltme kaydedildi.', () => {
                      setAdjust({ amount: '', note: '' })
                      search()
                    })
                  }
                >
                  Düzelt
                </Button>
              </div>
              <ul className="grid gap-1 text-xs text-ink-muted">
                {found.rows.map((r) => (
                  <li key={r.id}>
                    {fmt(r.createdAt)} · {r.label} · <span className={r.amount > 0 ? 'text-success' : 'text-danger'}>{r.amount > 0 ? `+${r.amount}` : r.amount}</span>
                    {r.note ? ` · ${r.note}` : ''} <span className="text-ink-faint">({r.ref})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Son hareketler" />
        <CardBody>
          <ul className="grid gap-1 text-xs text-ink-muted">
            {data.recent.map((r) => (
              <li key={r.id}>
                {fmt(r.createdAt)} · {r.userLabel} · {INFLUCASH_REASON_LABELS[r.reason] ?? r.reason} ·{' '}
                <span className={r.amount > 0 ? 'text-success' : 'text-danger'}>{r.amount > 0 ? `+${r.amount}` : r.amount}</span>
                {r.note ? ` · ${r.note}` : ''}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={!!flagConfirm}
        onClose={() => setFlagConfirm(null)}
        loading={pending}
        title={flagConfirm?.value ? 'Açılsın mı' : 'Kapatılsın mı'}
        description={
          flagConfirm?.key === 'enabled'
            ? flagConfirm.value
              ? 'Influcash açılınca puanlar yazılmaya başlar ve kullanıcılar sayfayı görür.'
              : 'Kapanınca yeni puan yazılmaz ve kullanıcı arayüzü gizlenir; mevcut bakiyeler korunur.'
            : 'İş ortağı kupon ödülleri kullanıcı kataloğunda görünür / gizlenir.'
        }
        onConfirm={() => {
          if (!flagConfirm) return
          act(() => saveInflucashFlags({ [flagConfirm.key]: flagConfirm.value }), 'Kaydedildi.', () => setFlagConfirm(null))
        }}
      />
      {!data.settings.enabled && <Notice tone="info">Influcash kapalı: toplu testten sonra açın.</Notice>}
    </div>
  )
}
