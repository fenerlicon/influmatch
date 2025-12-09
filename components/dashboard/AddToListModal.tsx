'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Check, FolderOpen, Trash2 } from 'lucide-react'
import { createList, getInfluencerLists, toggleInList, deleteList } from '@/app/actions/favoriteLists'
import { toast } from 'sonner'
import DeleteConfirmationModal from '@/components/ui/DeleteConfirmationModal'

interface AddToListModalProps {
    influencerId: string
    isOpen: boolean
    onClose: () => void
}

export default function AddToListModal({ influencerId, isOpen, onClose }: AddToListModalProps) {
    const [lists, setLists] = useState<{ id: string, name: string, hasInfluencer: boolean }[]>([])
    const [newListName, setNewListName] = useState('')
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    useEffect(() => {
        if (isOpen) {
            loadLists()
        }
    }, [isOpen, influencerId])

    const loadLists = async () => {
        setLoading(true)
        const result = await getInfluencerLists(influencerId)
        setLists(result)
        setLoading(false)
    }

    const handleCreateList = async () => {
        if (!newListName.trim()) return
        setCreating(true)
        const res = await createList(newListName)
        if (res.error) {
            toast.error('Liste oluşturulamadı')
        } else {
            toast.success('Liste oluşturuldu')
            setNewListName('')
            loadLists()
        }
        setCreating(false)
    }

    const handleToggle = async (listId: string) => {
        // Optimistic update
        setLists(prev => prev.map(l => l.id === listId ? { ...l, hasInfluencer: !l.hasInfluencer } : l))

        const res = await toggleInList(listId, influencerId)
        if (res.error) {
            toast.error('İşlem başarısız')
            // Revert
            setLists(prev => prev.map(l => l.id === listId ? { ...l, hasInfluencer: !l.hasInfluencer } : l))
        }
    }

    const handleDeleteList = (listId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeleteId(listId)
    }

    const confirmDelete = async () => {
        if (!deleteId) return
        const res = await deleteList(deleteId)
        if (res.error) {
            toast.error('Liste silinemedi')
        } else {
            toast.success('Liste silindi')
            loadLists()
            setDeleteId(null)
        }
    }

    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#15161A] shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-white/5 p-5">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-soft-gold" />
                        <h3 className="text-lg font-semibold text-white">Listeye Ekle</h3>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1 text-gray-400 hover:bg-white/10 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* 1. Create New List */}
                    <div>
                        <div className="mb-2 flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Yeni Liste Oluştur</label>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Liste adı..."
                                className="flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-soft-gold/50 focus:bg-white/5 transition-colors"
                                value={newListName}
                                onChange={e => setNewListName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateList()}
                                autoFocus
                            />
                            <button
                                onClick={handleCreateList}
                                disabled={creating || !newListName.trim()}
                                className="flex items-center justify-center rounded-xl bg-white/10 px-4 text-white transition hover:bg-white/20 disabled:opacity-50"
                            >
                                {creating ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Plus className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Lists Container */}
                    <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                        {loading ? (
                            <p className="text-center text-sm text-gray-500 py-4">Yükleniyor...</p>
                        ) : lists.length === 0 ? (
                            <p className="text-center text-sm text-gray-500 py-4">Henüz hiç listeniz yok.<br />Yukarıdan yeni bir liste oluşturun.</p>
                        ) : (
                            <>
                                {/* 2. Latest List (Quick Add) */}
                                {(() => {
                                    const reversedLists = [...lists].reverse()
                                    const latestList = reversedLists[0]
                                    const otherLists = reversedLists.slice(1)

                                    return (
                                        <>
                                            {latestList && (
                                                <div className="space-y-2 relative group/latest">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-medium text-soft-gold uppercase tracking-wider flex items-center gap-1">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-soft-gold animate-pulse" />
                                                            Son Oluşturulan
                                                        </label>
                                                        <button
                                                            onClick={(e) => handleDeleteList(latestList.id, e)}
                                                            className="text-gray-500 hover:text-red-500 transition-colors p-1"
                                                            title="Listeyi Sil"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggle(latestList.id)}
                                                        className={`group relative w-full overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 ${latestList.hasInfluencer
                                                            ? 'border-emerald-500/50 bg-emerald-500/10'
                                                            : 'border-soft-gold/50 bg-soft-gold/5 hover:bg-soft-gold/10 hover:border-soft-gold'
                                                            }`}
                                                    >
                                                        <div className="relative z-10 flex items-center justify-between">
                                                            <span className={`font-semibold ${latestList.hasInfluencer ? 'text-emerald-400' : 'text-soft-gold'}`}>
                                                                {latestList.name}
                                                            </span>
                                                            {latestList.hasInfluencer ? (
                                                                <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-400">
                                                                    <Check className="h-3.5 w-3.5" />
                                                                    Eklendi
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1.5 rounded-lg bg-soft-gold/20 px-2.5 py-1 text-xs font-medium text-soft-gold group-hover:bg-soft-gold group-hover:text-black transition-colors">
                                                                    <Plus className="h-3.5 w-3.5" />
                                                                    Listeye Ekle
                                                                </span>
                                                            )}
                                                        </div>
                                                    </button>
                                                </div>
                                            )}

                                            {/* 3. Other Lists */}
                                            {otherLists.length > 0 && (
                                                <div className="space-y-2 pt-2">
                                                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Diğer Listeler</label>
                                                    <div className="space-y-2">
                                                        {otherLists.map(list => (
                                                            <div key={list.id} className="flex items-center gap-2 group">
                                                                <button
                                                                    onClick={() => handleToggle(list.id)}
                                                                    className={`flex-1 flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${list.hasInfluencer
                                                                        ? 'border-white/20 bg-white/5 text-white'
                                                                        : 'border-white/5 bg-transparent text-gray-400 hover:bg-white/5 hover:text-white'
                                                                        }`}
                                                                >
                                                                    <span className="text-sm font-medium">{list.name}</span>
                                                                    {list.hasInfluencer ? (
                                                                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                                                                            <Check className="h-3 w-3" /> Eklendi
                                                                        </span>
                                                                    ) : (
                                                                        <span className="opacity-0 group-hover:opacity-100 text-xs text-soft-gold flex items-center gap-1 transition-opacity">
                                                                            <Plus className="h-3 w-3" /> Ekle
                                                                        </span>
                                                                    )}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteList(list.id, e)}
                                                                    className="p-3 rounded-xl border border-white/5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                                    title="Listeyi Sil"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )
                                })()}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
