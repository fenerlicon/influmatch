'use server'

import fs from 'fs'
import path from 'path'

const PARTICIPANTS = ['Furkan', 'Anıl', 'Efe', 'Erdem', 'Gökdeniz', 'Kübra']
// Determine data file path. In production (Vercel), writing to filesystem is not persistent/allowed often.
// If this is a temporary local tool, it's fine. 
// If deployed, this might fail or reset.
// Using /tmp might be better for serverless but still not persistent.
// For now, keeping as is per user request.
const DATA_FILE = path.join(process.cwd(), 'app', 'cekilis', 'data.json')

interface DrawData {
    matches: Record<string, string>
    revealed: string[]
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

function generateMatches(): Record<string, string> {
    const shuffled = [...PARTICIPANTS]
    let isValid = false

    while (!isValid) {
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

export type DrawResult = {
    success: boolean
    error?: string
    match?: string
    user?: string
}

export async function getDrawResult(name: string): Promise<DrawResult> {
    if (!isValidParticipant(name)) {
        return { success: false, error: 'Bu isim listede bulunmuyor. Lütfen isminizi doğru yazdığınızdan emin olun.' }
    }

    const correctName = getCorrectName(name)!

    try {
        let data: DrawData = { matches: {}, revealed: [] }

        if (fs.existsSync(DATA_FILE)) {
            const fileContent = fs.readFileSync(DATA_FILE, 'utf-8')
            try {
                data = JSON.parse(fileContent)
            } catch (e) {
                // Corrupt file
            }
        }

        if (Object.keys(data.matches).length !== PARTICIPANTS.length) {
            data.matches = generateMatches()
            data.revealed = []
            try {
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
            } catch (e) {
                console.error("Could not write matches to file", e)
                // In read-only envs, this will fail. We continue in-memory but it won't persist.
            }
        }

        const match = data.matches[correctName]
        return { success: true, match, user: correctName }

    } catch (error) {
        console.error('Draw error:', error)
        return { success: false, error: 'Bir hata oluştu.' }
    }
}
