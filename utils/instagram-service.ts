


// Interfaces for Internal Use (Normalized Data)
export interface NormalizedInstagramData {
    user: {
        id: string; // Platform ID (numeric string)
        username: string;
        full_name: string;
        biography: string;
        follower_count: number;
        following_count: number;
        media_count: number;
        is_verified: boolean;
        is_private: boolean;
        profile_pic_url: string;
        external_url?: string;
        category_name?: string;
        is_business_account?: boolean;
    };
    recent_posts: any[]; // We will keep the 'node' structure or normalize it. 
    // For minimum friction with existing code, let's try to return 'edges' structure if possible,
    // or normalized posts that the caller can easily map.
    // Existing code expects: edges[i].node.{edge_liked_by.count, is_video, etc.}
    // So let's return it exactly as the existing code expects it: "Edge objects"
}

/**
 * Fetches Instagram data using a Chain of Responsibility (StarAPI -> RocketAPI).
 * Throws an error only if ALL providers fail.
 */
// Free Trial (until Feb. 5, 2026)
/**
 * Fetches Instagram data using a Chain of Responsibility (RocketAPI -> StarAPI).
 * Throws an error only if ALL providers fail.
 */
export async function fetchInstagramData(username: string): Promise<NormalizedInstagramData> {
    console.log(`[InstagramService] Fetching data for: ${username}`)

    // 1. Try Primary Source: RocketAPI
    if (process.env.ROCKETAPI_KEY) {
        try {
            console.log('[InstagramService] Attempting Primary (RocketAPI)...')
            return await fetchFromRocketAPI(username)
        } catch (rocketError: any) {
            console.warn(`[InstagramService] Primary (RocketAPI) failed: ${rocketError.message || rocketError}`)
            // Proceed to fallback
        }
    } else {
        console.warn('[InstagramService] ROCKETAPI_KEY missing, skipping RocketAPI.')
    }

    // 2. Try Secondary Source: StarAPI (RapidAPI)
    try {
        console.log('[InstagramService] Attempting Secondary (StarAPI)...')
        return await fetchFromStarAPI(username)
    } catch (starError: any) {
        console.error(`[InstagramService] Secondary (StarAPI) failed: ${starError.message || starError}`)
        throw new Error(`Tüm veri kaynakları başarısız oldu.`)
    }
}

// implementation of StarAPI
async function fetchFromStarAPI(username: string): Promise<NormalizedInstagramData> {
    const rapidApiKey = process.env.RAPIDAPI_KEY
    if (!rapidApiKey) throw new Error('RAPIDAPI_KEY is missing')

    const response = await fetch('https://starapi1.p.rapidapi.com/instagram/user/get_web_profile_info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'starapi1.p.rapidapi.com'
        },
        body: JSON.stringify({ username })
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`StarAPI HTTP ${response.status}: ${errorText}`)
    }

    const data = await response.json()
    const user = data?.response?.body?.data?.user

    if (!user) {
        throw new Error('StarAPI: User object not found in response')
    }

    // Check for critical data (edges)
    // If StarAPI returns user but NO edges (API restriction), we should consider this a "failure" 
    // so we can fallback to RocketAPI which might work.
    const videoEdges = user.edge_felix_video_timeline?.edges || []
    const timelineEdges = user.edge_owner_to_timeline_media?.edges || []
    const totalEdges = videoEdges.length + timelineEdges.length
    const postCount = user.edge_owner_to_timeline_media?.count || 0

    if (postCount > 0 && totalEdges === 0) {
        throw new Error(`StarAPI returned 0 edges for user with ${postCount} posts (API Restriction).`)
    }

    return {
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            biography: user.biography || '',
            follower_count: user.edge_followed_by?.count || 0,
            following_count: user.edge_follow?.count || 0,
            media_count: user.edge_owner_to_timeline_media?.count || 0,
            is_verified: user.is_verified || false,
            is_private: user.is_private || false,
            profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
            external_url: user.external_url,
            category_name: user.category_name,
            is_business_account: user.is_business_account
        },
        recent_posts: videoEdges.length > 0 ? videoEdges : timelineEdges
    }
}

// implementation of RocketAPI
async function fetchFromRocketAPI(username: string): Promise<NormalizedInstagramData> {
    const rocketApiKey = process.env.ROCKETAPI_KEY
    if (!rocketApiKey) throw new Error('ROCKETAPI_KEY is missing')

    // Step 1: Get User Info to get ID
    const infoResponse = await fetch('https://v1.rocketapi.io/instagram/user/get_web_profile_info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${rocketApiKey}`
        },
        body: JSON.stringify({ username })
    })

    if (!infoResponse.ok) {
        const errorText = await infoResponse.text()
        throw new Error(`RocketAPI (Info) HTTP ${infoResponse.status}: ${errorText}`)
    }

    const infoData = await infoResponse.json()
    const user = infoData?.response?.body?.data?.user

    if (!user) {
        throw new Error('RocketAPI: User object not found in info response')
    }

    const userId = user.id

    // Step 2: Get Media (Posts) AND Reels (Clips)
    // We fetch both because 'get_media' (Feed) often excludes generic headers but might miss Reels-only posts.
    // 'get_clips' fetches specific Reels. We merge them to get a complete picture.

    const [mediaResponse, clipsResponse] = await Promise.all([
        fetch('https://v1.rocketapi.io/instagram/user/get_media', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${rocketApiKey}`
            },
            body: JSON.stringify({ id: Number(userId), count: 12 })
        }),
        fetch('https://v1.rocketapi.io/instagram/user/get_clips', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Token ${rocketApiKey}`
            },
            body: JSON.stringify({ id: Number(userId), count: 12 })
        })
    ]);

    let rawItems: any[] = []

    // Process Feed
    if (mediaResponse.ok) {
        const mediaData = await mediaResponse.json()
        const items = mediaData?.response?.body?.items || []
        rawItems = [...rawItems, ...items]
    } else {
        console.warn('[InstagramService] RocketAPI Feed fetch failed.')
    }

    // Process Clips
    if (clipsResponse.ok) {
        const clipsData = await clipsResponse.json()
        const items = clipsData?.response?.body?.items || []
        // Sometimes clips are wrapped in a 'media' object, sometimes direct. 
        // RocketAPI /get_clips usually returns direct media objects in 'items'.
        // We'll normalize just in case, but usually they are compatible.
        const normalizedClips = items.map((item: any) => item.media ? item.media : item)
        rawItems = [...rawItems, ...normalizedClips]
    } else {
        console.warn('[InstagramService] RocketAPI Clips fetch failed.')
    }

    // Deduplicate by ID
    const uniqueItemsMap = new Map()
    rawItems.forEach(item => {
        if (item.id) uniqueItemsMap.set(item.id, item)
    })
    const uniqueItems = Array.from(uniqueItemsMap.values())

    // Convert to Edges (Unified structure)
    // Helper to extract actual media object (handle nesting)
    const getMediaObject = (item: any) => item.media ? item.media : item;

    let edges = uniqueItems.map((rawItem: any) => {
        const item = getMediaObject(rawItem);
        return {
            node: {
                id: item.id,
                shortcode: item.code,
                display_url: item.image_versions2?.candidates?.[0]?.url,
                is_video: item.media_type === 2 || item.media_type === 8, // 2=Video, 8=Album(could be video), 1=Photo
                // RocketAPI for Clips returns 'play_count', Feed returns 'view_count' or 'play_count'.
                // We must catch all possibilities.
                video_view_count: Number(item.play_count) || Number(item.view_count) || Number(item.video_view_count) || 0,
                edge_media_to_comment: { count: item.comment_count || 0 },
                edge_liked_by: { count: item.like_count || 0 },
                taken_at_timestamp: item.taken_at || item.device_timestamp
            }
        }
    })

    // SORTING: Sort by date descending
    edges.sort((a, b) => (b.node.taken_at_timestamp || 0) - (a.node.taken_at_timestamp || 0))

    // Slice top 12
    edges = edges.slice(0, 12)


    return {
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            biography: user.biography || '',
            follower_count: user.edge_followed_by?.count || 0,
            following_count: user.edge_follow?.count || 0,
            media_count: user.edge_owner_to_timeline_media?.count || 0,
            is_verified: user.is_verified || false,
            is_private: user.is_private || false,
            profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url,
            external_url: user.external_url,
            category_name: user.category_name,
            is_business_account: user.is_business_account
        },
        recent_posts: edges
    }
}
