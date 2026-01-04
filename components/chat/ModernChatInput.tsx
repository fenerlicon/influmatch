'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Smile } from 'lucide-react'
import EmojiPicker, { EmojiStyle, Theme } from 'emoji-picker-react'

interface ModernChatInputProps {
    onSend: (message: string) => void
    onFileSelect?: (file: File) => void
    disabled?: boolean
    placeholder?: string
}

export default function ModernChatInput({ onSend, onFileSelect, disabled, placeholder = 'Bir mesaj yaz...' }: ModernChatInputProps) {
    const [message, setMessage] = useState('')
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const emojiContainerRef = useRef<HTMLDivElement>(null)

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`
        }
    }, [message])

    // Cleanup preview URL
    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl)
        }
    }, [previewUrl])

    // Close emoji picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiContainerRef.current && !emojiContainerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false)
            }
        }

        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showEmojiPicker])

    const handleSend = () => {
        if (disabled) return

        if (selectedFile && onFileSelect) {
            onFileSelect(selectedFile)
            setSelectedFile(null)
            setPreviewUrl(null)
            // If there is also text, we could handle it here, but current logic separates them.
            // For now, let's clear text message if it was intended as a caption (future feature).
            setMessage('')
        } else if (message.trim()) {
            onSend(message.trim())
            setMessage('')
        }
        setShowEmojiPicker(false)

        // Reset height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleFileClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setSelectedFile(file)
            const url = URL.createObjectURL(file)
            setPreviewUrl(url)
        }
        // Reset input value to allow selecting same file again
        if (e.target) {
            e.target.value = ''
        }
    }

    const clearFile = () => {
        setSelectedFile(null)
        setPreviewUrl(null)
    }

    const onEmojiClick = (emojiData: any) => {
        setMessage((prev) => prev + emojiData.emoji)
    }

    return (
        <div className="flex flex-col gap-2 relative">
            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
                <div
                    ref={emojiContainerRef}
                    className="absolute bottom-full right-0 mb-4 z-50 shadow-2xl rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                >
                    <EmojiPicker
                        onEmojiClick={onEmojiClick}
                        autoFocusSearch={false}
                        theme={Theme.DARK}
                        emojiStyle={EmojiStyle.NATIVE}
                        searchDisabled={false}
                        skinTonesDisabled
                        width={300}
                        height={400}
                    />
                </div>
            )}

            {/* File Preview Area */}
            {selectedFile && previewUrl && (
                <div className="relative inline-block w-fit rounded-xl border border-white/10 bg-[#151621] p-2">
                    <img src={previewUrl} alt="Preview" className="h-20 w-auto rounded-lg object-cover opacity-80" />
                    <button
                        onClick={clearFile}
                        className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600"
                        title="Kaldır"
                    >
                        ×
                    </button>
                    <span className="mt-1 block max-w-[150px] truncate text-[10px] text-gray-400">
                        {selectedFile.name}
                    </span>
                </div>
            )}

            <div className={`relative flex items-end gap-2 rounded-3xl border border-white/10 bg-[#151621] p-2 transition-all focus-within:border-soft-gold/50 focus-within:bg-[#1A1B26] focus-within:shadow-[0_0_20px_-5px_rgba(212,175,55,0.1)] ${showEmojiPicker ? 'border-soft-gold/30' : ''}`}>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    disabled={disabled}
                />
                <button
                    type="button"
                    disabled={disabled || !!selectedFile}
                    onClick={handleFileClick}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                    title="Görsel Ekle"
                >
                    <Paperclip className="h-5 w-5" />
                </button>

                <div className="flex-1 py-2">
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={disabled ? 'Mesaj gönderilemez' : selectedFile ? 'Görsel gönderiliyor...' : placeholder}
                        disabled={disabled || !!selectedFile}
                        rows={1}
                        className="max-h-[150px] w-full resize-none bg-transparent px-2 text-sm text-white placeholder-gray-500 scrollbar-thin scrollbar-thumb-white/10 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ minHeight: '24px' }}
                    />
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                        className={`hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition sm:flex disabled:opacity-50 ${showEmojiPicker ? 'text-yellow-400 bg-white/10' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                        title="Emoji"
                    >
                        <Smile className="h-5 w-5" />
                    </button>

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={(!message.trim() && !selectedFile) || disabled}
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-soft-gold text-[#0B0C10] transition hover:bg-soft-gold/90 hover:scale-105 disabled:bg-gray-700 disabled:text-gray-500 disabled:hover:scale-100"
                    >
                        <Send className={`h-5 w-5 ${message.trim() || selectedFile ? 'translate-x-0.5' : ''}`} />
                    </button>
                </div>
            </div>
        </div>
    )
}
