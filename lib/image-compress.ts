// Tarayıcıda görsel küçültme (2026-10-19): sohbet ekleri ve benzeri yüklemeler depoya gitmeden önce en uzun kenar 1600 px,
// WebP (desteklenmiyorsa JPEG) kalite 0,82'ye indirilir. Telefon fotoğrafı (3–5 MB) tipik olarak 200–400 KB olur: depolama ve
// indirme trafiği (Supabase kotası) düşer, karşı tarafta görsel hızlı açılır. GIF ve küçük dosyalar olduğu gibi kalır; küçültme
// sonucu büyürse asıl dosya kullanılır. Yalnızca tarayıcıda çağrılır.

export interface CompressOptions {
  maxSide?: number
  quality?: number
  /** Bu boyutun altındaki dosyalara dokunulmaz. */
  skipBelowBytes?: number
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Görsel okunamadı.'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality))
}

/** Küçültülmüş dosya ve uzantısı; küçültme mümkün değilse asıl dosya. */
export async function compressImage(file: File, opts: CompressOptions = {}): Promise<{ file: File; extension: string }> {
  const original = { file, extension: (file.name.split('.').pop() || 'jpg').toLowerCase() }
  const { maxSide = 1600, quality = 0.82, skipBelowBytes = 300 * 1024 } = opts
  if (typeof document === 'undefined' || file.type === 'image/gif' || file.size < skipBelowBytes) return original
  try {
    const img = await loadImage(file)
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return original
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    let blob = await toBlob(canvas, 'image/webp', quality)
    let type = 'image/webp'
    let extension = 'webp'
    if (!blob || blob.type !== 'image/webp') {
      blob = await toBlob(canvas, 'image/jpeg', quality)
      type = 'image/jpeg'
      extension = 'jpg'
    }
    if (!blob || blob.size >= file.size) return original
    return { file: new File([blob], `${Date.now()}.${extension}`, { type }), extension }
  } catch {
    return original
  }
}
