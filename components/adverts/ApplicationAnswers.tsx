import { formatAnswer, type AdvertAnswer } from '@/lib/adverts-shared'

/** Başvurudaki soru yanıtları (marka başvuru listesi ve influencer'ın kendi başvurusu). */
export default function ApplicationAnswers({ answers }: { answers?: AdvertAnswer[] }) {
  if (!answers?.length) return null
  return (
    <dl className="mt-2 grid gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px]">
      {answers.map((a, i) => (
        <div key={`${a.id}-${i}`}>
          <dt className="text-xs text-ink-faint">{a.question}</dt>
          <dd className="whitespace-pre-line text-ink-muted">{formatAnswer(a.answer)}</dd>
        </div>
      ))}
    </dl>
  )
}
