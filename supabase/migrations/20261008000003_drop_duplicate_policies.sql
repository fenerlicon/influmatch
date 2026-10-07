-- ==============================================================================
-- 2026-10-08: Kopya ve ölü politikaların silinmesi (DROP POLICY: kullanıcı SQL Editor'de çalıştırır)
--
-- 20261008000001'den SONRA çalıştırılmalıdır. Her biri aynı işlem için ikinci kez tanımlanmış (permissive
-- kurallar OR'landığı için her sorguda iki kez değerlendiriliyordu) ya da artık hiçbir yazım yolu olmayan
-- kurallardır. Silinmeleri erişimi değiştirmez; kalan kural aynı ya da daha geniş koşulu zaten taşıyor.
-- (Supabase performans uyarısı multiple_permissive_policies, SYSTEM_MAP 7.4)
-- ==============================================================================

-- Birebir kopyalar (kalan kural aynı koşulu taşıyor)
DROP POLICY IF EXISTS "Users can manage their own favorite lists" ON public.favorite_lists;          -- = "Brands can manage their own favorite lists"
DROP POLICY IF EXISTS "User can see messages in their rooms" ON public.messages;                    -- = "Users can view messages in their rooms"
DROP POLICY IF EXISTS "User can send messages to their rooms" ON public.messages;                   -- 20261008000001 ile "Users can send messages in their rooms" ile aynı
DROP POLICY IF EXISTS "User can see their own rooms" ON public.rooms;                                -- = "Users can view their rooms"
DROP POLICY IF EXISTS "System can create rooms" ON public.rooms;                                     -- 20261008000001 ile "Users can insert rooms they are part of" ile aynı
DROP POLICY IF EXISTS "Users can insert their own badges" ON public.user_badges;                     -- adı yanıltıcı; "Admins can insert badges for any user" ile aynı (yalnızca admin)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;                    -- 20261008000001 ile "Authenticated users can view profiles" ile aynı
DROP POLICY IF EXISTS "Brands can view own analytics" ON public.analytics_events;                    -- "Users can only view their own brand analytics" kapsıyor

-- Ölü kurallar (istemci rollerinin bu işlem için tablo yetkisi yok ya da kova yok)
DROP POLICY IF EXISTS "Users can insert their own history" ON public.social_account_history;         -- istemcide INSERT yetkisi yok; yazım service role
DROP POLICY IF EXISTS "Admins can insert history" ON public.social_account_history;                  -- admin işlemleri service role ile
DROP POLICY IF EXISTS "Authenticated users can insert events" ON public.analytics_events;            -- yazım yalnızca track_analytics_event
DROP POLICY IF EXISTS "Function can insert message logs" ON public.message_logs;                     -- log_message istemcilere kapalı
DROP POLICY IF EXISTS "Kullanıcılar sadece kendi belgelerini yükleyebilir" ON storage.objects;       -- verification-documents kovası yok

-- 7.4-S3: boş taslak fonksiyon (canlıda zaten yok; repo ile eşitlemek için)
DROP FUNCTION IF EXISTS public.handle_delete_auth_user();
