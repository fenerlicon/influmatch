'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'

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
    BRAND_PRO: ['basic', 'match_score', 'profile_coach', 'campaign_analysis']
}

export async function generateAIAnalysis(
    stats: any,
    mode: 'brand-view' | 'influencer-view',
    requestedType: AnalysisType = 'basic'
): Promise<AIAnalysisResponse> {
    const supabase = createSupabaseServerClient()

    // 0. GÜVENLİK: Kullanıcının gerçek üyelik seviyesini (Tier) veritabanından çek. 
    // Client'tan (tarayıcıdan) gelen "ben proyum" beyanına güvenme!
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return { analysis: [], error: 'Oturum açmanız gerekiyor.' }

    const { data: dbUser } = await supabase
        .from('users')
        .select('spotlight_active, spotlight_plan, role')
        .eq('id', authUser.id)
        .single()

    // Tier belirleme mantığı
    let userTier: SubscriptionTier = 'FREE'
    if (dbUser?.role === 'brand') userTier = 'BRAND_PRO' // Şimdilik markalar full erişim, ilerde plan eklenebilir.
    else if (dbUser?.spotlight_active) {
        if (dbUser.spotlight_plan === 'ipro') userTier = 'SPOTLIGHT_PLUS'
        else userTier = 'SPOTLIGHT'
    }

    // 1. Check Permissions
    if (!TIER_PERMISSIONS[userTier].includes(requestedType)) {
        return {
            analysis: [],
            error: `Bu özelliği kullanmak için paketiniz yetersiz. (Gerekli: ${getRequiredTierName(requestedType)})`
        }
    }

    // 2. Local Intelligence Logic (Free & Fast)
    try {
        const analysis = generateLocalAnalysis(stats, mode, requestedType)

        // Simulating a small network delay to make it feel like "thinking"
        // Also helps with "Pro" feeling
        await new Promise(resolve => setTimeout(resolve, 800))

        return { analysis }

    } catch (err: any) {
        console.error('Local Analysis Error:', err)
        return {
            analysis: [],
            error: 'Analiz oluşturulurken bir hata oluştu.'
        }
    }
}

// --- Local Intelligence Engine: LEGENDARY EDITION ---

function generateLocalAnalysis(stats: any, mode: 'brand-view' | 'influencer-view', type: AnalysisType): string[] {
    // --- METRIC EXTRACTION & NORMALIZATION ---
    const engagementRate = parseFloat(stats.engagementRate || stats.engagement || '0')
    const followers = parseMetric(stats.followerCount || stats.followers)
    const avgLikes = parseMetric(stats.avg_likes)
    const avgComments = parseMetric(stats.avg_comments)
    const avgViews = parseMetric(stats.avg_views)
    const postingFreq = stats.posting_frequency || 0 // Days between posts
    const category = (stats.category_name || '').toLowerCase()
    const isBusiness = stats.is_business_account
    const isVerified = stats.is_verified || false

    // --- DERIVED INTELLIGENCE METRICS (The "Secret Sauce") ---

    // 1. "Conversation Index" (Yorum / Beğeni): Kitlenin ne kadar konuşkan olduğu.
    // Normali %1-3 arasıdır. %5 üstü "tartışma/fanatizm", %0.5 altı "hayalet izleyici"dir.
    const conversationIndex = avgLikes > 0 ? (avgComments / avgLikes) * 100 : 0

    // 2. "Virality Multiplier" (İzlenme / Takipçi): İçeriğin takipçi balonunu aşıp aşmadığı.
    // %100 üstü her post viral demektir. %20 altı "sadece kemik kitle görüyor" demektir.
    const viralityMultiplier = followers > 0 ? (avgViews / followers) * 100 : 0

    // 3. "Audience Quality Score" (Etkili Kitle): Sadece sayı değil, aktif kişi sayısı.
    const activeAudience = followers * (engagementRate / 100)

    // Helper: Select random item from array
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

    const comments: string[] = []

    // ==========================================================================================
    // MODULE 1: MATCH SCORE (Brand Perspective - "Is this the right partner?")
    // ==========================================================================================
    if (type === 'match_score') {

        // --- SENARYO 1: "HIDDEN GEM" (Düşük Takipçi, Mega Etkileşim) ---
        if (followers < 20000 && engagementRate > 8) {
            comments.push("💎 Gizli Cevher Uyarısı: Henüz rakipleriniz tarafından keşfedilmemiş.")
            comments.push("📈 Yüksek Dönüşüm: Takipçileriyle arkadaş gibi, tavsiyeleri 'reklam' gibi algılanmıyor.")
            comments.push("💰 Fiyat/Performans Kralı: Bütçenizi yormadan maksimum etki alabileceğiniz nadir profillerden.")
        }

        // --- SENARYO 2: "THE ROCKSTAR" (Yüksek Takipçi, Yüksek Etkileşim) ---
        else if (followers > 100000 && engagementRate > 4) {
            comments.push("⭐ A-Plus Partner: Hem bilinirlik hem de satış getirebilecek komple bir paket.")
            comments.push("📢 Sektör Dominasyonu: Paylaştığı ürün kategorisindeki trendleri tek başına belirleyebiliyor.")
            comments.push("🛡️ Marka Prestiji: Bu isimle yan yana gelmek markanıza doğrudan statü katar.")
        }

        // --- SENARYO 3: "THE GHOST TOWN" (Yüksek Takipçi, Ölü Etkileşim) ---
        else if (followers > 50000 && engagementRate < 0.8) {
            comments.push("⚠️ 'Vanity Metric' Riski: Takipçi sayısı yüksek ancak kitle 'reklam körlüğü' yaşıyor olabilir.")
            comments.push("📉 Düşük Erişim: Gönderiler takipçilerin sadece çok küçük bir kısmının ana sayfasına düşüyor.")
            comments.push("👀 Sadece Bilinirlik: Satış odaklı değil, sadece logo görünürlüğü için tercih edilmeli.")
        }

        // --- SENARYO 4: "THE VIRAL MACHINE" (Yüksek İzlenme Oranı) ---
        else if (viralityMultiplier > 150) {
            comments.push("🚀 Viral Mıknatısı: İçerikleri takipçi sayısından bağımsız olarak milyonlara ulaşabiliyor.")
            comments.push("🌍 Keşfet Garantisi: Algoritmayı nasıl kullanacağını çözmüş, markanızı yeni kitlelere taşır.")
            comments.push("🎢 Yüksek Heyecan: Kampanya sonucu tahminlerin çok ötesinde (pozitif) olabilir.")
        }

        // --- SENARYO 5: "THE CONVERSATION STARTER" (Yüksek Yorum Oranı) ---
        else if (conversationIndex > 6) {
            comments.push("🗣️ Topluluk Lideri: Sadece içerik üretmiyor, kitlesiyle derin sohbetler başlatıyor.")
            comments.push("🧠 WOM (Ağızdan Ağıza) Etkisi: Ürününüz hakkında insanların konuşmasını sağlar.")
            comments.push("📝 Geri Bildirim Madeni: Ürününüz hakkında piyasadan gerçek yorum toplamak için ideal.")
        }

        // --- SENARYO 6: "THE PROFESSIONAL" (İşletme Hesabı + Düzenli Post) ---
        else if (isBusiness && postingFreq <= 3) {
            comments.push("👔 Profesyonel Yaklaşım: İşbirliklerine alışkın, brief'e sadık ve disiplinli çalışır.")
            comments.push("📅 Güvenilir Takvim: Kampanya zamanlamasında sürpriz yaşamazsınız.")
            comments.push("📊 Veri Odaklı: İstatistiklerini takip eden ve neyin çalıştığını bilen bir partner.")
        }

        // --- GENEL / MIXED SENARYOLAR ---
        else {
            if (activeAudience > 50000) comments.push("📢 Geniş Kapsama Alanı: Kitlesel pazarlama (Mass Marketing) hedefleri için uygun.")
            if (category.includes('moda') || category.includes('life')) comments.push("🎨 Görsel Vitrin: Ürününüzü estetik ve 'arzulanır' bir şekilde sunma kapasitesi yüksek.")
            else if (techOrGame(category)) comments.push("🕹️ Teknik Otorite: Kitlesi teknik detaylara ve 'geek' diline önem veriyor.")
            else comments.push("✅ Güvenli Liman: Risk almadan, standart ve öngörülebilir bir kampanya süreci sunar.")
        }
    }

    // ==========================================================================================
    // MODULE 2: PROFILE COACH (Influencer Perspective - "How can I grow?")
    // ==========================================================================================
    else if (type === 'profile_coach') {

        // --- DURUM 1: "İÇERİK VAR, ETKİLEŞİM YOK" (Low Engagement Rate) ---
        if (engagementRate < 1.5) {
            comments.push("🎣 Kancayı Takamıyorsun: Videolarının ilk 3 saniyesi (Hook) izleyiciyi tutmaya yetmiyor. Girişlerini hızlandır.")
            comments.push("❓ Soru Sorma Sanatı: Açıklamalarında (Caption) retorik değil, cevaplanması kolay somut sorular sor.")
            comments.push("🔄 Format Değişikliği: Kitlen mevcut formatından sıkılmış olabilir. Haftada 1 gün tamamen farklı bir konsept dene.")
        }

        // --- DURUM 2: "HAYALET TAKİPÇİLER" (View < Follower) ---
        else if (viralityMultiplier < 10) {
            comments.push("🧹 Bahar Temizliği: Kitlende çok fazla inaktif hesap olabilir. Onları uyandırmak için 'Hikaye Anketleri' yap.")
            comments.push("⏰ Saat Ayarı: Paylaşım saatlerin kitlenin aktif olduğu saatlerle uyuşmuyor. İstatistiklerinden en yoğun saati bul.")
            comments.push("🚫 Shadowban Kontrolü: Hashtag kullanımın spam algılanıyor olabilir. Sayısı azalt ve daha spesifik etiketler kullan.")
        }

        // --- DURUM 3: "TEK YÖNLÜ İLETİŞİM" (Low Conversation Index) ---
        else if (conversationIndex < 1) {
            comments.push("🤳 Samimiyet Dozu: Çok 'kurumsal' veya 'mükemmel' duruyorsun. Biraz kamera arkası (Bloopers) paylaşarak insan olduğunu hatırlat.")
            comments.push("🎁 Teşvik Mekanizması: Yorum yapanlardan birine küçük bir jest (takip, beğeni vs.) yapacağını duyur.")
            comments.push("🔥 Tartışmalı Konular: Sektörünle ilgili ikiye bölünen bir konuda tarafını seç ve tartışma başlat (Saygılı çerçevede).")
        }

        // --- DURUM 4: "DÜZENSİZLİK SENDROMU" (Low Posting Freq) ---
        else if (postingFreq > 7) {
            comments.push("📉 Algoritma Cezası: Instagram seni unuttu. Geri dönmek için 3 gün üst üste aynı saatte Reels atman lazım.")
            comments.push("🗓️ Stok İçerik: İlhamın olduğunda 5 video çekip draf'a at. 'Modum yok' dediğin günlerde hayat kurtarır.")
            comments.push("👋 Hikaye Sürekliliği: Post atamasan bile günde en az 3 Hikaye atarak o yuvarlağı renkli tut.")
        }

        // --- DURUM 5: "İYİ AMA MÜKEMMEL DEĞİL" (Average Stats) ---
        else {
            comments.push("🚀 Collab Zamanı: Kendi yağında kavrulma devri bitti. Benzer büyüklükteki bir arkadaşınla ortak post at.")
            comments.push("📌 Pin Stratejisi: Profiline girenler ilk ne görüyor? En iyi 3 videonu değil, 'Senin kim olduğunu anlatan' 3 videoyu sabitle.")
            comments.push("🎯 Seri Üretim: En çok tutan videon hangisi? O videoyu bir 'Seri' haline getir (Part 1, Part 2...). İnsanlar devamını bekler.")
            if (!isVerified && followers > 10000) comments.push("✅ Mavi Tik: Meta Verified veya başvuru ile o tiki al. Algısal otoriteni %50 artırır.")
        }
    }

    // ==========================================================================================
    // MODULE 3: CAMPAIGN ROI (Business Logic - "Show me the money")
    // ==========================================================================================
    else if (type === 'campaign_analysis') {

        const estimatedReach = Math.floor(activeAudience * (viralityMultiplier > 100 ? 2.5 : 1.2))
        const potentialCpm = (estimatedReach / 1000) * 50 // Varsayılan 50TL CPM üzerinden

        // --- ANALİZ 1: ERİŞİM MALİYETİ ---
        if (viralityMultiplier > 100) {
            comments.push(`📉 Düşük CPM Avantajı: Ortalama ${formatNumber(estimatedReach)} erişim ile birim maliyetiniz çok ucuza gelecektir.`)
        } else {
            comments.push(`💰 Hedefli Erişim: Yaklaşık ${formatNumber(estimatedReach)} kişilik, filtrelenmiş net bir kitleye hitap edeceksiniz.`)
        }

        // --- ANALİZ 2: DÖNÜŞÜM HUNİSİ ---
        if (engagementRate > 5) {
            comments.push("🔥 Sıcak Trafik: Bu kitlenin 'Link Tıklama' ve 'Sepete Ekleme' eğilimi sektör ortalamasının 3x üzerinde.")
        } else if (category.includes('blog') || category.includes('vlog')) {
            comments.push("👀 Soğuk Trafik (Awareness): Doğrudan satıştan ziyade, marka bilinirliği ve akılda kalıcılık için kullanılmalı.")
        }

        // --- ANALİZ 3: SEKTÖREL UYUM (Contextual ROI) ---
        if (techOrGame(category)) {
            comments.push("🖱️ Tech-Savvy Kitle: Uygulama indirme, kayıt olma veya dijital servis satın alma dönüşümleri çok yüksek olur.")
        } else if (category.includes('ev') || category.includes('dekor')) {
            comments.push("🏠 Yüksek Sepet Tutarı: Kitle, yüksek fiyatlı ve karar süreci uzun ürünleri almaya yatkın.")
        } else if (category.includes('kozmetik') || category.includes('bakım')) {
            comments.push("💄 Dürtüsel Alışveriş (Impulse Buy): Uygun fiyatlı ürünlerde anlık satış patlamaları yaratabilir.")
        } else {
            comments.push("📊 Güvenilir Yatırım: Risk/Getiri oranı dengeli. Fantastik sonuçlar olmasa da para kaybettirmez.")
        }
    }

    // ==========================================================================================
    // MODULE 4: GENERAL / SUMMARY (Quick Glance)
    // ==========================================================================================
    else {
        // KİŞİLİK ANALİZİ (Persona)
        if (conversationIndex > 5) comments.push("🗣️ Kanaat Önderi: Kitlesi onun fikirlerine ürünlerden daha fazla değer veriyor.")
        else if (viralityMultiplier > 200) comments.push("🎬 İçerik Makinesi: Algoritmanın dilinden anlayan, doğurgan bir üretici.")
        else if (postingFreq <= 2) comments.push("🐝 Çalışkan Arı: Disiplinli, istikrarlı ve sürprizsiz bir grafik çiziyor.")

        // KİTLE ANALİZİ (Audience)
        if (activeAudience > 500000) comments.push("🏟️ Stadyum Dolusu İnsan: Tek bir sözüyle kitleleri harekete geçirebilecek güce sahip.")
        else if (activeAudience > 50000) comments.push("🏙️ Şehir Meydanı: Sesini geniş kitlelere duyurabilen güçlü bir megafon.")
        else comments.push("☕ Butik Kafe: Az ama öz, birbirini tanıyan samimi bir topluluk.")

        // POTANSİYEL
        if (engagementRate > 6 && followers < 10000) comments.push(pick(["🌟 Geleceğin Yıldızı: Henüz yolun başında ama büyüme sinyalleri çok güçlü.", "📈 Erken Yatırım Fırsatı: Büyümeden yakalamak uzun vadede kazandırır."]))
        else if (followers > 1000000) comments.push(pick(["👑 Sektör Devi: Artık sadece bir influencer değil, bir medya kanalı.", "📺 Mainstream Medya: Geleneksel TV reklamlarına rakip bir erişim gücü."]))
        else comments.push("✅ Rüştünü İspatlamış: Ne yaptığını bilen, oturmuş bir profile sahip.")
    }

    // Karıştır ve ilk 3'ü ver (Her seferinde farklı hissettirmesi için)
    return comments.sort(() => 0.5 - Math.random()).slice(0, 3)
}

function getRequiredTierName(type: AnalysisType): string {
    switch (type) {
        case 'match_score': return 'Spotlight Plus'
        case 'profile_coach': return 'Spotlight Elite'
        case 'campaign_analysis': return 'Brand Pro'
        default: return 'Free'
    }
}

// Helpers
function parseMetric(val: any): number {
    if (typeof val === 'number') return val
    if (!val) return 0
    let str = val.toString().toUpperCase().replace(/,/g, '.')
    if (str.includes('M')) return parseFloat(str) * 1000000
    if (str.includes('K') || str.includes('B')) return parseFloat(str) * 1000
    return parseFloat(str.replace(/[^0-9.]/g, '')) || 0
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
}

function techOrGame(cat: string) {
    return ['tech', 'teknoloji', 'oyun', 'gaming', 'yazılım', 'crypto', 'kripto'].some(c => cat.includes(c))
}
