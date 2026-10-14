'use client'

import Image from 'next/image'
import { useMemo, useState, useTransition, type ChangeEvent, type FormEvent } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { saveBrandAdvert, type AdvertStatus } from '@/app/dashboard/brand/advert/actions'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import type { AdvertProject, AdvertQuestion } from '@/lib/adverts-shared'

const HERO_IMAGE_BUCKET = 'advert-hero-images'
const MAX_QUESTIONS = 5

type Question = AdvertQuestion & { options: string[] }

function initialValues(project?: AdvertProject | null) {
  return {
    title: project?.title ?? '',
    summary: project?.summary ?? '',
    category: project?.category ?? '',
    location: project?.location ?? 'Uzaktan',
    platforms: project?.platforms.join(', ') ?? '',
    deliverables: project?.deliverables.join(', ') ?? '',
    paymentType: project?.paymentType ?? 'cash',
    budgetCurrency: project?.budgetCurrency ?? 'TRY',
    budgetMin: project?.budgetMin != null ? String(project.budgetMin) : '',
    budgetMax: project?.budgetMax != null ? String(project.budgetMax) : '',
    deadline: project?.deadline?.slice(0, 10) ?? '',
    status: ((project?.status as AdvertStatus) ?? 'open') as AdvertStatus,
    heroImage: project?.heroImage ?? '',
    questions: (project?.customQuestions ?? []).map((q) => ({ ...q, options: q.options ?? [] })) as Question[],
  }
}

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

interface Props {
  open: boolean
  onClose: () => void
  /** Düzenlenen ilan; yoksa yeni ilan. */
  project?: AdvertProject | null
  onSaved: (message: string) => void
}

/** Yeni ilan / ilan düzenleme penceresi. Kurallar sunucuda (lib/adverts.ts saveAdvertAs). */
export default function AdvertForm({ open, onClose, project, onSaved }: Props) {
  const supabase = useSupabaseClient()
  const start = useMemo(() => initialValues(project), [project])
  const [values, setValues] = useState(start)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isEdit = !!project

  const dirty = open && JSON.stringify(values) !== JSON.stringify(start)
  useUnsavedChanges(dirty)

  const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }))
  const setQuestion = (index: number, patch: Partial<Question>) =>
    setValues((v) => ({ ...v, questions: v.questions.map((q, i) => (i === index ? { ...q, ...patch } : q)) }))

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setError('Kapak görseli JPG, PNG veya WEBP olmalı.')
    if (file.size > 5 * 1024 * 1024) return setError('Kapak görseli en fazla 5 MB olabilir.')
    setUploading(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Oturumun bulunamadı. Yeniden giriş yap.')
      // Dosyalar kullanıcının kendi klasörüne yazılır (kova yükleme politikası bunu ister).
      const path = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage.from(HERO_IMAGE_BUCKET).upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      set('heroImage', supabase.storage.from(HERO_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl)
    } catch (e) {
      console.error('[AdvertForm] hero upload failed', e)
      setError(e instanceof Error && e.message ? e.message : 'Kapak görseli yüklenemedi. Tekrar dene.')
    } finally {
      setUploading(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!values.heroImage) return setError('Kapak görseli yüklemelisin.')
    setError(null)
    const cash = values.paymentType === 'cash'
    startTransition(async () => {
      const result = await saveBrandAdvert({
        id: project?.id,
        title: values.title,
        summary: values.summary,
        category: values.category.trim() || 'Genel',
        platforms: parseList(values.platforms),
        deliverables: parseList(values.deliverables),
        budget_currency: values.budgetCurrency,
        budget_min: cash && values.budgetMin ? Number.parseFloat(values.budgetMin) : null,
        budget_max: cash && values.budgetMax ? Number.parseFloat(values.budgetMax) : null,
        location: values.location.trim() || 'Uzaktan',
        hero_image: values.heroImage || null,
        deadline: values.deadline || null,
        status: isEdit ? values.status : 'open',
        payment_type: values.paymentType,
        custom_questions: values.questions
          .filter((q) => q.question.trim())
          .map((q) => ({ ...q, question: q.question.trim(), options: q.type === 'text' ? [] : q.options.map((o) => o.trim()).filter(Boolean) })),
      })
      if (result?.error) {
        setError(result.error)
        return
      }
      onSaved(isEdit ? 'İlan güncellendi.' : 'İlan yayınlandı.')
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      // Değişiklik varken dışarı tıklama / Esc kapatmaz; "Vazgeç" bilinçli olarak atar.
      dismissible={!dirty && !isPending && !uploading}
      size="lg"
      title={isEdit ? 'İlanı düzenle' : 'Yeni ilan'}
      description="Teslimat, bütçe ve platformu net yaz; başvurular buna göre gelir."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Vazgeç
          </Button>
          <Button variant="primary" type="submit" form="advert-form" loading={isPending} disabled={uploading}>
            {isEdit ? 'Kaydet' : 'Yayınla'}
          </Button>
        </>
      }
    >
      <form id="advert-form" onSubmit={submit} className="grid gap-4">
        <Field label="Başlık">
          {(p) => <Input {...p} required maxLength={120} value={values.title} onChange={(e) => set('title', e.target.value)} placeholder="Ör. Kış içecekleri tanıtımı" />}
        </Field>
        <Field label="Açıklama">
          {(p) => <Textarea {...p} required rows={4} value={values.summary} onChange={(e) => set('summary', e.target.value)} placeholder="Ne istiyorsun, kimden, hangi tonda?" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kategori" hint="Ör. Yeme & İçme">
            {(p) => <Input {...p} maxLength={60} value={values.category} onChange={(e) => set('category', e.target.value)} />}
          </Field>
          <Field label="Konum">
            {(p) => <Input {...p} maxLength={80} value={values.location} onChange={(e) => set('location', e.target.value)} />}
          </Field>
          <Field label="Platformlar" hint="Virgülle ayır">
            {(p) => <Input {...p} value={values.platforms} onChange={(e) => set('platforms', e.target.value)} placeholder="Instagram, TikTok" />}
          </Field>
          <Field label="Teslimatlar" hint="Virgülle ayır">
            {(p) => <Input {...p} value={values.deliverables} onChange={(e) => set('deliverables', e.target.value)} placeholder="1 Reels, 3 Story" />}
          </Field>
          <Field label="Ödeme">
            {(p) => (
              <Select {...p} value={values.paymentType} onChange={(e) => set('paymentType', e.target.value as typeof values.paymentType)}>
                <option value="cash">Nakit</option>
                <option value="barter">Barter (ürün karşılığı)</option>
                <option value="other">Diğer</option>
              </Select>
            )}
          </Field>
          <Field label="Son başvuru" hint="İsteğe bağlı">
            {(p) => <Input {...p} type="date" value={values.deadline} onChange={(e) => set('deadline', e.target.value)} />}
          </Field>
        </div>
        {values.paymentType === 'cash' && (
          <div className="grid grid-cols-[96px_1fr_1fr] gap-3">
            <Field label="Para birimi">
              {(p) => (
                <Select {...p} value={values.budgetCurrency} onChange={(e) => set('budgetCurrency', e.target.value)}>
                  {Array.from(new Set(['TRY', 'USD', 'EUR', values.budgetCurrency])).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="En az">
              {(p) => <Input {...p} type="number" min={0} value={values.budgetMin} onChange={(e) => set('budgetMin', e.target.value)} />}
            </Field>
            <Field label="En çok">
              {(p) => <Input {...p} type="number" min={0} value={values.budgetMax} onChange={(e) => set('budgetMax', e.target.value)} />}
            </Field>
          </div>
        )}
        {isEdit && (
          <Field label="Durum">
            {(p) => (
              <Select {...p} value={values.status} onChange={(e) => set('status', e.target.value as AdvertStatus)}>
                <option value="open">Yayında</option>
                <option value="paused">Duraklatıldı</option>
                <option value="closed">Kapandı</option>
              </Select>
            )}
          </Field>
        )}

        <div className="grid gap-1.5">
          <span className="text-[12.5px] font-medium text-ink-muted">Kapak görseli</span>
          {values.heroImage ? (
            <div className="relative h-44 overflow-hidden rounded-xl border border-line">
              <Image src={values.heroImage} alt="Kapak görseli" fill sizes="640px" className="object-cover" />
              <Button size="sm" variant="secondary" className="absolute right-2 top-2" onClick={() => set('heroImage', '')}>
                Değiştir
              </Button>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-7 text-center text-ink-muted transition-colors hover:border-gold/40">
              <ImagePlus className="h-5 w-5" aria-hidden />
              <span className="text-[13px]">{uploading ? 'Yükleniyor…' : 'Görsel seç'}</span>
              <span className="text-xs text-ink-faint">JPG, PNG veya WEBP · en fazla 5 MB</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} disabled={uploading} />
            </label>
          )}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12.5px] font-medium text-ink-muted">
              Başvuranlara sorular <span className="text-ink-faint">(isteğe bağlı, en fazla {MAX_QUESTIONS})</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Plus />}
              disabled={values.questions.length >= MAX_QUESTIONS}
              onClick={() => set('questions', [...values.questions, { id: crypto.randomUUID(), type: 'text', question: '', options: [] }])}
            >
              Soru ekle
            </Button>
          </div>
          {values.questions.map((q, i) => (
            <div key={q.id} className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex gap-2">
                <Input aria-label={`${i + 1}. soru`} value={q.question} onChange={(e) => setQuestion(i, { question: e.target.value })} placeholder={`${i + 1}. soru`} />
                <Select aria-label="Soru türü" className="w-auto" value={q.type} onChange={(e) => setQuestion(i, { type: e.target.value as Question['type'] })}>
                  <option value="text">Metin</option>
                  <option value="single_select">Tek seçim</option>
                  <option value="multiple_choice">Çoklu seçim</option>
                </Select>
                <Button
                  size="md"
                  variant="ghost"
                  iconOnly
                  aria-label="Soruyu sil"
                  onClick={() => set('questions', values.questions.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
              {q.type !== 'text' && (
                <Textarea
                  aria-label="Seçenekler"
                  rows={3}
                  value={q.options.join('\n')}
                  onChange={(e) => setQuestion(i, { options: e.target.value.split('\n') })}
                  placeholder={'Her satıra bir seçenek'}
                />
              )}
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
