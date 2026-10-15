import { ExternalLink } from 'lucide-react'
import { Chip, Eyebrow } from '@/components/ui'
import { briefHasContent, deliverablesText, type CampaignBrief } from '@/lib/campaigns-shared'

const formatDate = (value: string | null) =>
  value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : null

/** Kampanya brief'i (salt okunur): davet edilen influencer'ın teklif ve iş birliği ekranlarında. */
export default function CampaignBriefView({ brief, title = 'Kampanya brief’i' }: { brief: CampaignBrief; title?: string }) {
  const start = formatDate(brief.start_date)
  const end = formatDate(brief.end_date)
  const deliverables = deliverablesText(brief.default_deliverables)
  const sections: Array<[string, string | null]> = [
    ['Hedef', brief.goal],
    ['Ana mesajlar', brief.key_messages],
    ['Yapılacaklar', brief.dos],
    ['Yapılmayacaklar', brief.donts],
    ['Notlar', brief.notes],
  ]
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Eyebrow>{title}</Eyebrow>
        <Chip tone="gold">{brief.name}</Chip>
      </div>
      {(start || end) && (
        <p className="text-[12.5px] text-ink-faint">
          Kampanya tarihleri: {start ?? '—'} – {end ?? '—'}
        </p>
      )}
      {deliverables && <p className="text-[13px] text-ink-muted">Beklenen teslimatlar: {deliverables}</p>}
      {sections
        .filter(([, value]) => !!value)
        .map(([label, value]) => (
          <div key={label}>
            <div className="text-[12px] font-medium text-ink-faint">{label}</div>
            <p className="mt-0.5 whitespace-pre-line text-[13.5px] text-ink-muted">{value}</p>
          </div>
        ))}
      {brief.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {brief.hashtags.map((tag) => (
            <Chip key={tag}>{tag}</Chip>
          ))}
        </div>
      )}
      {brief.example_links.length > 0 && (
        <ul className="grid gap-1 text-[13px]">
          {brief.example_links.map((link) => (
            <li key={link}>
              <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 break-all text-info hover:underline">
                <ExternalLink className="h-3 w-3 flex-none" aria-hidden />
                {link}
              </a>
            </li>
          ))}
        </ul>
      )}
      {!briefHasContent(brief) && <p className="text-[13px] text-ink-faint">Marka bu kampanya için ayrıntı eklemedi.</p>}
    </div>
  )
}
