// Sohbette "yazıyor…" ve "Görüldü"; web lib/chat-live-shared.ts ile aynı tutulmalı (web ↔ mobil aynı kanalı dinler).

export const CHAT_TYPING_EVENT = 'typing';
export const CHAT_READ_EVENT = 'read';
export const CHAT_TYPING_THROTTLE_MS = 2000;
export const CHAT_TYPING_SHOW_MS = 4000;

export function chatLiveChannel(a, b) {
    return `chat-live-${[a, b].sort().join('-')}`;
}

export function isSeenBy(lastReadAt, messageCreatedAt) {
    if (!lastReadAt) return false;
    return Date.parse(lastReadAt) >= Date.parse(messageCreatedAt);
}
