'use client'

import Image from 'next/image'
import { useMemo, useState, useTransition } from 'react'
import { Loader2, PauseCircle, Pencil, PlayCircle, Plus, Trash2, Upload } from 'lucide-react'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { type AdvertProject } from '@/components/dashboard/AdvertProjectsList'
import { saveBrandAdvert, updateAdvertStatus, deleteAdvert, type AdvertStatus } from '@/app/dashboard/brand/advert/actions'
import { useRouter } from 'next/navigation'

interface BrandAdvertManagerProps {
  projects: AdvertProject[]
  verificationStatus?: 'pending' | 'verified' | 'rejected'
}

const STATUS_BADGE_STYLES: Record<string, string> = {
  open: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
  paused: 'border-yellow-400/40 bg-yellow-400/10 text-yellow-200',
  closed: 'border-red-400/40 bg-red-400/10 text-red-200',
}

const emptyFormValues = {
  id: '',
  title: '',
  summary: '',
  category: 'Genel',
  platforms: '',
  deliverables: '',
  budgetCurrency: 'TRY',
  budgetMin: '',
  budgetMax: '',
  location: 'Uzaktan',
  heroImage: '',
  deadline: '',
  status: 'open' as AdvertStatus,
  paymentType: 'cash',
  customQuestions: [] as { id: string; type: 'text' | 'single_select' | 'multiple_choice'; question: string; options: string[] }[],
}

const parseList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

const HERO_IMAGE_BUCKET = 'advert-hero-images'

export default function BrandAdvertManager({ projects, verificationStatus = 'pending' }: BrandAdvertManagerProps) {
  const router = useRouter()
  const supabase = useSupabaseClient()
  const [formValues, setFormValues] = useState(emptyFormValues)
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null)
  const [isUploadingHero, setIsUploadingHero] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [projects],
  )

  const resetForm = () => {
    setFormValues(emptyFormValues)
    setHeroImageUrl(null)
    setError(null)
  }

  const handleEdit = (project: AdvertProject) => {
    setFormValues({
      id: project.id,
      title: project.title,
      summary: project.summary,
      category: project.category,
      platforms: project.platforms.join(', '),
      deliverables: project.deliverables.join(', '),
      budgetCurrency: project.budgetCurrency ?? 'TRY',
      budgetMin: project.budgetMin ? String(project.budgetMin) : '',
      budgetMax: project.budgetMax ? String(project.budgetMax) : '',
      location: project.location,
      heroImage: '',
      deadline: project.deadline ?? '',
      status: (project.status as AdvertStatus) ?? 'open',
      paymentType: project.paymentType ?? 'cash',
      customQuestions: project.customQuestions?.map(q => ({ ...q, options: q.options || [] })) || [],
    })
    setHeroImageUrl(project.heroImage)
  }

  const handleHeroImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    const maxSize = 5 * 1024 * 1024 // 5MB

    if (!allowedTypes.includes(file.type)) {
      setError('Lütfen JPG, PNG veya WEBP formatında bir görsel yükleyin.')
      return
    }

    if (file.size > maxSize) {
      setError('Dosya boyutu en fazla 5MB olabilir.')
      return
    }

    setIsUploadingHero(true)
    setError(null)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${crypto.randomUUID()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage.from(HERO_IMAGE_BUCKET).upload(filePath, file, {
        upsert: true,
      })

      if (uploadError) {
        console.error('Storage upload error', uploadError)
        if (uploadError.message.includes('Bucket not found') || uploadError.message.includes('not found')) {
          throw new Error(`Storage bucket "${HERO_IMAGE_BUCKET}" bulunamadı. Lütfen Supabase Dashboard'da bu bucket'ı oluşturun.`)
        }
        throw uploadError
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(HERO_IMAGE_BUCKET).getPublicUrl(filePath)

      setHeroImageUrl(publicUrl)
      setFormValues((prev) => ({ ...prev, heroImage: publicUrl }))
    } catch (error: any) {
      console.error('Hero image upload failed', error)
      const errorMessage = error?.message || 'Kapak görseli yüklenemedi. Lütfen tekrar deneyin.'
      setError(errorMessage)
    } finally {
      setIsUploadingHero(false)
    }
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const payload = {
        id: formValues.id || undefined,
        title: formValues.title,
        summary: formValues.summary,
        category: formValues.category,
        platforms: parseList(formValues.platforms),
        deliverables: parseList(formValues.deliverables),
        budget_currency: formValues.budgetCurrency,
        budget_min: formValues.budgetMin ? Number.parseFloat(formValues.budgetMin) : null,
        budget_max: formValues.budgetMax ? Number.parseFloat(formValues.budgetMax) : null,
        location: formValues.location,
        hero_image: formValues.heroImage || null,
        deadline: formValues.deadline || null,
        status: formValues.status,
        payment_type: formValues.paymentType,
        custom_questions: formValues.customQuestions,
      }

      const result = await saveBrandAdvert(payload)
      if (result?.error) {
        setError(result.error)
        return
      }

      setToast(payload.id ? 'İlan güncellendi.' : 'Yeni ilan oluşturuldu.')
      resetForm()
      router.refresh()
    })
  }

  const handleStatusChange = (projectId: string, nextStatus: AdvertStatus) => {
    startTransition(async () => {
      const result = await updateAdvertStatus(projectId, nextStatus)
      if (result?.error) {
        setError(result.error)
        return
      }
      router.refresh()
      setToast('İlan durumu güncellendi.')
    })
  }

  const handleDelete = (projectId: string, projectTitle: string) => {
    if (!confirm(`"${projectTitle}" ilanını kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
      return
    }

    startTransition(async () => {
      const result = await deleteAdvert(projectId)
      if (result?.error) {
        setError(result.error)
        return
      }
      setToast('İlan başarıyla silindi.')
      router.refresh()
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">İlan Formu</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{formValues.id ? 'İlanı Güncelle' : 'Yeni İlan Oluştur'}</h2>
          </div>
          {formValues.id ? (
            <button
              type="button"
              onClick={resetForm}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm text-gray-300 transition hover:border-white/30 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Sıfırla
            </button>
          ) : null}
        </div>

        {verificationStatus !== 'verified' && (
          <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-200">
              <strong>Hesabınız henüz onaylanmadı.</strong> İlan oluşturabilmek için hesabınızın onaylanması gerekmektedir.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="text-sm text-gray-300">Başlık</label>
            <input
              type="text"
              name="title"
              value={formValues.title}
              onChange={handleChange}
              required
              disabled={verificationStatus !== 'verified'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300">Özet</label>
            <textarea
              name="summary"
              value={formValues.summary}
              onChange={handleChange}
              rows={4}
              required
              disabled={verificationStatus !== 'verified'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-gray-300">Kategori</label>
              <input
                type="text"
                name="category"
                value={formValues.category}
                onChange={handleChange}
                disabled={verificationStatus !== 'verified'}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Lokasyon</label>
              <input
                type="text"
                name="location"
                value={formValues.location}
                onChange={handleChange}
                disabled={verificationStatus !== 'verified'}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-300">Platformlar (virgül ile)</label>
            <input
              type="text"
              name="platforms"
              value={formValues.platforms}
              onChange={handleChange}
              placeholder="Instagram, TikTok"
              disabled={verificationStatus !== 'verified'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300">Teslimatlar (virgül ile)</label>
            <input
              type="text"
              name="deliverables"
              value={formValues.deliverables}
              onChange={handleChange}
              placeholder="1 Reels, 3 Story"
              disabled={verificationStatus !== 'verified'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          <div>
            <label className="text-sm text-gray-300">Ödeme Tipi</label>
            <select
              name="paymentType"
              value={formValues.paymentType}
              onChange={handleChange}
              disabled={verificationStatus !== 'verified'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="cash">Nakit</option>
              <option value="barter">Barter (Ürün Karşılığı)</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm text-gray-300">Bütçe Para Birimi</label>
              <input
                type="text"
                name="budgetCurrency"
                value={formValues.budgetCurrency}
                onChange={handleChange}
                disabled={verificationStatus !== 'verified' || formValues.paymentType === 'barter' || formValues.paymentType === 'other'}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Min</label>
              <input
                type="number"
                name="budgetMin"
                value={formValues.budgetMin}
                onChange={handleChange}
                disabled={verificationStatus !== 'verified' || formValues.paymentType === 'barter' || formValues.paymentType === 'other'}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300">Maks</label>
              <input
                type="number"
                name="budgetMax"
                value={formValues.budgetMax}
                onChange={handleChange}
                disabled={verificationStatus !== 'verified' || formValues.paymentType === 'barter' || formValues.paymentType === 'other'}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>


          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Özel Sorular (Max 5)</label>
              <button
                type="button"
                onClick={() => {
                  if (formValues.customQuestions.length < 5) {
                    setFormValues(prev => ({
                      ...prev,
                      customQuestions: [
                        ...prev.customQuestions,
                        { id: crypto.randomUUID(), type: 'text', question: '', options: [] }
                      ]
                    }))
                  }
                }}
                disabled={formValues.customQuestions.length >= 5 || verificationStatus !== 'verified'}
                className="text-xs text-soft-gold hover:underline disabled:opacity-50 disabled:no-underline"
              >
                + Soru Ekle
              </button>
            </div>

            <div className="space-y-4">
              {formValues.customQuestions.map((q, index) => (
                <div key={q.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-2 text-xs text-gray-500">#{index + 1}</span>
                    <div className="flex-1 space-y-3">
                      <input
                        type="text"
                        value={q.question}
                        onChange={(e) => {
                          const newQuestions = [...formValues.customQuestions]
                          newQuestions[index].question = e.target.value
                          setFormValues(prev => ({ ...prev, customQuestions: newQuestions }))
                        }}
                        placeholder="Sorunuzu yazın..."
                        className="w-full rounded-xl border border-white/10 bg-[#0F1018] px-3 py-2 text-sm text-white outline-none focus:border-soft-gold"
                      />
                      <div className="flex items-center gap-3">
                        <select
                          value={q.type}
                          onChange={(e) => {
                            const newQuestions = [...formValues.customQuestions]
                            newQuestions[index].type = e.target.value as any
                            setFormValues(prev => ({ ...prev, customQuestions: newQuestions }))
                          }}
                          className="rounded-xl border border-white/10 bg-[#0F1018] px-3 py-2 text-sm text-gray-300 outline-none focus:border-soft-gold"
                        >
                          <option value="text">Metin Yanıt</option>
                          <option value="single_select">Tek Seçmeli</option>
                          <option value="multiple_choice">Çoktan Seçmeli</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            const newQuestions = formValues.customQuestions.filter((_, i) => i !== index)
                            setFormValues(prev => ({ ...prev, customQuestions: newQuestions }))
                          }}
                          className="ml-auto text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {(q.type === 'single_select' || q.type === 'multiple_choice') && (
                        <div className="pl-4 border-l-2 border-white/10 space-y-2">
                          <label className="text-xs text-gray-400">Seçenekler (Her satıra bir seçenek)</label>
                          <textarea
                            value={q.options?.join('\n')}
                            onChange={(e) => {
                              const newQuestions = [...formValues.customQuestions]
                              newQuestions[index].options = e.target.value.split('\n')
                              setFormValues(prev => ({ ...prev, customQuestions: newQuestions }))
                            }}
                            rows={3}
                            placeholder="Seçenek 1&#10;Seçenek 2&#10;Seçenek 3"
                            className="w-full rounded-xl border border-white/10 bg-[#0F1018] px-3 py-2 text-sm text-white outline-none focus:border-soft-gold"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-300">Kapak Görseli</label>
            {heroImageUrl ? (
              <div className="mt-2 relative h-48 w-full overflow-hidden rounded-2xl border border-white/10">
                <Image src={heroImageUrl} alt="Kapak görseli" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setHeroImageUrl(null)
                    setFormValues((prev) => ({ ...prev, heroImage: '' }))
                  }}
                  disabled={verificationStatus !== 'verified'}
                  className="absolute right-2 top-2 rounded-full bg-red-500/80 px-3 py-1 text-xs text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Kaldır
                </button>
              </div>
            ) : (
              <label className="mt-2 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/20 bg-[#0F1018] px-4 py-8 text-center transition hover:border-soft-gold hover:bg-[#0F1018]/80">
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="text-sm text-gray-300">Kapak görseli yükle (JPG, PNG, WEBP - Max 5MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleHeroImageUpload}
                  disabled={isUploadingHero || verificationStatus !== 'verified'}
                />
                {isUploadingHero && (
                  <div className="flex items-center gap-2 text-xs text-soft-gold">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yükleniyor...
                  </div>
                )}
              </label>
            )}
          </div>
          <div>
            <label className="text-sm text-gray-300">Deadline</label>
            <input
              type="date"
              name="deadline"
              value={formValues.deadline}
              onChange={handleChange}
              disabled={verificationStatus !== 'verified'}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
          {formValues.id ? (
            <div>
              <label className="text-sm text-gray-300">Durum</label>
              <select
                name="status"
                value={formValues.status}
                onChange={handleChange}
                disabled={verificationStatus !== 'verified'}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-[#0F1018] px-4 py-3 text-white outline-none transition focus:border-soft-gold disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="open">Açık</option>
                <option value="paused">Duraklatıldı</option>
                <option value="closed">Kapatıldı</option>
              </select>
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-300">{error}</p> : null}

          <button
            type="submit"
            disabled={isPending || verificationStatus !== 'verified'}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-soft-gold/60 bg-soft-gold/20 px-4 py-3 text-sm font-semibold text-soft-gold transition hover:border-soft-gold hover:bg-soft-gold/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {formValues.id ? 'İlanı Güncelle' : 'Yeni İlan Oluştur'}
              </>
            )}
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-glow">
        <p className="text-xs uppercase tracking-[0.4em] text-soft-gold">İlanların</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Aktif Briefler</h2>

        {sortedProjects.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0F1018] p-6 text-center text-gray-400">
            Henüz bir ilan oluşturmadınız.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {sortedProjects.map((project) => (
              <article key={project.id} className="rounded-2xl border border-white/10 bg-[#0F1018] p-4 text-sm text-gray-300">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-soft-gold">{project.category}</p>
                    <h3 className="text-lg font-semibold text-white">{project.title}</h3>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${STATUS_BADGE_STYLES[project.status] ?? 'border-white/20 text-white'}`}
                  >
                    {project.status}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-gray-400">{project.summary}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(project)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-1 text-xs text-white transition hover:border-white/30"
                  >
                    <Pencil className="h-4 w-4" />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(project.id, project.status === 'open' ? 'paused' : 'open')}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-1 text-xs text-white transition hover:border-white/30"
                  >
                    {project.status === 'open' ? (
                      <>
                        <PauseCircle className="h-4 w-4" />
                        Duraklat
                      </>
                    ) : (
                      <>
                        <PlayCircle className="h-4 w-4" />
                        Aktif Et
                      </>
                    )}
                  </button>
                  {project.status !== 'closed' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(project.id, 'closed')}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-3 py-1 text-xs text-white transition hover:border-white/30"
                    >
                      <Trash2 className="h-4 w-4" />
                      Kapat
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleDelete(project.id, project.title)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-red-500/60 bg-red-500/10 px-3 py-1 text-xs text-red-300 transition hover:border-red-500 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Sil
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {toast ? (
        <div className="fixed right-6 bottom-6 z-50 rounded-2xl border border-soft-gold/60 bg-soft-gold/15 px-4 py-2 text-sm text-soft-gold shadow-glow">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
