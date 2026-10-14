'use client'

import Image from 'next/image'
import { ChangeEvent } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { buttonClasses } from '@/components/ui'

interface AvatarUploaderProps {
  label: string
  imageUrl: string | null
  isUploading: boolean
  onFileChange: (file: File) => void
}

export default function AvatarUploader({ label, imageUrl, isUploading, onFileChange }: AvatarUploaderProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onFileChange(file)
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-[72px] w-[72px] flex-none place-items-center overflow-hidden rounded-full border border-line-strong bg-surface-2 text-ink-faint">
        {imageUrl ? <Image src={imageUrl} alt={label} fill sizes="72px" className="object-cover" /> : <ImagePlus className="h-6 w-6" aria-hidden />}
      </div>
      <div className="grid gap-1.5">
        <span className="text-[12.5px] font-medium text-ink-muted">{label}</span>
        <label className={buttonClasses({ size: 'sm', className: isUploading ? 'pointer-events-none opacity-60' : 'cursor-pointer' })}>
          {isUploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          {isUploading ? 'Yükleniyor…' : imageUrl ? 'Değiştir' : 'Fotoğraf yükle'}
          <input type="file" accept="image/*" className="sr-only" onChange={handleInputChange} disabled={isUploading} />
        </label>
      </div>
    </div>
  )
}
