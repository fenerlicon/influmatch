export interface ProfileRecord {
  full_name: string | null
  username: string | null
  city: string | null
  bio: string | null
  category: string | null
  avatar_url: string | null
  social_links: Record<string, string | null> | null
}

interface CompletionField {
  key: string
  label: string
  task: string
}

export interface ProfileCompletionResult {
  percent: number
  completed: number
  total: number
  pendingTasks: string[]
  checklist: Array<CompletionField & { completed: boolean }>
}

const COMPLETION_FIELDS: CompletionField[] = [
  { key: 'full_name', label: 'Ad Soyad', task: 'Ad soyadını ekle' },
  { key: 'username', label: 'Kullanıcı adı', task: 'Kullanıcı adını belirle' },
  { key: 'avatar_url', label: 'Avatar', task: 'Profil fotoğrafı yükle' },
  { key: 'bio', label: 'Biyografi', task: 'Biyografi alanını doldur' },
  { key: 'category', label: 'Kategori', task: 'Kategori seç' },
  { key: 'city', label: 'Şehir', task: 'Şehrini ekle' },
  { key: 'social_links.instagram', label: 'Instagram', task: 'Instagram linkini ekle' },
  { key: 'social_links.tiktok', label: 'TikTok', task: 'TikTok linkini ekle' },
  { key: 'social_links.youtube', label: 'YouTube', task: 'YouTube linkini ekle' },
  { key: 'social_links.linkedin', label: 'LinkedIn', task: 'LinkedIn linkini ekle' },
]

// Fields that are optional for brands
const BRAND_OPTIONAL_FIELDS = ['social_links.tiktok', 'social_links.youtube', 'social_links.linkedin']

const getFieldValue = (profile: ProfileRecord, path: string) => {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key]
    }
    return null
  }, profile)
}

const isFilled = (value: unknown) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') {
    return value.trim().length > 0
  }
  return true
}

export function calculateProfileCompletion(
  profile: ProfileRecord,
  role?: 'influencer' | 'brand',
): ProfileCompletionResult {
  // For brands, exclude TikTok, YouTube, and LinkedIn from required fields
  const fieldsToUse =
    role === 'brand'
      ? COMPLETION_FIELDS.filter((field) => !BRAND_OPTIONAL_FIELDS.includes(field.key))
      : COMPLETION_FIELDS

  const checklist = fieldsToUse.map((field) => {
    const value = getFieldValue(profile, field.key)
    const completed = isFilled(value)
    return { ...field, completed }
  })

  const total = checklist.length
  const completed = checklist.filter((item) => item.completed).length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  const pendingTasks = checklist.filter((item) => !item.completed).map((item) => item.task)

  return { percent, completed, total, pendingTasks, checklist }
}

export const profileCompletionFields = COMPLETION_FIELDS
