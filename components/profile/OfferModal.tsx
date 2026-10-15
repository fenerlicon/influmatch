'use client'

import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Send, Trash2 } from 'lucide-react'
import { Button, Field, Input, Modal, Notice, Select, Textarea } from '@/components/ui'
import { createOffer, deleteOfferTemplate, getLastOfferDraft, listOfferTemplates, saveOfferTemplate } from '@/app/profile/actions'
import { OFFER_CAMPAIGN_TYPES, OFFER_TEMPLATE_LIMIT } from '@/lib/offer-shared'
import type { OfferDraft, OfferTemplate } from '@/lib/offer-templates'

interface OfferModalProps {
  receiverId: string
  receiverName: string
  isViewerVerified: boolean
  /** Sınır uygulanan markada kalan teklif hakkı (ör. "Bu ay 12 teklif hakkın kaldı"); yoksa gösterilmez. */
  quotaText?: string | null
  /** Keşif kartındaki "Teklif" düğmesinden gelindiyse (?teklif=1) pencere açık başlar. */
  defaultOpen?: boolean
  /** Influencer "Şu an dolu" ise uyarı (teklif yine gönderilebilir, 3.19). */
  busyWarning?: string | null
  /** Markanın taslak / aktif kampanyaları: teklif kampanyaya bağlanabilir (3.19). */
  campaigns?: Array<{ id: string; name: string }>
  defaultCampaignId?: string | null
  /** Tetikleyici düğme tam genişlik. */
  block?: boolean
}

const CAMPAIGN_TYPES = OFFER_CAMPAIGN_TYPES

const initialFormState = {
  campaignName: '',
  campaignType: CAMPAIGN_TYPES[0] as string,
  budget: '',
  message: '',
  paymentType: 'cash' as 'cash' | 'barter',
}

/** Şablon / son teklif alanlarını forma çevirir. */
function draftToForm(draft: OfferDraft): typeof initialFormState {
  const type: string = CAMPAIGN_TYPES.find((t) => t === draft.campaign_type) ?? CAMPAIGN_TYPES[0]
  return {
    campaignName: draft.campaign_name ?? '',
    campaignType: type,
    budget: draft.budget === null || draft.budget === undefined ? '' : String(draft.budget),
    message: draft.message ?? '',
    paymentType: draft.payment_type === 'barter' ? 'barter' : 'cash',
  }
}

export default function OfferModal({
  receiverId,
  receiverName,
  isViewerVerified,
  quotaText,
  defaultOpen = false,
  busyWarning = null,
  campaigns = [],
  defaultCampaignId = null,
  block = false,
}: OfferModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(defaultOpen && isViewerVerified)
  const [formState, setFormState] = useState(initialFormState)
  const [isPending, startTransition] = useTransition()
  const [templates, setTemplates] = useState<OfferTemplate[] | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [isSavingTemplate, setIsSavingTemplate] = useState(false)
  const [templateBusy, startTemplateTransition] = useTransition()
  const [campaignId, setCampaignId] = useState(() => (defaultCampaignId && campaigns.some((c) => c.id === defaultCampaignId) ? defaultCampaignId : ''))

  // Pencere ilk açıldığında markanın şablonları yüklenir.
  useEffect(() => {
    if (!isOpen || templates !== null) return
    listOfferTemplates().then((result) => {
      setTemplates('templates' in result && result.templates ? result.templates : [])
    })
  }, [isOpen, templates])

  const handlePickTemplate = (id: string) => {
    setSelectedTemplateId(id)
    const template = templates?.find((t) => t.id === id)
    if (template) setFormState(draftToForm(template))
  }

  const handleCopyLastOffer = () => {
    startTemplateTransition(async () => {
      const result = await getLastOfferDraft()
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if (!('draft' in result) || !result.draft) {
        toast.error('Daha önce gönderilmiş bir teklifiniz yok.')
        return
      }
      setSelectedTemplateId('')
      setFormState(draftToForm(result.draft))
    })
  }

  const handleSaveTemplate = () => {
    startTemplateTransition(async () => {
      const result = await saveOfferTemplate({
        name: templateName,
        campaignName: formState.campaignName,
        campaignType: formState.campaignType,
        budget: formState.budget,
        message: formState.message,
        paymentType: formState.paymentType,
      })
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      if ('template' in result && result.template) {
        const saved = result.template
        setTemplates((prev) => [saved, ...(prev ?? []).filter((t) => t.id !== saved.id)])
        setSelectedTemplateId(saved.id)
      }
      setTemplateName('')
      setIsSavingTemplate(false)
      toast.success('Şablon kaydedildi.')
    })
  }

  const handleDeleteTemplate = () => {
    if (!selectedTemplateId) return
    const id = selectedTemplateId
    startTemplateTransition(async () => {
      const result = await deleteOfferTemplate(id)
      if ('error' in result && result.error) {
        toast.error(result.error)
        return
      }
      setTemplates((prev) => (prev ?? []).filter((t) => t.id !== id))
      setSelectedTemplateId('')
      toast.success('Şablon silindi.')
    })
  }

  const isDisabled = useMemo(() => {
    return !formState.campaignName || !formState.budget || isPending
  }, [formState.budget, formState.campaignName, isPending])

  const handleOpen = () => {
    if (!isViewerVerified) {
      toast.error('Teklif göndermek için hesabının onaylanması gerekiyor.')
      return
    }
    setIsOpen(true)
  }
  const handleClose = () => {
    if (isPending) return
    setIsOpen(false)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormState((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      try {
        const result = await createOffer({
          receiverId,
          campaignName: formState.campaignName,
          campaignType: formState.campaignType,
          budget: formState.budget,
          message: formState.message,
          paymentType: formState.paymentType,
          campaignId: campaignId || null,
        })

        if ('error' in result) {
          toast.error(result.error)
          return
        }

        setFormState(initialFormState)
        setIsOpen(false)
        toast.success('Teklifin gönderildi.')
        // Kalan teklif hakkı bilgisi (sınır uygulanan markada) güncellensin.
        if (quotaText) router.refresh()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Teklif gönderilemedi.'
        toast.error(message)
      }
    })
  }

  return (
    <>
      <Button variant="primary" onClick={handleOpen} leftIcon={<Send />} block={block}>
        Teklif gönder
      </Button>

      <Modal
        open={isOpen}
        onClose={handleClose}
        dismissible={!isPending}
        size="lg"
        title={`${receiverName} için teklif`}
        description="Teklif kabul edilirse sohbet açılır ve iş, İşler sayfasında takip edilir."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={isPending}>Vazgeç</Button>
            <Button variant="primary" size="sm" type="submit" form="offer-form" loading={isPending} disabled={isDisabled}>
              Teklifi gönder
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          {/* Şablon ve son teklif */}
          <div className="grid gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedTemplateId}
                onChange={(event) => handlePickTemplate(event.target.value)}
                disabled={templateBusy || templates === null}
                aria-label="Şablon seç"
                className="min-w-0 flex-1"
              >
                <option value="">{templates === null ? 'Şablonlar yükleniyor…' : templates.length ? 'Şablondan doldur' : 'Kayıtlı şablon yok'}</option>
                {(templates ?? []).map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </Select>
              {selectedTemplateId ? (
                <Button size="sm" variant="danger" onClick={handleDeleteTemplate} disabled={templateBusy} leftIcon={<Trash2 />}>
                  Şablonu sil
                </Button>
              ) : null}
              <Button size="sm" onClick={handleCopyLastOffer} disabled={templateBusy} leftIcon={<Copy />}>
                Son teklifimi kopyala
              </Button>
            </div>
            {isSavingTemplate ? (
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  aria-label="Şablon adı"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  maxLength={60}
                  placeholder="Şablon adı (ör. Yaz serisi - Reels)"
                  className="min-w-0 flex-1"
                />
                <Button size="sm" onClick={handleSaveTemplate} loading={templateBusy} disabled={!templateName.trim() || !formState.campaignName.trim()}>
                  Kaydet
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsSavingTemplate(false)}>Vazgeç</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSavingTemplate(true)}
                disabled={(templates?.length ?? 0) >= OFFER_TEMPLATE_LIMIT}
                className="justify-self-start text-[12.5px] text-gold hover:underline disabled:cursor-not-allowed disabled:text-ink-faint disabled:no-underline"
              >
                {(templates?.length ?? 0) >= OFFER_TEMPLATE_LIMIT ? `En fazla ${OFFER_TEMPLATE_LIMIT} şablon kaydedebilirsin` : 'Bu formu şablon olarak kaydet'}
              </button>
            )}
          </div>

          <form id="offer-form" onSubmit={handleSubmit} className="grid gap-4">
            {quotaText && <Notice tone="gold">{quotaText}</Notice>}
            {busyWarning && <Notice tone="warning">{busyWarning}</Notice>}
            {campaigns.length > 0 && (
              <Field label="Kampanya (isteğe bağlı)" hint="Seçersen kampanya açıklaması teklifte influencer'a görünür.">
                {(props) => (
                  <Select
                    {...props}
                    value={campaignId}
                    onChange={(event) => {
                      const id = event.target.value
                      setCampaignId(id)
                      const picked = campaigns.find((c) => c.id === id)
                      if (picked && !formState.campaignName.trim()) setFormState((prev) => ({ ...prev, campaignName: picked.name }))
                    }}
                  >
                    <option value="">Kampanyaya bağlama</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Teklif başlığı">
              {(props) => <Input {...props} required name="campaignName" value={formState.campaignName} onChange={handleChange} placeholder="Ör. Yaz koleksiyonu lansmanı" />}
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="İçerik türü">
                {(props) => (
                  <Select {...props} name="campaignType" value={formState.campaignType} onChange={handleChange}>
                    {CAMPAIGN_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Ödeme türü">
                {(props) => (
                  <Select {...props} name="paymentType" value={formState.paymentType} onChange={handleChange}>
                    <option value="cash">Nakit</option>
                    <option value="barter">Barter (ürün)</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field label={formState.paymentType === 'barter' ? 'Ürünün piyasa değeri (₺)' : 'Bütçe (₺)'}>
              {(props) => (
                <Input
                  {...props}
                  required
                  name="budget"
                  type="number"
                  min={0}
                  step="100"
                  value={formState.budget}
                  onChange={handleChange}
                  placeholder={formState.paymentType === 'barter' ? 'Ör. 5000' : 'Ör. 25000'}
                />
              )}
            </Field>
            <Field label="Mesaj">
              {(props) => <Textarea {...props} name="message" rows={4} value={formState.message} onChange={handleChange} placeholder="İçerik beklentini ve tarihleri paylaşabilirsin." />}
            </Field>
          </form>
        </div>
      </Modal>
    </>
  )
}
