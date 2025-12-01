'use client'

import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

interface LegalModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    content: string
}

export default function LegalModal({ isOpen, onClose, title, content }: LegalModalProps) {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#1A1B23] shadow-2xl"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                                <h3 className="text-lg font-semibold text-white">{title}</h3>
                                <button
                                    onClick={onClose}
                                    className="rounded-lg p-1 text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="max-h-[60vh] overflow-y-auto p-6 custom-scrollbar">
                                <div className="prose prose-invert max-w-none">
                                    <p className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed">
                                        {content}
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="border-t border-white/5 px-6 py-4 flex justify-end">
                                <button
                                    onClick={onClose}
                                    className="rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                                >
                                    Kapat
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    )
}
