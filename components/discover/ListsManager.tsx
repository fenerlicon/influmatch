'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { createList, deleteList } from '@/app/actions/favoriteLists'
import { Button, Card, CardHeader, ConfirmDialog, Input } from '@/components/ui'

interface ListItem {
  id: string
  name: string
}

// Listeler doğrulanmış markalara açık; ücretsiz marka sınırları açılınca yalnızca Spotlight markalara (lib/favorites.ts, SYSTEM_MAP 3.17).
export default function ListsManager({ initialLists }: { initialLists: ListItem[] }) {
  const router = useRouter()
  const [lists, setLists] = useState(initialLists)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<ListItem | null>(null)
  const [isPending, startTransition] = useTransition()

  const create = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await createList(trimmed)
      if (result.error || !result.data) {
        toast.error('Liste oluşturulamadı.')
        return
      }
      setLists((prev) => [result.data as ListItem, ...prev])
      setName('')
      toast.success(`"${trimmed}" listesi oluşturuldu.`)
    })
  }

  const remove = () => {
    if (!deleting) return
    const target = deleting
    startTransition(async () => {
      const result = await deleteList(target.id)
      if (result.error) {
        toast.error('Liste silinemedi.')
        return
      }
      setLists((prev) => prev.filter((l) => l.id !== target.id))
      setDeleting(null)
      toast.success('Liste silindi.')
      router.refresh()
    })
  }

  return (
    <Card as="section" className="mb-5 overflow-hidden">
      <CardHeader
        title="Listelerin"
        description="Favorilerini kampanyaya ya da konuya göre ayır."
        action={
          <form onSubmit={create} className="flex gap-2">
            <Input value={name} maxLength={50} onChange={(e) => setName(e.target.value)} placeholder="Yeni liste adı" aria-label="Yeni liste adı" className="h-[30px] w-48 text-[12.5px]" />
            <Button type="submit" size="sm" leftIcon={<Plus />} disabled={!name.trim() || isPending}>
              Oluştur
            </Button>
          </form>
        }
      />
      {lists.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-ink-faint">Henüz liste yok. Profil kartındaki liste düğmesiyle ya da yukarıdan oluşturabilirsin.</p>
      ) : (
        <div className="grid gap-2 p-4 [grid-template-columns:repeat(auto-fill,minmax(180px,1fr))]">
          {lists.map((list) => (
            <div key={list.id} className="group flex items-center gap-2 rounded-xl border border-line bg-surface-2 pr-1 transition-colors hover:border-line-strong">
              <Link href={`/dashboard/brand/inflist/${list.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3">
                <Layers className="h-4 w-4 flex-none text-ink-faint" aria-hidden />
                <span className="truncate text-[13.5px] text-ink">{list.name}</span>
              </Link>
              <Button size="sm" variant="ghost" iconOnly aria-label={`"${list.name}" listesini sil`} onClick={() => setDeleting(list)} className="hover:text-danger">
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={isPending && !!deleting}
        tone="danger"
        title="Liste silinsin mi?"
        description={deleting ? `"${deleting.name}" listesi silinir. Favorilerin etkilenmez.` : undefined}
        confirmLabel="Sil"
      />
    </Card>
  )
}
