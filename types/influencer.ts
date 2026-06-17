import { type PlatformType } from '@/components/showcase/ProfileCard'

export interface DiscoverInfluencer {
    id: string
    full_name: string | null
    username: string | null
    category: string | null
    avatar_url: string | null
    spotlight_active: boolean | null
    displayed_badges?: string[] | null
    verification_status?: 'pending' | 'verified' | 'rejected' | null
    platform?: PlatformType
    platforms?: PlatformType[]
    platforms_data?: {
        platform: PlatformType
        follower_count: number | null
        followers: string
        engagement: string
    }[]
    stats?: {
        followers: string
        engagement: string
        avg_likes?: string
        avg_views?: string
        avg_comments?: string
    }
    creator_type?: 'influencer' | 'ugc' | 'both' | null
    matchScore?: number
    matchReasons?: string[]
}
