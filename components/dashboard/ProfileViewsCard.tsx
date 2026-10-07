import Link from 'next/link'
import { Eye, Lock, Building2 } from 'lucide-react'
import type { ProfileViewStats } from '@/lib/profile-views'

interface ProfileViewsCardProps {
  // null: Spotlight üyesi değil (sayılar sunucudan hiç gönderilmez) ya da okunamadı
  stats: ProfileViewStats | null
  isSpotlight: boolean
}

export default function ProfileViewsCard({ stats, isSpotlight }: ProfileViewsCardProps) {
  if (!isSpotlight) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#11121A] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/5 p-2 text-gray-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Profil görüntülenmeleri</p>
              <p className="mt-1 text-sm text-gray-400">
                Profilini kaç kişinin ve kaç markanın görüntülediğini Spotlight üyeleri görür.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/spotlight"
            className="rounded-lg border border-soft-gold/30 bg-soft-gold/20 px-3 py-1.5 text-xs font-semibold text-soft-gold transition hover:bg-soft-gold/30"
          >
            Spotlight&apos;ı Aç
          </Link>
        </div>
      </section>
    )
  }

  if (!stats) {
    return (
      <section className="rounded-3xl border border-white/10 bg-[#11121A] p-6 text-sm text-gray-400">
        Profil görüntülenmeleri şu an yüklenemedi.
      </section>
    )
  }

  const max = Math.max(1, ...stats.daily.map((d) => d.count))

  return (
    <section className="rounded-3xl border border-soft-gold/30 bg-gradient-to-br from-[#1a1b23] to-[#0a0b10] p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-soft-gold/20 p-2 text-soft-gold">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Profil görüntülenmeleri</p>
          <p className="text-xs text-gray-400">Aynı kişi gün içinde bir kez sayılır.</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400">Son 7 gün</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.last7}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] uppercase tracking-widest text-gray-400">Son 30 gün</p>
          <p className="mt-1 text-2xl font-bold text-white">{stats.last30}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-gray-400">
            <Building2 className="h-3 w-3" /> Marka
          </p>
          <p className="mt-1 text-2xl font-bold text-soft-gold">{stats.brandViewers30}</p>
          <p className="text-[10px] text-gray-500">son 30 gün, farklı marka</p>
        </div>
      </div>

      <div className="mt-5" aria-label="Son 14 günün günlük görüntülenmeleri">
        <div className="flex h-16 items-end gap-1">
          {stats.daily.map((day) => (
            <div
              key={day.date}
              title={`${new Date(`${day.date}T12:00:00`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}: ${day.count}`}
              className="flex-1 rounded-t bg-soft-gold/60"
              style={{ height: `${Math.max(4, (day.count / max) * 100)}%`, opacity: day.count === 0 ? 0.25 : 1 }}
            />
          ))}
        </div>
        <p className="mt-1 text-right text-[10px] text-gray-500">son 14 gün</p>
      </div>
    </section>
  )
}
