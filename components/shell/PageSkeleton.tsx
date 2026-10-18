/**
 * Sayfa geçişlerinde anında görünen iskelet (2026-10-19): panel ve admin `loading.tsx` dosyaları kullanır. Kabuk (menü) yerinde
 * kalır, yalnızca içerik alanı yüklenirken bu gösterilir; tıklama sonrası ekran donmuş gibi görünmez.
 */
export default function PageSkeleton() {
  return (
    <div className="max-w-5xl animate-pulse" aria-busy="true" aria-label="Yükleniyor">
      <div className="mb-6 grid gap-2">
        <div className="h-7 w-48 rounded-lg bg-surface-2" />
        <div className="h-4 w-80 max-w-full rounded-md bg-surface-1" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[86px] rounded-2xl border border-line bg-surface-1" />
        ))}
      </div>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-surface-1" />
        ))}
      </div>
    </div>
  )
}
