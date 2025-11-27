'use client'

import Image from 'next/image'
import { ChangeEvent } from 'react'

interface AvatarUploaderProps {
  label: string
  imageUrl: string | null
  isUploading: boolean
  onFileChange: (file: File) => void
}

export default function AvatarUploader({ label, imageUrl, isUploading, onFileChange }: AvatarUploaderProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      onFileChange(file)
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-300">{label}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-white/5">
          {imageUrl ? (
            <Image src={imageUrl} alt="Avatar" fill sizes="80px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">Fotoğraf</div>
          )}
        </div>
        <label className="cursor-pointer rounded-full border border-white/15 px-6 py-2 text-sm text-white transition hover:border-soft-gold/60 hover:text-soft-gold">
          {isUploading ? 'Yükleniyor...' : 'Fotoğraf Yükle'}
          <input type="file" accept="image/*" className="hidden" onChange={handleInputChange} disabled={isUploading} />
        </label>
      </div>
    </div>
  )
}

