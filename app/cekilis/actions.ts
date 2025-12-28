'use server'

const PARTICIPANTS = ['Furkan', 'Anıl', 'Efe', 'Erdem', 'Gökdeniz', 'Kübra']
// Determined seed for consistent randomization. 
const SEED_SALT = 8246135

// 6-digit random secure PINs
const PINS: Record<string, string> = {
    'furkan': '824195',
    'anıl': '390621',
    'efe': '715843',
    'erdem': '462098',
    'gökdeniz': '159734',
    'kübra': '603287'
}

function normalizeName(name: string): string {
    return name.toLocaleLowerCase('tr-TR').trim()
}

function isValidParticipant(name: string): boolean {
    const normalizedInput = normalizeName(name)
    return PARTICIPANTS.some(p => normalizeName(p) === normalizedInput)
}

function getCorrectName(name: string): string | undefined {
    const normalizedInput = normalizeName(name)
    return PARTICIPANTS.find(p => normalizeName(p) === normalizedInput)
}

function verifyPin(name: string, pin: string): boolean {
    const normalizedName = normalizeName(name)
    const correctPin = PINS[normalizedName]
    return correctPin === pin.trim()
}

// Pseudo-random number generator utilizing a seed
function mulberry32(a: number) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

function generateDeterministicMatches(): Record<string, string> {
    const rng = mulberry32(SEED_SALT)
    const shuffled = [...PARTICIPANTS]
    let isValid = false

    // Attempt to shuffle until valid. Since RNG is seeded, this is deterministic.
    let attempts = 0

    while (!isValid && attempts < 100) {
        // Fisher-Yates shuffle with seeded RNG
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        isValid = true
        for (let i = 0; i < PARTICIPANTS.length; i++) {
            // No self-matches
            if (PARTICIPANTS[i] === shuffled[i]) {
                isValid = false
                break
            }
        }
        attempts++
    }

    // Safety fallback (should rarely be needed with 6 users)
    if (!isValid) {
        // Shift by 1 if shuffle failed to prevent self-match
        const last = shuffled.pop()!
        shuffled.unshift(last)
    }

    const matches: Record<string, string> = {}
    PARTICIPANTS.forEach((p, i) => {
        matches[p] = shuffled[i]
    })

    return matches
}

export type DrawResult = {
    success: boolean
    error?: string
    match?: string
    user?: string
}

export async function getDrawResult(name: string, pin: string): Promise<DrawResult> {
    if (!isValidParticipant(name)) {
        return { success: false, error: 'Bu isim listede bulunmuyor. Lütfen isminizi doğru yazdığınızdan emin olun.' }
    }

    if (!pin || !verifyPin(name, pin)) {
        return { success: false, error: 'Hatalı şifre (PIN). Lütfen size verilen kodu girin.' }
    }

    const correctName = getCorrectName(name)!

    try {
        const matches = generateDeterministicMatches()
        const match = matches[correctName]

        return { success: true, match, user: correctName }

    } catch (error) {
        console.error('Draw error:', error)
        return { success: false, error: 'Bir hata oluştu.' }
    }
}
