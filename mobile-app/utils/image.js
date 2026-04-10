/**
 * Optimizes image URLs for performance, specifically targeting Supabase storage.
 * Transforms a standard object/public URL into a render/image/public URL with resizing params.
 */
export const getOptimizedUrl = (url, width = 600, height = 600) => {
    if (!url || typeof url !== 'string') return url;
    
    // Only optimize Supabase URLs
    if (url.includes('supabase.co') && url.includes('storage/v1/object/public/')) {
        try {
            // Replace /object/public/ with /render/image/public/
            let optimized = url.replace('storage/v1/object/public/', 'storage/v1/render/image/public/');
            
            // Append resize parameters
            const separator = optimized.includes('?') ? '&' : '?';
            optimized = `${optimized}${separator}width=${width}&height=${height}&resize=cover`;
            
            return optimized;
        } catch (e) {
            console.warn('Image optimization failed', e);
            return url;
        }
    }
    
    return url;
};

export const getThumbnailUrl = (url) => getOptimizedUrl(url, 300, 300);
export const getLargeUrl = (url) => getOptimizedUrl(url, 800, 800);
