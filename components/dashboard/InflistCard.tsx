'use client'

import Link from 'next/link'
import { Layers, Trash2 } from 'lucide-react'
import { deleteList } from '@/app/actions/favoriteLists'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface InflistCardProps {
    list: {
        id: string
        name: string
    }
}

export default function InflistCard({ list }: InflistCardProps) {
    const router = useRouter()

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault() // prevent Link navigation
        e.stopPropagation()

        if (!confirm('Bu listeyi silmek istediğinize emin misiniz?')) return

        const res = await deleteList(list.id)
        if (res.error) {
            toast.error('Liste silinemedi')
        } else {
            toast.success('Liste silindi')
            router.refresh()
        }
    }

    return (
        <Link
            href={`/dashboard/brand/inflist/${list.id}`}
            className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-4 transition-all hover:border-cyan-500/50 hover:bg-cyan-500/10"
        >
            <div className="flex justify-between items-start">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-cyan-500 transition-colors group-hover:bg-cyan-500 group-hover:text-black">
                    <Layers className="h-5 w-5" />
                </div>
                <button
                    onClick={handleDelete}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-500 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Listeyi Sil"
                >
                    <Trash2 className="h-4 w-4" />
                </button>
            </div>

            <h3 className="font-medium text-white group-hover:text-cyan-400 truncate pr-2">{list.name}</h3>
            <p className="mt-1 text-xs text-gray-500 group-hover:text-cyan-300/70 transition-colors">Listeyi Gör &rarr;</p>
        </Link>
    )
}
