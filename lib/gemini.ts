// Gemini (Google AI) çağrıları: anahtar havuzu üzerinden içerik üretme ve anahtar kontrolü.
// Ücretsiz anahtarların dakikalık limiti dolunca kısa süre, günlük kotası dolunca
// ertesi güne (Pasifik saatiyle gece yarısı) kadar sıradaki anahtara geçilir.
//
// Model GEMINI_MODEL ortam değişkeniyle değiştirilebilir.
//
// BU DOSYA KASITLI OLARAK 'use server' DEĞİLDİR: istemciden çağrılamamalıdır.

import {
  ApiKeyError,
  ApiRequestError,
  ApiServiceError,
  fetchExternal,
  withApiKey,
  type KeyCheckResult,
} from '@/lib/api-keys'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.5-flash'

export function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL
}

export interface GeminiPart {
  text?: string
  inlineData?: { mimeType: string; data: string }
}

export interface GeminiRequest {
  contents: { role?: 'user' | 'model'; parts: GeminiPart[] }[]
  systemInstruction?: { parts: GeminiPart[] }
  generationConfig?: Record<string, unknown>
}

export interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
}

/** Gemini günlük kotaları Pasifik saatiyle gece yarısı sıfırlanır. */
export function nextPacificMidnight(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const msSinceMidnight = ((part('hour') * 60 + part('minute')) * 60 + part('second')) * 1000
  // Yaz saati geçişlerinde en fazla bir saat sapabilir; 1 dakika pay bırakılır.
  return new Date(now.getTime() - msSinceMidnight + 24 * 60 * 60 * 1000 + 60 * 1000)
}

async function classifyGeminiError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null)
  const error = body?.error ?? {}
  const message: string = error.message ?? `HTTP ${response.status}`
  const details: any[] = Array.isArray(error.details) ? error.details : []

  if (response.status === 400) {
    const keyProblem = details.some((d) => /API_KEY/i.test(String(d?.reason ?? ''))) || /api key/i.test(message)
    return keyProblem
      ? new ApiKeyError('invalid', `Gemini anahtarı geçersiz: ${message}`)
      : new ApiRequestError(`Gemini isteği reddedildi: ${message}`)
  }
  if (response.status === 401 || response.status === 403) {
    return new ApiKeyError('invalid', `Gemini anahtarının yetkisi yok: ${message}`)
  }
  if (response.status === 429) {
    const quotaIds = details.flatMap((d) => (Array.isArray(d?.violations) ? d.violations : []).map((v: any) => String(v?.quotaId ?? '')))
    if (quotaIds.some((id) => /PerDay/i.test(id))) {
      return new ApiKeyError('exhausted', 'Gemini günlük kotası doldu.', nextPacificMidnight())
    }
    const retryDelay = details.find((d) => typeof d?.retryDelay === 'string')?.retryDelay as string | undefined
    const seconds = retryDelay ? parseFloat(retryDelay) || 60 : 60
    return new ApiKeyError('rate_limited', 'Gemini dakikalık limiti aşıldı.', new Date(Date.now() + Math.ceil(seconds + 1) * 1000))
  }
  if (response.status >= 500) {
    return new ApiServiceError(`Gemini servis hatası (HTTP ${response.status}): ${message}`)
  }
  return new ApiRequestError(`Gemini isteği reddedildi (HTTP ${response.status}): ${message}`)
}

export async function generateGeminiContent(request: GeminiRequest, model = getGeminiModel()): Promise<GeminiResponse> {
  return withApiKey('gemini', async (key) => {
    const response = await fetchExternal(
      `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(request),
      },
      'Gemini',
    )
    if (!response.ok) throw await classifyGeminiError(response)
    return (await response.json()) as GeminiResponse
  })
}

export function getGeminiText(response: GeminiResponse): string {
  return (response.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? '').join('')
}

/** Anahtarın geçerliliğini ve yapılandırılan modelin erişilebilirliğini kontrol eder (kota harcamaz). */
export async function checkGeminiKey(key: string): Promise<KeyCheckResult> {
  const model = getGeminiModel()
  try {
    const response = await fetchExternal(
      `${GEMINI_BASE}/models/${encodeURIComponent(model)}`,
      { headers: { 'x-goog-api-key': key } },
      'Gemini',
    )
    if (response.status === 404) {
      return { status: 'active', message: `Anahtar geçerli ama "${model}" modeli bulunamadı. GEMINI_MODEL ayarını kontrol edin.`, cooldownUntil: null }
    }
    if (!response.ok) throw await classifyGeminiError(response)
    return { status: 'active', message: null, cooldownUntil: null }
  } catch (error) {
    if (error instanceof ApiKeyError) return { status: error.kind, message: error.message, cooldownUntil: error.cooldownUntil }
    return { status: 'error', message: error instanceof Error ? error.message : String(error), cooldownUntil: null }
  }
}
