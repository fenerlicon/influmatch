'use client'

import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

interface DeleteConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title?: string
    description?: string
    isDeleting?: boolean
}

export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Silmek İstediğinize Emin Misiniz?',
    description = 'Bu işlem geri alınamaz.',
    isDeleting = false
}: DeleteConfirmationModalProps) {
    if (!isOpen) return null

    return createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-[24px] border border-red-500/20 bg-[#15161A] shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
                    <p className="mb-6 text-sm text-gray-400">{description}</p>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isDeleting}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                        >
                            İptal
                        </button>
                        <button
                            onClick={() => {
                                onConfirm()
                            }}
                            disabled={isDeleting}
                            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isDeleting ? 'Siliniyor...' : 'Evet, Sil'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
