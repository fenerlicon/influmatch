// Web ile aynı kategori listeleri (utils/categories.ts). Veritabanına anahtar (ör. 'beauty') yazılır,
// ekranda etiket gösterilir. Liste değişirse iki dosya birlikte güncellenmeli.

export const INFLUENCER_CATEGORIES = {
    beauty: 'Güzellik & Bakım',
    fashion: 'Moda & Stil',
    lifestyle: 'Yaşam Tarzı',
    food: 'Yeme & İçme',
    travel: 'Seyahat',
    tech: 'Teknoloji',
    gaming: 'Oyun & E-Spor',
    health: 'Sağlık & Spor',
    parenting: 'Anne & Çocuk',
    home: 'Ev & Dekorasyon',
    business: 'Finans & Girişim',
    entertainment: 'Eğlence & Mizah',
    automotive: 'Otomotiv',
    pets: 'Evcil Hayvan',
};

export const BRAND_CATEGORIES = {
    tech: 'Teknoloji',
    fashion: 'Giyim',
    beauty: 'Kozmetik',
    service: 'Hizmet',
    agency: 'Ajans',
    gaming: 'Oyun',
    finance: 'Finans',
    food: 'Yeme & İçme',
    travel: 'Seyahat',
    health: 'Sağlık & Spor',
    home: 'Ev & Dekorasyon',
    entertainment: 'Eğlence',
    automotive: 'Otomotiv',
    pets: 'Evcil Hayvan',
};

export const INFLUENCER_CATEGORY_KEYS = Object.keys(INFLUENCER_CATEGORIES);
export const BRAND_CATEGORY_KEYS = Object.keys(BRAND_CATEGORIES);

export const influencerCategoryLabel = (key) => INFLUENCER_CATEGORIES[key] || key || '';

// İlan kategorisi (web utils/categories.ts ile aynı): influencer kategorisi ya da 'general' (Genel).
export const ADVERT_GENERAL_CATEGORY = 'general';
export const ADVERT_CATEGORY_OPTIONS = [
    { value: ADVERT_GENERAL_CATEGORY, label: 'Genel (her kategori)' },
    ...INFLUENCER_CATEGORY_KEYS.map((key) => ({ value: key, label: INFLUENCER_CATEGORIES[key] })),
];
export const isGeneralAdvertCategory = (value) => !value || value === ADVERT_GENERAL_CATEGORY || value === 'Genel';
export const advertCategoryLabel = (value) => (isGeneralAdvertCategory(value) ? 'Genel' : INFLUENCER_CATEGORIES[value] || value);
export const advertFitsCategory = (advertCategory, influencerCategory) =>
    !!influencerCategory && (advertCategory === influencerCategory || isGeneralAdvertCategory(advertCategory));
export const brandCategoryLabel = (key) => BRAND_CATEGORIES[key] || key || '';
