import { runApifyActor } from '@/lib/apify'
import { ApiServiceError } from '@/lib/api-keys'

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
 * Sadece geçici servis hataları (5xx, zaman aşımı, ağ) tekrar denenir; "profil bulunamadı" gibi
 * kesin sonuçlar veya anahtar havuzunun tükenmesi tekrar denenmez (her deneme Apify kredisi harcar).
 */
async function withRetry<T>(fn: () => Promise<T>, retries: number, delay: number = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries <= 0 || !(error instanceof ApiServiceError)) throw error;
        console.warn(`[InstagramService] Retrying operation... Attempts left: ${retries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 1.5);
    }
}

/**
 * Fetches Instagram data exclusively via Apify (Most reliable source).
 */
export async function fetchInstagramData(username: string): Promise<NormalizedInstagramData> {
    try {
        console.log(`[InstagramService] Fetching data for ${username} via Apify...`);
        // Start process and wait for completion (2 retries max for network issues)
        return await withRetry(() => fetchFromApify(username), 2);
    } catch (error: any) {
        console.error(`[InstagramService] Apify fetch failed: ${error.message || error}`);
        // Preserve original message if it's already descriptive
        const msg = error.message || 'Apify servis hatası';
        // Asıl hata cause olarak korunur: servis kesintisi (kredi bitti vb.) hesaba özel hatadan ayırt edilir.
        throw Object.assign(new Error(msg.includes('Instagram') ? msg : `Instagram verileri alınamadı: ${msg}`), { cause: error });
    }
}

/**
 * Implementation of Apify (instagram-scraper)
 */
async function fetchFromApify(username: string): Promise<NormalizedInstagramData> {
    // Clean @ or full URL and normalize Turkish characters / case
    let cleanUsername = username.replace(/İ/g, 'i').replace(/I/g, 'i').toLowerCase().replace('@', '').trim();
    if (cleanUsername.includes('instagram.com/')) {
        const parts = cleanUsername.split('instagram.com/');
        if (parts.length > 1) {
            cleanUsername = parts[1].split('?')[0].split('/')[0].trim();
        }
    }

    // run-sync-get-dataset-items: tek istek. Anahtar havuzu patlayan anahtarı otomatik değiştirir.
    const items = await runApifyActor('apify~instagram-scraper', {
        "directUrls": [`https://www.instagram.com/${cleanUsername}/`],
        "resultsType": "posts",
        "resultsLimit": 15, // Using 15 to get enough recent posts
        "addParentData": true
    })
    // Gönderisi olmayan veya kazıyıcının gönderi listesini döndüremediği hesaplarda gönderi
    // modu boş ya da hata kaydı döner (Apify: {error, errorDescription}). Bu durumda profil
    // bilgisi ayrıca "details" moduyla alınır; ek koşu yalnızca bu durumda yapılır.
    const firstItem = items?.[0]
    if (!items || items.length === 0 || firstItem?.error) {
        return fetchProfileDetails(cleanUsername, firstItem)
    }

    const parentData = firstItem;

    const latestPosts = items || []

    // Pre-calculate pinned status based on chronological inversion heuristic.
    // A post at index 'i' in the grid is considered pinned if it's older than ANY post that appears AFTER it in the grid.
    const timestamps = latestPosts.map((p: any) => new Date(p.timestamp || 0).getTime());
    const isPinnedArray = latestPosts.map((_: any, i: number) => {
        if (i >= 3) return false; // Only the first 3 posts can be pinned on Instagram
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
            is_video: post.type === 'Video' || post.isVideo === true, 
            video_view_count: Number(post.videoViewCount || post.videoPlayCount || 0),
            edge_media_to_comment: { count: post.commentsCount || 0 },
            edge_liked_by: { count: post.likesCount || 0 },
            taken_at_timestamp: Math.floor(new Date(post.timestamp).getTime() / 1000),
            is_pinned: (post.isPinned === true) || (post.is_pinned === true) || isPinnedArray[index] 
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

function apifyErrorText(item: any): string {
    return String(item?.errorDescription || item?.message || item?.error || '').trim()
}

/** Hata kaydını kullanıcıya gösterilecek açıklamaya çevirir. */
function describeApifyError(username: string, item: any): string {
    const text = apifyErrorText(item).toLowerCase()
    if (text.includes('not found') || text.includes('not_found') || text.includes("doesn't exist") || text.includes('does not exist')) {
        return `Instagram hesabı (@${username}) bulunamadı. Lütfen kullanıcı adını kontrol edin.`
    }
    if (text.includes('private')) {
        return `Instagram hesabı (@${username}) gizli görünüyor. Doğrulama için hesabı geçici olarak herkese açık yapın.`
    }
    return `Instagram hesabı (@${username}) okunamadı. Hesabın herkese açık olduğundan emin olup birkaç dakika sonra tekrar deneyin.`
}

/** Profil bilgisi (gönderi listesi alınamadığında). */
async function fetchProfileDetails(username: string, postsErrorItem: any): Promise<NormalizedInstagramData> {
    if (postsErrorItem) {
        console.warn(`[InstagramService] Gönderi modu hata döndü (@${username}): ${apifyErrorText(postsErrorItem) || 'açıklama yok'}`)
    }

    const details = await runApifyActor('apify~instagram-scraper', {
        directUrls: [`https://www.instagram.com/${username}/`],
        resultsType: 'details',
        resultsLimit: 1,
    })
    const profile = details?.[0]

    if (!profile || profile.error || !profile.username) {
        if (profile?.error) {
            console.warn(`[InstagramService] Profil modu hata döndü (@${username}): ${apifyErrorText(profile) || 'açıklama yok'}`)
        }
        throw new Error(describeApifyError(username, profile?.error ? profile : postsErrorItem))
    }

    if (profile.private) {
        throw new Error(describeApifyError(username, { error: 'private' }))
    }

    const posts: any[] = Array.isArray(profile.latestPosts) ? profile.latestPosts.slice(0, 15) : []
    const edges = posts.map((post: any) => ({
        node: {
            id: post.id,
            shortcode: post.shortCode,
            display_url: post.displayUrl,
            is_video: post.type === 'Video' || post.isVideo === true,
            video_view_count: Number(post.videoViewCount || post.videoPlayCount || 0),
            edge_media_to_comment: { count: post.commentsCount || 0 },
            edge_liked_by: { count: post.likesCount || 0 },
            taken_at_timestamp: Math.floor(new Date(post.timestamp).getTime() / 1000),
            is_pinned: post.isPinned === true,
        },
    }))

    return {
        user: {
            id: String(profile.id || profile.fbid || ''),
            username: profile.username,
            full_name: profile.fullName || profile.username,
            biography: profile.biography || '',
            follower_count: profile.followersCount || 0,
            following_count: profile.followsCount || 0,
            media_count: profile.postsCount || 0,
            is_verified: profile.verified || false,
            is_private: profile.private || false,
            profile_pic_url: profile.profilePicUrl,
            external_url: profile.externalUrl,
            category_name: profile.businessCategoryName || profile.categoryName,
            is_business_account: profile.isBusinessAccount,
        },
        recent_posts: edges,
    }
}
