
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
            "resultsType": "reels",
            "resultsLimit": 15, // Using 15 to get enough recent reels
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
        throw new Error('Instagram profil verisi veya Reels bulunamadı. Kullanıcı hiç reels paylaşmamış olabilir veya hesap GİZLİ olabilir.');
    }

    // Since resultsType="reels" and addParentData=true, items is an array of reels,
    // and each item contains the parent profile details flatly.
    const parentData = items[0];

    // Check if the scraper returned error info
    if (parentData.error) {
        if (parentData.message?.includes('found')) {
            throw new Error(`Instagram hesabı (@${cleanUsername}) bulunamadı. Lütfen kullanıcı adını kontrol edin.`);
        }
        throw new Error(`Apify Scraper Hatası: ${parentData.message || 'Kullanıcı verisi alınamadı.'}`);
    }

    const latestPosts = items || []

    // Pre-calculate pinned status based on chronological inversion heuristic.
    // A post at index 'i' in the grid is considered pinned if it's older than ANY post that appears AFTER it in the grid.
    const timestamps = latestPosts.map((p: any) => new Date(p.timestamp || 0).getTime());
    const isPinnedArray = latestPosts.map((_: any, i: number) => {
        const currentTs = timestamps[i];
        for (let j = i + 1; j < timestamps.length; j++) {
            if (timestamps[j] > currentTs) {
                return true; // Found a newer post after this one -> this must be a pinned old post
            }
        }
        return false;
    });

    // Map Apify structure to our internal NormalizedInstagramData (Compatible with existing stats calculation)
    const edges = latestPosts.map((post: any, index: number) => ({
        node: {
            // Note: reels might have ownerId instead of id, but post id itself is id
            id: post.id, 
            shortcode: post.shortCode,
            display_url: post.displayUrl,
            // Reels are always video, but fallback check
            is_video: post.type === 'Video' || true, 
            video_view_count: Number(post.videoViewCount || post.videoPlayCount || 0),
            edge_media_to_comment: { count: post.commentsCount || 0 },
            edge_liked_by: { count: post.likesCount || 0 },
            taken_at_timestamp: Math.floor(new Date(post.timestamp).getTime() / 1000),
            is_pinned: post.isPinned === true || isPinnedArray[index] // Apify details mode sometimes misses this, we infer it
        }
    }))

    return {
        user: {
            id: String(parentData.ownerId || parentData.fbid || parentData.id),
            username: parentData.username,
            full_name: parentData.fullName || parentData.username,
            biography: parentData.biography || '',
            follower_count: parentData.followersCount || 0,
            following_count: parentData.followsCount || 0,
            media_count: parentData.postsCount || 0,
            is_verified: parentData.verified || false,
            is_private: parentData.private || false,
            profile_pic_url: parentData.profilePicUrl,
            external_url: parentData.externalUrl,
            category_name: parentData.businessCategoryName || parentData.categoryName,
            is_business_account: parentData.isBusinessAccount
        },
        recent_posts: edges
    }
}
