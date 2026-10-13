'use client'

import { ConfirmDialog } from './Modal'

interface DeleteConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title?: string
    description?: string
    isDeleting?: boolean
}

// Eski API korunur; görünüm ortak ConfirmDialog'dan gelir.
export default function DeleteConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title = 'Silmek istediğinize emin misiniz?',
    description = 'Bu işlem geri alınamaz.',
    isDeleting = false
}: DeleteConfirmationModalProps) {
    return (
        <ConfirmDialog
            open={isOpen}
            onClose={onClose}
            onConfirm={onConfirm}
            title={title}
            description={description}
            confirmLabel="Evet, sil"
            cancelLabel="İptal"
            tone="danger"
            loading={isDeleting}
        />
    )
}
