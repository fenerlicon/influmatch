'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile } from 'lucide-react'

interface ModernChatInputProps {
    onSend: (message: string) => void
    disabled?: boolean
    placeholder?: string
}

export default function ModernChatInput({ onSend, disabled, placeholder = 'Bir mesaj yaz...' }: ModernChatInputProps) {
    const [message, setMessage] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
        }
    }, [message])

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSend(message.trim())
            setMessage('')
            // Reset height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    return (
        <div className="relative flex items-end gap-2 rounded-3xl border border-white/10 bg-[#151621] p-2 transition-all focus-within:border-soft-gold/50 focus-within:bg-[#1A1B26] focus-within:shadow-[0_0_20px_-5px_rgba(212,175,55,0.1)]">
            <button
                type="button"
                disabled={disabled}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Dosya Ekle (Yakında)"
            >
                <Paperclip className="h-5 w-5" />
            </button>

            <div className="flex-1 py-2">
                <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={disabled ? 'Mesaj gönderilemez' : placeholder}
                    disabled={disabled}
                    rows={1}
                    className="max-h-[150px] w-full resize-none bg-transparent px-2 text-sm text-white placeholder-gray-500 scrollbar-thin scrollbar-thumb-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ minHeight: '24px' }}
                />
            </div>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    disabled={disabled}
                    className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white sm:flex disabled:opacity-50"
                    title="Emoji (Yakında)"
                >
                    <Smile className="h-5 w-5" />
                </button>

                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!message.trim() || disabled}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-soft-gold text-[#0B0C10] transition hover:bg-soft-gold/90 hover:scale-105 disabled:bg-gray-700 disabled:text-gray-500 disabled:hover:scale-100"
                >
                    <Send className={`h-5 w-5 ${message.trim() ? 'translate-x-0.5' : ''}`} />
                </button>
            </div>
        </div>
    )
}
