// Influcash (2026-11-23). Web'deki lib/influcash-shared.ts ile aynı tutulmalı (tests/mobile-parity.test.ts denetler).
// Kurallar sunucuda; burada yalnızca ekran metinleri.

export const INFLUCASH_RULE_NOTE = 'Influcash puanı paraya çevrilemez ve başka hesaba devredilemez.';

export const INFLUCASH_REWARD_LABELS = {
    spotlight_days: 'Spotlight günü',
    discount_percent: 'Spotlight indirim kodu',
    partner_coupon: 'İş ortağı kuponu',
};

export function itemDetail(i) {
    if (i.reward_type === 'spotlight_days') return `${i.days} gün Spotlight ${i.plan === 'pro' ? 'Pro' : 'Basic'}`;
    if (i.reward_type === 'discount_percent') return `Spotlight aboneliğinde %${i.percent} indirim kodu`;
    return i.partner_name ? `${i.partner_name} kuponu` : INFLUCASH_REWARD_LABELS.partner_coupon;
}
