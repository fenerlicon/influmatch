// "İlk adımlar" kontrol listesi: sunucu ve tarayıcı ortak tipler/sabitler (sunucuya özel içe aktarım yok).

export type FirstStepKey =
  | 'verify_social'
  | 'complete_profile'
  | 'rate_card'
  | 'first_application'
  | 'corporate_email'
  | 'tax_certificate'
  | 'first_advert'
  | 'first_offer'

export interface FirstStep {
  key: FirstStepKey
  title: string
  description: string
  done: boolean
  /** Bekleyen durum notu (ör. vergi levhası "İnceleniyor"). */
  note: string | null
  /** Web'de adımın yapıldığı sayfa. Mobil aynı anahtarı kendi ekranına eşler. */
  href: string
}

export interface FirstStepsStatus {
  role: 'influencer' | 'brand'
  steps: FirstStep[]
  completed: number
  total: number
  allDone: boolean
  /** Ör. "4 adımdan 2'si tamam" (mobil de bu metni gösterir). */
  label: string
}

// Sayıya göre belirtme eki (0'ı, 1'i, 2'si, 3'ü, 4'ü, 5'i, 6'sı, 7'si, 8'i, 9'u, 10'u).
const ACCUSATIVE_SUFFIX = ['ı', 'i', 'si', 'ü', 'ü', 'i', 'sı', 'si', 'i', 'u', 'u']

export function firstStepsLabel(completed: number, total: number) {
  const suffix = ACCUSATIVE_SUFFIX[completed] ?? 'i'
  return `${total} adımdan ${completed}'${suffix} tamam`
}

/** Web'de "Gizle" tercihi bu çerezde tutulur (değer: kullanıcı kimliği; aynı tarayıcıdaki başka hesabı etkilemez). */
export const FIRST_STEPS_HIDDEN_COOKIE = 'im_first_steps_hidden'
