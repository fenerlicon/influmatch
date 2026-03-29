
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
    recent_posts: any[]; // We will keep the 'node' structure for compatibility.
}

/**
 * Utility for retrying async operations.
 */
async function withRetry<T>(fn: () => Promise<T>, retries: number, delay: number = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0) throw error;
        console.warn(`[InstagramService] Retrying operation... Attempts left: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 1.5);
    }
}

/**
 * Fetches Instagram data exclusively via Apify (Most reliable source).
 */
export async function fetchInstagramData(username: string): Promise<NormalizedInstagramData> {
    if (!process.env.APIFY_API_TOKEN) {
        throw new Error('APIFY_API_TOKEN eksik. Lütfen sistem yöneticisi ile görüşün.');
    }

    try {
        console.log(`[InstagramService] Fetching data for ${username} via Apify...`);
        // Start process and wait for completion (2 retries max for network issues)
        return await withRetry(() => fetchFromApify(username), 2);
    } catch (error: any) {
        console.error(`[InstagramService] Apify fetch failed: ${error.message || error}`);
        // Preserve original message if it's already descriptive
        const msg = error.message || 'Apify servis hatası';
        throw new Error(msg.includes('Instagram') ? msg : `Instagram verileri alınamadı: ${msg}`);
    }
}

/**
 * Implementation of Apify (instagram-scraper)
 */
async function fetchFromApify(username: string): Promise<NormalizedInstagramData> {
    const token = process.env.APIFY_API_TOKEN
    if (!token) throw new Error('APIFY_API_TOKEN is missing')

    // Clean @ from username if present
    const cleanUsername = username.replace('@', '').trim();

    // Using run-sync-get-dataset-items for maximum simplicity (one request)
    const response = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "directUrls": [`https://www.instagram.com/${cleanUsername}/`],
            "resultsType": "details",
            "resultsLimit": 1,
            "searchLimit": 1,
            "addParentData": true
        }),
    })

    if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) throw new Error('Apify API Token geçersiz.');
        if (response.status === 402) throw new Error('Apify bakiye yetersiz.');
        throw new Error(`Apify HTTP ${response.status}: ${errorText}`);
    }

    const items = await response.json()
    if (!items || items.length === 0) {
        throw new Error('Instagram profil verisi bulunamadı. Kullanıcı adının doğru olduğundan ve hesabın HERKESE AÇIK (Public) olduğundan emin olun.');
    }

    const data = items[0]
    
    // Check if the scraper returned error info
    if (data.error || !data.id) {
        if (data.message?.includes('found')) {
            throw new Error(`Instagram hesabı (@${cleanUsername}) bulunamadı. Lütfen kullanıcı adını kontrol edin.`);
        }
        throw new Error(`Apify Scraper Hatası: ${data.message || 'Kullanıcı verisi alınamadı.'}`);
    }

    const latestPosts = data.latestPosts || []

    // Map Apify structure to our internal NormalizedInstagramData (Compatible with existing stats calculation)
    const edges = latestPosts.map((post: any) => ({
        node: {
            id: post.id,
            shortcode: post.shortCode,
            display_url: post.displayUrl,
            // Simple video check for engagement calculation
            is_video: post.type === 'Video' || (post.type === 'Sidecar' && (post.children?.some((c: any) => c.type === 'Video'))),
            video_view_count: Number(post.videoViewCount || 0),
            edge_media_to_comment: { count: post.commentsCount || 0 },
            edge_liked_by: { count: post.likesCount || 0 },
            taken_at_timestamp: Math.floor(new Date(post.timestamp).getTime() / 1000),
            is_pinned: false // Apify details mode doesn't explicitly flag pinned
        }
    }))

    return {
        user: {
            id: data.id,
            username: data.username,
            full_name: data.fullName || data.username,
            biography: data.biography || '',
            follower_count: data.followersCount || 0,
            following_count: data.followsCount || 0,
            media_count: data.postsCount || 0,
            is_verified: data.isVerified || false,
            is_private: data.isPrivate || false,
            profile_pic_url: data.profilePicUrl,
            external_url: data.externalUrl,
            category_name: data.categoryName,
            is_business_account: data.isBusinessAccount
        },
        recent_posts: edges
    }
}
