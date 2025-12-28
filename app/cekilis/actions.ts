'use server'

import fs from 'fs'
import path from 'path'

const PARTICIPANTS = ['Furkan', 'Anıl', 'Efe', 'Erdem', 'Gökdeniz', 'Kübra']
const DATA_FILE = path.join(process.cwd(), 'app', 'cekilis', 'data.json')

interface DrawData {
    matches: Record<string, string>
    revealed: string[]
}

function normalizeName(name: string): string {
    // Turkish character normalization
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

function generateMatches(): Record<string, string> {
    const shuffled = [...PARTICIPANTS]
    let isValid = false

    while (!isValid) {
        // Fisher-Yates shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        isValid = true
        for (let i = 0; i < PARTICIPANTS.length; i++) {
            if (PARTICIPANTS[i] === shuffled[i]) {
                isValid = false
                break
            }
        }
    }

    const matches: Record<string, string> = {}
    PARTICIPANTS.forEach((p, i) => {
        matches[p] = shuffled[i]
    })

    console.log('New matches generated:', matches)
    return matches
}

export async function getDrawResult(name: string) {
    if (!isValidParticipant(name)) {
        return { error: 'Bu isim listede bulunmuyor. Lütfen isminizi doğru yazdığınızdan emin olun.' }
    }

    const correctName = getCorrectName(name)!

    try {
        let data: DrawData = { matches: {}, revealed: [] }

        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf-8')
            try {
                data = JSON.parse(fileContent)
            } catch (e) {
                // Corrupt file, recreate
            }
        }

        // Check if matches exist, if not (or partial/empty), generate new ones
        if (Object.keys(data.matches).length !== PARTICIPANTS.length) {
            data.matches = generateMatches()
            data.revealed = []
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
        }

        // Get match for this user
        const match = data.matches[correctName]

        // Note: We could track who has already 'revealed' their match if we want to prevent re-checks, 
        // but typically it's fine to let them check again if they forgot.
        // Ensure we don't expose everyone's matches

        return { match, user: correctName }

    } catch (error) {
        console.error('Draw error:', error)
        return { error: 'Bir hata oluştu.' }
    }
}
