'use client'

// Teslimat taslak dosyası (R2, teslim kilidi; lib/deliverable-files.ts, 2026-11-24).
// - DeliverableFileUpload: influencer dosyayı doğrudan R2'ye yükler (imzalı PUT, ilerleme çubuğu); bitince referansı forma verir.
// - DeliverableFilePreview: iki taraf da uygulama içinde önizler (10 dakikalık bağlantı); indirme influencer'a her zaman,
//   markaya "Ödeme alındı"dan sonra açık. Önizleme oynatıcısında indirme menüsü kapalı (ekran kaydı engellenemez).

import { useRef, useState } from 'react'
import { Download, Eye, Lock, Upload } from 'lucide-react'
import { Button, Notice } from '@/components/ui'
import { deliverableFileAction, deliverableUploadAction } from '@/app/dashboard/collaborations/[id]/actions'
import {
  DELIVERABLE_FILE_ACCEPT,
  DELIVERABLE_LOCK_NOTE,
  deliverableFileExtension,
  deliverableFileKind,
  deliverableFileMaxBytes,
} from '@/lib/deliverable-files-shared'

function putWithProgress(url: string, file: File, contentType: string, onProgress: (pct: number) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300)
    xhr.onerror = () => resolve(false)
    xhr.onabort = () => resolve(false)
    xhr.send(file)
  })
}

export function DeliverableFileUpload({
  collaborationId,
  deliverableId,
  onUploaded,
  disabled,
}: {
  collaborationId: string
  deliverableId: string
  onUploaded: (ref: string | null, name: string | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    const extension = deliverableFileExtension(file.name, file.type)
    if (!extension) return setError('Yalnızca video (MP4, MOV, WEBM) veya görsel (JPEG, PNG, WEBP) yükleyebilirsiniz.')
    const max = deliverableFileMaxBytes(extension)
    if (file.size > max) return setError(`Dosya en fazla ${Math.round(max / (1024 * 1024))} MB olabilir.`)

    onUploaded(null, null)
    setName(file.name)
    setProgress(0)
    const start = await deliverableUploadAction(collaborationId, deliverableId, extension, file.size).catch(() => ({ error: 'Bağlantı hatası.' }))
    if (!('success' in start) || !start.success) {
      setProgress(null)
      setName(null)
      return setError(('error' in start && start.error) || 'Yükleme başlatılamadı.')
    }
    const ok = await putWithProgress(start.uploadUrl, file, start.contentType, setProgress)
    if (!ok) {
      setProgress(null)
      setName(null)
      return setError('Dosya yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.')
    }
    setProgress(100)
    onUploaded(start.ref, file.name)
  }

  const uploading = progress !== null && progress < 100
  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={DELIVERABLE_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()} leftIcon={<Upload />}>
          {name ? 'Başka dosya seç' : 'Video / görsel seç'}
        </Button>
        {name && <span className="max-w-[16rem] truncate text-xs text-ink-muted">{name}</span>}
      </div>
      {progress !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-gold transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {progress === 100 && <p className="text-xs text-success">Dosya yüklendi. Göndermek için &quot;Gönder&quot;e basın.</p>}
      {error && <Notice tone="danger">{error}</Notice>}
      <p className="text-xs text-ink-faint">Video en fazla 200 MB, görsel en fazla 15 MB. {DELIVERABLE_LOCK_NOTE}</p>
    </div>
  )
}

export function DeliverableFilePreview({
  collaborationId,
  fileRef,
  isBrand,
  downloadUnlocked,
  compact,
}: {
  collaborationId: string
  fileRef: string
  isBrand: boolean
  /** Marka için: influencer "Ödeme alındı" işaretlediyse true. Influencer için her zaman true. */
  downloadUnlocked: boolean
  compact?: boolean
}) {
  const kind = deliverableFileKind(fileRef)
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<'view' | 'download' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const open = async (mode: 'view' | 'download') => {
    setError(null)
    setLoading(mode)
    const result = await deliverableFileAction(collaborationId, fileRef, mode).catch(() => ({ error: 'Bağlantı hatası.' }))
    setLoading(null)
    if (!('success' in result) || !result.success) return setError(('error' in result && result.error) || 'Dosya açılamadı.')
    if (mode === 'view') setUrl(result.url)
    else window.location.assign(result.url)
  }

  const canDownload = !isBrand || downloadUnlocked
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!url && (
          <Button type="button" size="sm" variant={compact ? 'ghost' : 'secondary'} loading={loading === 'view'} onClick={() => open('view')} leftIcon={<Eye />}>
            {kind === 'image' ? 'Görseli önizle' : 'Videoyu önizle'}
          </Button>
        )}
        {canDownload ? (
          <Button type="button" size="sm" variant="ghost" loading={loading === 'download'} onClick={() => open('download')} leftIcon={<Download />}>
            İndir
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
            <Lock className="h-3.5 w-3.5" aria-hidden /> İndirme, &quot;Ödeme alındı&quot; işaretlenince açılır
          </span>
        )}
      </div>
      {url &&
        (kind === 'image' ? (
          // İmzalı bağlantı kısa ömürlü ve gizli kovadan; görsel optimizasyonundan geçirilmez.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Taslak önizlemesi"
            className="max-h-[420px] w-auto max-w-full rounded-lg border border-line object-contain"
            onContextMenu={(e) => !canDownload && e.preventDefault()}
            draggable={false}
          />
        ) : (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            controlsList={canDownload ? undefined : 'nodownload'}
            disablePictureInPicture={!canDownload}
            onContextMenu={(e) => !canDownload && e.preventDefault()}
            className="max-h-[480px] w-full max-w-xl rounded-lg border border-line bg-black"
          />
        ))}
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}
