'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

// Define the response structure
export interface AIAnalysisResponse {
    analysis: string[]
    error?: string
}

export type AnalysisType = 'basic' | 'match_score' | 'profile_coach' | 'campaign_analysis'

// Define Subscription Tiers
export type SubscriptionTier = 'FREE' | 'SPOTLIGHT' | 'SPOTLIGHT_PLUS' | 'BRAND_PRO'

// Tier Permissions Configuration
const TIER_PERMISSIONS: Record<SubscriptionTier, AnalysisType[]> = {
    FREE: ['basic'],
    SPOTLIGHT: ['basic', 'match_score'],
    SPOTLIGHT_PLUS: ['basic', 'match_score', 'profile_coach'],
    BRAND_PRO: ['basic', 'match_score', 'profile_coach', 'campaign_analysis'] // Assuming Brand Pro gets everything
}

export async function generateAIAnalysis(
    stats: any,
    mode: 'brand-view' | 'influencer-view',
    userTier: SubscriptionTier = 'FREE',
    requestedType: AnalysisType = 'basic'
): Promise<AIAnalysisResponse> {

    // 1. Check Permissions
    if (!TIER_PERMISSIONS[userTier].includes(requestedType)) {
        return {
            analysis: [],
            error: `Bu özelliği kullanmak için paketiniz yetersiz. (Gerekli: ${getRequiredTierName(requestedType)})`
        }
    }

    // 2. Initial Checks
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
        return {
            analysis: [],
            error: 'API anahtarı yapılandırılmamış. Lütfen sistem yöneticisi ile iletişime geçin.'
        }
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey)
        // gemini-pro is deprecated/unavailable in some contexts. using gemini-1.5-flash which is widely available and fast.
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

        // 3. Construct Prompt based on Type
        let prompt = ''
        const statsStr = JSON.stringify(stats, null, 2)

        if (requestedType === 'match_score') {
            prompt = `
        Sen uzman bir Influencer Marketing stratejistisin.
        Aşağıdaki influencer istatistiklerini bir marka gözüyle incele.
        Marka için bu influencer ile çalışmanın ne kadar uygun olduğunu 0-100 arası bir "Match Score" (Uyum Skoru) ile değerlendir.
        
        Veriler: ${statsStr}
        
        Yanıt formatı (Sadece bu formatta dön):
        MATCH_SCORE: [Puan]
        NEDENLER:
        - [Kısa ve net bir neden]
        - [Kısa ve net bir neden]
        - [Kısa ve net bir neden]
      `
        } else if (requestedType === 'profile_coach') {
            prompt = `
        Sen ödüllü bir Sosyal Medya Koçusun.
        Bu influencer'ın kendisini geliştirmesi için verilerine dayanarak 3 adet çok özel, uygulanabilir ve taktiksel tavsiye ver.
        Genel geçer konuşma (örneğin "düzenli paylaş" deme), verilere atıfta bulunarak konuş.
        
        Veriler: ${statsStr}
        
        Yanıt formatı:
        Her madde başında bir emoji olsun. Samimi ve motive edici bir dille yaz.
      `
        } else if (requestedType === 'campaign_analysis') {
            prompt = `
        Sen bir Dijital Pazarlama ROI Analistisin.
        Bu influencer ile yapılacak bir reklam kampanyasının potansiyelini analiz et.
        Tahmini erişim, etkileşim kalitesi ve potansiyel dönüşüm hakkında profesyonel öngörülerde bulun.
        
        Veriler: ${statsStr}
        
        Yanıt formatı:
        Profesyonel, kurumsal ve veri odaklı 3 kritik içgörü maddesi.
      `
        } else {
            // Basic / Default
            prompt = `
        Aşağıdaki sosyal medya influencer istatistiklerini analiz et.
        Mod: ${mode === 'brand-view' ? 'Marka Gözüyle (Bu kişiyle çalışmalı mıyım?)' : 'Influencer Gözüyle (Nasıl daha iyi olabilirim?)'}
        
        Veriler:
        ${statsStr}

        Lütfen şu kurallara uy:
        1. Yanıtın Türkçe olsun.
        2. ${mode === 'brand-view' ? 'Profesyonel, objektif ve iş odaklı' : 'Motive edici, koç gibi ve yapıcı'} bir ton kullan.
        3. En önemli 3 çıkarımı madde madde yaz.
        4. Her madde en fazla 1 cümle olsun.
        5. Markdown formatında liste olarak ver.
      `
        }

        // 4. Call API
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        // 5. Parse Response (Simple splitting for now)
        const analysisPoints = text
            .split('\n')
            .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*') || line.trim().match(/^\d+\./))
            .map(line => line.replace(/^[-*]\s*|^\d+\.\s*/, '').trim())
            .filter(line => line.length > 0)
            .slice(0, 3) // Take top 3 points

        // Fallback if parsing fails (Gemini might return paragraph)
        if (analysisPoints.length === 0 && text.trim().length > 0) {
            return { analysis: [text.trim()] }
        }

        return { analysis: analysisPoints }

    } catch (err: any) {
        console.error('Gemini AI Error Check:', {
            message: err.message,
            stack: err.stack,
            apiKeyPresent: !!apiKey,
            response: err.response
        })

        return {
            analysis: [],
            error: `Hata Detayı: ${err.message || 'Bilinmeyen hata'}`
        }
    }
}

function getRequiredTierName(type: AnalysisType): string {
    switch (type) {
        case 'match_score': return 'Spotlight'
        case 'profile_coach': return 'Spotlight+'
        case 'campaign_analysis': return 'Brand Pro'
        default: return 'Free'
    }
}
