'use client'

import { useState, useTransition } from 'react'
import { Layers, Plus, X, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createList, deleteList } from '@/app/actions/favoriteLists'
import { toast } from 'sonner'

interface InflistItem {
    id: string
    name: string
}

interface InflistManagerProps {
    initialLists: InflistItem[]
    isSpotlight: boolean
}

export default function InflistManager({ initialLists, isSpotlight }: InflistManagerProps) {
    const router = useRouter()
    const [lists, setLists] = useState<InflistItem[]>(initialLists)
    const [showForm, setShowForm] = useState(false)
    const [newListName, setNewListName] = useState('')
    const [isPending, startTransition] = useTransition()
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleCreate = () => {
        const trimmed = newListName.trim()
        if (!trimmed) return

        startTransition(async () => {
            const result = await createList(trimmed)
            if (result.error) {
                toast.error('Liste oluşturulamadı: ' + result.error)
            } else if (result.data) {
                setLists(prev => [result.data as InflistItem, ...prev])
                setNewListName('')
                setShowForm(false)
                toast.success(`"${trimmed}" listesi oluşturuldu.`)
                router.refresh()
            }
        })
    }

    const handleDelete = async (e: React.MouseEvent, list: InflistItem) => {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm(`"${list.name}" listesini silmek istediğinize emin misiniz?`)) return

        setDeletingId(list.id)
        const result = await deleteList(list.id)
        setDeletingId(null)

        if (result.error) {
            toast.error('Liste silinemedi.')
        } else {
            setLists(prev => prev.filter(l => l.id !== list.id))
            toast.success('Liste silindi.')
            router.refresh()
        }
    }

    return (
        <section className="rounded-3xl border border-white/10 bg-[#12131A] p-6 shadow-glow relative overflow-hidden">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-cyan-400">Influencer Listelerin</p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Inflist</h2>
                </div>
                <div className="flex items-center gap-2">
                    {lists.length > 0 && (
                        <Link
                            href="/dashboard/brand/favorites"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-400 transition hover:border-white/30 hover:text-white"
                        >
                            Tümünü Yönet
                        </Link>
                    )}
                    <button
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition hover:border-cyan-500/70 hover:bg-cyan-500/20"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Yeni Liste
                    </button>
                </div>
            </div>

            {/* Inline create form */}
            {showForm && (
                <div className="mb-4 flex items-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-3">
                    <Layers className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                    <input
                        type="text"
                        value={newListName}
                        onChange={e => setNewListName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowForm(false) }}
                        placeholder="Liste adı (örn: Fitness İçerik Üreticileri)"
                        autoFocus
                        maxLength={60}
                        className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none"
                    />
                    <button
                        onClick={handleCreate}
                        disabled={isPending || !newListName.trim()}
                        className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Oluştur'}
                    </button>
                    <button onClick={() => { setShowForm(false); setNewListName('') }} className="text-gray-500 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* List grid */}
            {lists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-600">
                        <Layers className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-gray-400">Henüz liste oluşturmadınız.</p>
                    <p className="mt-1 text-xs text-gray-600">Keşfet'teki influencerları listelere kaydedin.</p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-4 flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500/20"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        İlk Listeni Oluştur
                    </button>
                </div>
            ) : (
                <div className={`grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 ${!isSpotlight ? 'opacity-40 pointer-events-none select-none blur-sm' : ''}`}>
                    {lists.map(list => (
                        <Link
                            key={list.id}
                            href={`/dashboard/brand/inflist/${list.id}`}
                            className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10"
                        >
                            <div className="flex justify-between items-start">
                                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-cyan-500 transition-colors group-hover:bg-cyan-500 group-hover:text-black">
                                    <Layers className="h-5 w-5" />
                                </div>
                                <button
                                    onClick={e => handleDelete(e, list)}
                                    disabled={deletingId === list.id}
                                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all z-10"
                                    title="Listeyi Sil"
                                >
                                    {deletingId === list.id
                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                        : <X className="h-4 w-4" />}
                                </button>
                            </div>
                            <h3 className="font-medium text-white group-hover:text-cyan-400 truncate pr-2 text-sm">{list.name}</h3>
                            <p className="mt-1 text-xs text-gray-500 group-hover:text-cyan-300/70 transition-colors">Listeyi Gör &rarr;</p>
                        </Link>
                    ))}
                </div>
            )}

            {/* Spotlight paywall overlay when not spotlight */}
            {!isSpotlight && lists.length > 0 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-500 mb-3 border border-cyan-500/30">
                        <Layers className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Inflist'e Özel Erişim</h3>
                    <p className="text-xs text-gray-400 mt-1 mb-4 max-w-[220px]">Listelerinizi yönetmek için Spotlight ayrıcalıklarına sahip olun.</p>
                    <Link
                        href="/dashboard/spotlight/brand"
                        className="text-xs font-bold text-cyan-500 hover:text-cyan-400 transition-colors uppercase tracking-wider border-b border-cyan-500/30 pb-0.5 hover:border-cyan-500"
                    >
                        Spotlight'a Geç
                    </Link>
                </div>
            )}
        </section>
    )
}
