'use server'

// Re-export from influencer settings since it's role-agnostic
export { updateEmailNotifications } from '@/app/dashboard/influencer/settings/actions'
export type { EmailNotificationSettings } from '@/app/dashboard/influencer/settings/actions'

