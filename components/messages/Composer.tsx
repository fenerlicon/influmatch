'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, Paperclip, Send, Smile, X } from 'lucide-react'
import EmojiPicker, { EmojiStyle, Theme, type EmojiClickData } from 'emoji-picker-react'
import { Button } from '@/components/ui'
import { cn } from '@/utils/cn'

interface Props {
  onSend: (message: string) => void
  onFileSelect: (file: File) => void
  disabled?: boolean
  placeholder?: string
  /** Gönderim kapalıysa nedeni (engel, onay bekleniyor). */
  notice?: string | null
}

/** Mesaj yazma alanı: görsel ekleme, emoji, Enter ile gönder (Shift+Enter yeni satır). */
export default function Composer({ onSend, onFileSelect, disabled, placeholder = 'Mesaj yaz', notice }: Props) {
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const emojiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`
  }, [message])

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  useEffect(() => {
    if (!emojiOpen) return
    const onDown = (e: MouseEvent) => emojiRef.current && !emojiRef.current.contains(e.target as Node) && setEmojiOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [emojiOpen])

  const clearFile = () => {
    setFile(null)
    setPreview(null)
  }

  const send = () => {
    if (disabled) return
    if (file) {
      onFileSelect(file)
      clearFile()
    } else if (message.trim()) {
      onSend(message.trim())
      setMessage('')
    }
    setEmojiOpen(false)
  }

  return (
    <div className="relative border-t border-line px-4 pb-4 pt-3 sm:px-5">
      {notice && <p className="mb-2 rounded-lg bg-warning/10 px-3 py-2 text-center text-xs text-warning">{notice}</p>}
      {emojiOpen && (
        <div ref={emojiRef} className="absolute bottom-full right-4 z-50 mb-2 overflow-hidden rounded-xl shadow-modal">
          <EmojiPicker
            onEmojiClick={(d: EmojiClickData) => setMessage((m) => m + d.emoji)}
            autoFocusSearch={false}
            theme={Theme.DARK}
            emojiStyle={EmojiStyle.NATIVE}
            skinTonesDisabled
            width={300}
            height={380}
          />
        </div>
      )}
      {file && preview && (
        <div className="relative mb-2 inline-block rounded-lg border border-line bg-surface-2 p-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Gönderilecek görsel" className="h-20 w-auto rounded-md object-cover" />
          <button type="button" onClick={clearFile} aria-label="Görseli kaldır" className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-surface-3 text-ink-muted hover:text-ink">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className={cn('flex items-end gap-2 rounded-xl border border-line-strong bg-surface-1 p-2 transition-colors focus-within:border-gold/40', disabled && 'opacity-60')}>
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setFile(f)
            setPreview(URL.createObjectURL(f))
          }}
        />
        <Button size="sm" variant="ghost" iconOnly aria-label="Görsel ekle" title="Görsel ekle" disabled={disabled || !!file} onClick={() => fileRef.current?.click()}>
          <Paperclip />
        </Button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={message}
          disabled={disabled || !!file}
          aria-label="Mesaj"
          placeholder={file ? 'Görsel gönderilmeye hazır' : placeholder}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className="max-h-[150px] min-h-[30px] flex-1 resize-none bg-transparent px-1.5 py-[5px] text-[13.5px] text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
        />
        <Button size="sm" variant="ghost" iconOnly aria-label="Emoji" className="hidden sm:inline-flex" disabled={disabled} onClick={() => setEmojiOpen((v) => !v)}>
          <Smile />
        </Button>
        <Button size="sm" variant="primary" leftIcon={<Send />} aria-label="Gönder" disabled={disabled || (!message.trim() && !file)} onClick={send}>
          <span className="hidden sm:inline">Gönder</span>
        </Button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
        <Lock className="h-3 w-3" aria-hidden />
        Güvenliğin için konuşmalar kayıt altında tutulur.
      </p>
    </div>
  )
}
