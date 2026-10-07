-- Supabase performans denetimi: indekssiz yabancı anahtarlar (2026-10-07, canlıda uygulandı).
-- Kullanıcı/ilan bazlı sorguları ve ON DELETE CASCADE silmelerini hızlandırır. Tablolar küçük.
CREATE INDEX IF NOT EXISTS idx_advert_applications_influencer_id ON public.advert_applications (influencer_id);
CREATE INDEX IF NOT EXISTS idx_advert_applications_influencer_user_id ON public.advert_applications (influencer_user_id);
CREATE INDEX IF NOT EXISTS idx_advert_applications_project_id ON public.advert_applications (project_id);
CREATE INDEX IF NOT EXISTS idx_advert_projects_brand_id ON public.advert_projects (brand_id);
CREATE INDEX IF NOT EXISTS idx_advert_projects_brand_user_id ON public.advert_projects (brand_user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_actor_id ON public.analytics_events (actor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_brand_id ON public.analytics_events (brand_id);
CREATE INDEX IF NOT EXISTS idx_favorite_list_items_influencer_id ON public.favorite_list_items (influencer_id);
CREATE INDEX IF NOT EXISTS idx_favorite_lists_brand_id ON public.favorite_lists (brand_id);
CREATE INDEX IF NOT EXISTS idx_favorites_influencer_id ON public.favorites (influencer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_list_id ON public.favorites (list_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reviewed_by ON public.message_reports (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_message_reports_room_id ON public.message_reports (room_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_offers_receiver_user_id ON public.offers (receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_offers_sender_user_id ON public.offers (sender_user_id);
CREATE INDEX IF NOT EXISTS idx_social_account_history_social_account_id ON public.social_account_history (social_account_id);
