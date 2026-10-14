'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { updatePlatformSettings } from '@/app/admin/limits/actions'
import type { PlatformSettings } from '@/lib/platform-settings-shared'
import { Button, Card, CardBody, CardHeader, Chip, ConfirmDialog, Field, Input, PageHeader, Switch } from '@/components/ui'

type LimitKey =
  | 'free_offers_per_day'
  | 'free_offers_per_month'
  | 'free_active_adverts'
  | 'basic_offers_per_day'
  | 'basic_offers_per_month'
  | 'basic_active_adverts'

const LIMIT_ROWS: { label: string; free: LimitKey; basic: LimitKey }[] = [
  { label: 'Günlük teklif', free: 'free_offers_per_day', basic: 'basic_offers_per_day' },
  { label: 'Aylık teklif (takvim ayı, Türkiye saati)', free: 'free_offers_per_month', basic: 'basic_offers_per_month' },
  { label: 'Aynı anda aktif ilan', free: 'free_active_adverts', basic: 'basic_active_adverts' },
]

type FormState = Record<keyof PlatformSettings, string | boolean>

function toForm(settings: PlatformSettings): FormState {
  const out = {} as FormState
  for (const [key, value] of Object.entries(settings) as [keyof PlatformSettings, unknown][]) {
    out[key] = typeof value === 'boolean' ? value : value === null ? '' : String(value)
  }
  return out
}

/** Ücretsiz marka sınırları + keşif çarkı ayarları (admin). Boş alan = sınırsız. */
export default function PlatformSettingsPanel({ initialSettings }: { initialSettings: PlatformSettings }) {
  const [form, setForm] = useState<FormState>(() => toForm(initialSettings))
  const [saved, setSaved] = useState<PlatformSettings>(initialSettings)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const setField = (key: keyof PlatformSettings, value: string | boolean) => setForm((prev) => ({ ...prev, [key]: value }))
  const flagChanged = form.free_brand_limits_enabled !== saved.free_brand_limits_enabled

  const save = () => {
    startTransition(async () => {
      const result = await updatePlatformSettings(form as Record<string, unknown>)
      setConfirmOpen(false)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      setSaved(result.settings)
      setForm(toForm(result.settings))
      toast.success('Ayarlar kaydedildi.')
    })
  }

  // Ana bayrak değişiyorsa kayıttan önce etkisi onaylatılır
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (flagChanged) setConfirmOpen(true)
    else save()
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Marka sınırları"
        description="Ücretsiz marka sınırları ve keşif çarkı. Karar (2026-10-10): satış başlayana kadar kapalı kalır."
      />

      <form onSubmit={handleSubmit} className="grid gap-4">
        <Card>
          <CardHeader
            title="Sınırlar, keşif çarkı ve favori/liste kilidi"
            description={`Şu an ${saved.free_brand_limits_enabled ? 'açık' : 'kapalı'}`}
            action={
              <Switch
                checked={form.free_brand_limits_enabled === true}
                onChange={(checked) => setField('free_brand_limits_enabled', checked)}
                label="Ücretsiz marka sınırları"
              />
            }
          />
          <CardBody className="grid gap-2 text-[13px] text-ink-muted">
            <p>Kapalıyken hiçbir sınır uygulanmaz, keşif bugünkü gibidir.</p>
            <p>
              Açıkken Spotlight olmayan markalar keşifte yalnızca çarktaki profilleri görür; Basic sınırları aşağıdaki değerlerle
              (boş = sınırsız), Pro her zaman sınırsızdır. Aynı bayrak ücretsiz markalarda favorileri ve listeleri (Inflist) de
              kilitler: kayıtlar silinmez, yalnızca gizlenir ve marka Spotlight alınca geri gelir. Influencer/UGC hesapları sınırlanmaz.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Keşif çarkı (ücretsiz marka)" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Çevirme başına profil" hint="1–50">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={String(form.wheel_profiles_per_day)}
                  onChange={(event) => setField('wheel_profiles_per_day', event.target.value)}
                />
              )}
            </Field>
            <Field label="Açık kalma süresi / çevirme aralığı (saat)" hint="1–168">
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  min={1}
                  max={168}
                  required
                  value={String(form.wheel_window_hours)}
                  onChange={(event) => setField('wheel_window_hours', event.target.value)}
                />
              )}
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Teklif ve ilan sınırları" description="Boş bırakılan alan sınırsızdır. 0 = hiç izin yok." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[11.5px] uppercase tracking-[0.06em] text-ink-faint">
                  <th className="px-5 py-2.5 font-medium">Sınır</th>
                  <th className="px-3 py-2.5 font-medium">Ücretsiz marka</th>
                  <th className="px-3 py-2.5 font-medium">Spotlight Basic</th>
                  <th className="px-5 py-2.5 font-medium">Spotlight Pro</th>
                </tr>
              </thead>
              <tbody>
                {LIMIT_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3 text-ink">{row.label}</td>
                    {[row.free, row.basic].map((key) => (
                      <td key={key} className="px-3 py-3">
                        <Input
                          type="number"
                          min={0}
                          max={10000}
                          placeholder="Sınırsız"
                          aria-label={`${row.label} — ${key.startsWith('free') ? 'ücretsiz' : 'Basic'}`}
                          value={String(form[key])}
                          onChange={(event) => setField(key, event.target.value)}
                        />
                      </td>
                    ))}
                    <td className="px-5 py-3"><Chip>Sınırsız</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div>
          <Button type="submit" variant="primary" loading={isPending && !confirmOpen} leftIcon={<Save />}>
            Kaydet
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={save}
        loading={isPending}
        tone={form.free_brand_limits_enabled ? 'danger' : 'primary'}
        title={form.free_brand_limits_enabled ? 'Sınırlar açılsın mı?' : 'Sınırlar kapatılsın mı?'}
        description={
          form.free_brand_limits_enabled
            ? 'Spotlight olmayan markalar tüm profilleri göremeyecek, teklif/ilan sınırları başlayacak ve favoriler/listeler kilitlenecek.'
            : 'Bütün markalar yeniden tüm profilleri, favorilerini ve listelerini görecek.'
        }
        confirmLabel={form.free_brand_limits_enabled ? 'Aç ve kaydet' : 'Kapat ve kaydet'}
      />
    </div>
  )
}
