'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Check, Layers, Plus } from 'lucide-react'
import { createList, getInfluencerLists, toggleInList } from '@/app/actions/favoriteLists'
import { Button, EmptyState, Input, Modal } from '@/components/ui'
import { cn } from '@/utils/cn'

interface Props {
  open: boolean
  onClose: () => void
  influencerId: string
  influencerName: string
}

/** Profili markanın listelerine ekler/çıkarır; yeni liste aynı pencereden açılır. Liste silme Favoriler sekmesinde. */
export default function AddToListModal({ open, onClose, influencerId, influencerName }: Props) {
  const [lists, setLists] = useState<{ id: string; name: string; hasInfluencer: boolean }[] | null>(null)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const load = () => getInfluencerLists(influencerId).then(setLists).catch(() => setLists([]))

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, influencerId])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    const result = await createList(trimmed)
    setCreating(false)
    if (result.error) {
      toast.error('Liste oluşturulamadı.')
      return
    }
    setName('')
    // Yeni liste açılır açılmaz profil içine eklenir (çoğu zaman amaç budur).
    if (result.data?.id) await toggleInList(result.data.id, influencerId)
    toast.success(`"${trimmed}" listesi oluşturuldu.`)
    load()
  }

  const toggle = async (listId: string) => {
    setLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, hasInfluencer: !l.hasInfluencer } : l)) ?? null)
    const result = await toggleInList(listId, influencerId)
    if (result.error) {
      toast.error('Liste güncellenemedi.')
      setLists((prev) => prev?.map((l) => (l.id === listId ? { ...l, hasInfluencer: !l.hasInfluencer } : l)) ?? null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Listeye ekle" description={influencerName}>
      <form onSubmit={create} className="mb-3 flex gap-2">
        <Input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="Yeni liste adı" aria-label="Yeni liste adı" />
        <Button type="submit" iconOnly aria-label="Liste oluştur" loading={creating} disabled={!name.trim()}>
          <Plus />
        </Button>
      </form>
      {lists === null ? (
        <p className="py-4 text-center text-[13px] text-ink-faint">Yükleniyor…</p>
      ) : lists.length === 0 ? (
        <EmptyState icon={Layers} title="Henüz listen yok" description="Yukarıya bir ad yazıp ilk listeni oluştur." className="py-5" />
      ) : (
        <div className="grid gap-1.5">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              aria-pressed={list.hasInfluencer}
              onClick={() => toggle(list.id)}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-[13.5px] transition-colors',
                list.hasInfluencer ? 'border-gold/30 bg-gold/10 text-ink' : 'border-line bg-surface-2 text-ink-muted hover:text-ink',
              )}
            >
              <span className="truncate">{list.name}</span>
              {list.hasInfluencer ? (
                <span className="flex items-center gap-1 text-xs text-gold">
                  <Check className="h-3.5 w-3.5" />
                  Listede
                </span>
              ) : (
                <span className="text-xs text-ink-faint">Ekle</span>
              )}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
