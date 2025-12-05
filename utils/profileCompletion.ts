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
  weight: number // Percentage weight for this field
}

export interface ProfileCompletionResult {
  percent: number
  completed: number
  total: number
  pendingTasks: string[]
  checklist: Array<CompletionField & { completed: boolean }>
}

// Weighted completion fields
// Total: 20% + 20% + 20% + 10% + 10% + 10% + 5% + 5% = 100%
const COMPLETION_FIELDS: CompletionField[] = [
  { key: 'avatar_url', label: 'avatar_url', task: 'avatar_url', weight: 20 },
  { key: 'full_name', label: 'full_name', task: 'full_name', weight: 20 },
  { key: 'username', label: 'username', task: 'username', weight: 20 },
  { key: 'city', label: 'city', task: 'city', weight: 10 },
  { key: 'category', label: 'category', task: 'category', weight: 10 },
  { key: 'bio', label: 'bio', task: 'bio', weight: 10 },
]

// Social media platforms (any one gives 5%, any additional gives 5% more, max 10%)
const SOCIAL_PLATFORMS = [
  'instagram',
  'tiktok',
  'youtube',
  'linkedin',
  'website',
  'kick',
  'twitter',
  'twitch',
] as const

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

const hasAnySocialLink = (socialLinks: Record<string, string | null> | null): boolean => {
  if (!socialLinks) return false
  return SOCIAL_PLATFORMS.some((platform) => isFilled(socialLinks[platform]))
}

const getSocialLinksCount = (socialLinks: Record<string, string | null> | null): number => {
  if (!socialLinks) return 0
  return SOCIAL_PLATFORMS.filter((platform) => isFilled(socialLinks[platform])).length
}

export function calculateProfileCompletion(
  profile: ProfileRecord,
  role?: 'influencer' | 'brand',
): ProfileCompletionResult {
  // Calculate base fields completion
  const checklist = COMPLETION_FIELDS.map((field) => {
    const value = getFieldValue(profile, field.key)
    const completed = isFilled(value)
    return { ...field, completed }
  })

  // Calculate social media completion
  const hasSocialLink = hasAnySocialLink(profile.social_links)
  const socialLinksCount = getSocialLinksCount(profile.social_links)

  // First social link: 5%, second or more: additional 5% (max 10% total)
  const socialMediaWeight = hasSocialLink ? (socialLinksCount >= 2 ? 10 : 5) : 0

  // Calculate total completion percentage
  let totalPercent = 0

  // Add weights for completed base fields
  checklist.forEach((field) => {
    if (field.completed) {
      totalPercent += field.weight
    }
  })

  // Add social media weight
  totalPercent += socialMediaWeight

  // Calculate completed count (base fields + social media)
  const completedBaseFields = checklist.filter((item) => item.completed).length
  const completed = completedBaseFields + (hasSocialLink ? 1 : 0) + (socialLinksCount >= 2 ? 1 : 0)
  const total = COMPLETION_FIELDS.length + 2 // Base fields + 2 social media slots

  // Generate pending tasks
  const pendingTasks: string[] = []

  checklist.forEach((field) => {
    if (!field.completed) {
      pendingTasks.push(field.task)
    }
  })

  // Add social media task if no links
  if (!hasSocialLink) {
    pendingTasks.push('social_media_1')
  } else if (socialLinksCount < 2) {
    // If only one social link, suggest adding another for full 10%
    pendingTasks.push('social_media_2')
  }

  return {
    percent: Math.min(Math.round(totalPercent), 100),
    completed,
    total,
    pendingTasks,
    checklist,
  }
}

export const profileCompletionFields = COMPLETION_FIELDS
