// Fiyat kartı teslimat türleri; web lib/rate-card-shared.ts ile aynı tutulmalı.
export const RATE_CARD_ITEMS = [
    { key: 'story', column: 'story_price', label: 'Story' },
    { key: 'reel', column: 'reel_price', label: 'Reels' },
    { key: 'post', column: 'post_price', label: 'Gönderi' },
    { key: 'ugc_video', column: 'ugc_video_price', label: 'UGC video' },
    { key: 'package', column: 'package_price', label: 'Paket' },
];

export const RATE_CARD_SELECT = 'user_id, story_price, reel_price, post_price, ugc_video_price, package_price, negotiable, updated_at';

export const formatTry = (value) => `₺${Number(value).toLocaleString('tr-TR')}`;
