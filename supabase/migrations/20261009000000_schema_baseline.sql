-- ==============================================================================
-- INFLUMATCH CANLI ŞEMA TEMELİ (baseline) — 2026-10-09
--
-- Canlı veritabanından (aiftdpagcnwqzzemtkwt) katalog sorgularıyla üretildi; 20261008000004 dahil tüm
-- değişiklikleri içerir. Boş bir Supabase projesinde bu dosya + sonraki zaman damgalı migration'lar
-- (20261009000001 ve sonrası) çalıştırılınca canlı ile aynı şema elde edilir. Ayrıntı: supabase/README.md.
--
-- Kapsam dışı (ayrı kurulur): Auth ayarları, Vault gizli değerleri ve pg_cron görevi
-- (supabase/cron/hourly_jobs.sql), storage dosyaları, veriler.
-- Tekrar çalıştırılabilir: IF NOT EXISTS / DROP ... IF EXISTS / duplicate_object korumalı.
-- Canlıdaki bilinen artıklar olduğu gibi korunmuştur (ör. kullanılmayan protect_user_critical_data,
-- restrict_users_sensitive_columns, log_message fonksiyonları); temizlik ayrı migration ile yapılır.
-- ==============================================================================

SET search_path = public, extensions;

-- ------------------------------------------------------------------------------
-- Eklentiler
-- ------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- Enum tipleri
-- ------------------------------------------------------------------------------

DO $enum$ BEGIN CREATE TYPE public.spotlight_plan_enum AS ENUM ('ibasic', 'mbasic', 'ipro', 'mpro'); EXCEPTION WHEN duplicate_object THEN NULL; END $enum$;

-- ------------------------------------------------------------------------------
-- Tablolar
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.advert_applications (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  project_id uuid,
  influencer_id uuid NOT NULL,
  message text,
  status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  influencer_user_id uuid NOT NULL,
  advert_id uuid NOT NULL,
  cover_letter text,
  deliverable_idea text,
  budget_expectation numeric(12,2)
);

CREATE TABLE IF NOT EXISTS public.advert_projects (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  brand_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  budget numeric,
  platform text,
  status text DEFAULT 'open'::text,
  created_at timestamp with time zone DEFAULT now(),
  summary text,
  category text,
  brand_name text,
  platforms text[] DEFAULT ARRAY[]::text[],
  deliverables text[] DEFAULT ARRAY[]::text[],
  budget_currency text DEFAULT 'TRY'::text,
  budget_min numeric(12,2),
  budget_max numeric(12,2),
  location text,
  hero_image text,
  deadline date,
  brand_user_id uuid,
  payment_type text DEFAULT 'cash'::text,
  custom_questions jsonb DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  event_type text NOT NULL,
  target_id uuid NOT NULL,
  actor_id uuid,
  brand_id uuid,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  provider text NOT NULL,
  label text NOT NULL,
  secret text NOT NULL,
  is_enabled boolean DEFAULT true NOT NULL,
  priority integer DEFAULT 100 NOT NULL,
  status text DEFAULT 'unknown'::text NOT NULL,
  status_message text,
  cooldown_until timestamp with time zone,
  credit_used_usd numeric(12,4),
  credit_limit_usd numeric(12,4),
  credit_resets_at timestamp with time zone,
  consecutive_failures integer DEFAULT 0 NOT NULL,
  success_count integer DEFAULT 0 NOT NULL,
  failure_count integer DEFAULT 0 NOT NULL,
  last_error text,
  last_used_at timestamp with time zone,
  last_success_at timestamp with time zone,
  last_failure_at timestamp with time zone,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.corporate_email_verifications (
  user_id uuid NOT NULL,
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts integer DEFAULT 0 NOT NULL,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  send_count integer DEFAULT 1 NOT NULL,
  send_window_started_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.dismissed_offers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  receiver_user_id uuid,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  offer_id uuid
);

CREATE TABLE IF NOT EXISTS public.favorite_list_items (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  list_id uuid NOT NULL,
  influencer_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.favorite_lists (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  brand_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  brand_id uuid NOT NULL,
  influencer_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  list_id uuid
);

CREATE TABLE IF NOT EXISTS public.feedback_submissions (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  description text NOT NULL,
  image_url text,
  status text DEFAULT 'pending'::text NOT NULL,
  admin_notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  message_id uuid NOT NULL,
  room_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  message_id uuid NOT NULL,
  reporter_user_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  message_snapshot text,
  message_removed_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  room_id uuid,
  sender_id uuid,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info'::text,
  is_read boolean DEFAULT false,
  link text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  sender_user_id uuid NOT NULL,
  receiver_user_id uuid NOT NULL,
  message text,
  budget numeric(12,2),
  campaign_type text,
  status text DEFAULT 'pending'::text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  campaign_name text
);

CREATE TABLE IF NOT EXISTS public.profile_views (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  profile_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  viewer_role text,
  viewed_on date DEFAULT ((now() AT TIME ZONE 'Europe/Istanbul'::text))::date NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  offer_id uuid,
  brand_id uuid,
  influencer_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  advert_application_id uuid
);

CREATE TABLE IF NOT EXISTS public.social_account_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  social_account_id uuid NOT NULL,
  follower_count bigint,
  engagement_rate numeric,
  avg_likes bigint,
  avg_comments bigint,
  avg_views bigint,
  recorded_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid,
  platform character varying(50) NOT NULL,
  username character varying(255) NOT NULL,
  platform_user_id character varying(100),
  verification_code character varying(50),
  is_verified boolean DEFAULT false,
  has_stats boolean DEFAULT false,
  follower_count bigint DEFAULT 0,
  engagement_rate numeric(5,2),
  last_scraped_at timestamp with time zone,
  stats_payload jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  scrape_lock_until timestamp with time zone,
  scrape_attempts integer DEFAULT 0 NOT NULL,
  scrape_window_started_at timestamp with time zone,
  scrape_fail_count integer DEFAULT 0 NOT NULL,
  scrape_retry_after timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  subject text NOT NULL,
  priority text DEFAULT 'Orta'::text NOT NULL,
  message text NOT NULL,
  file_url text,
  status text DEFAULT 'open'::text NOT NULL,
  admin_response text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.system_state (
  key text NOT NULL,
  value jsonb DEFAULT '{}'::jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tax_verifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_type text,
  status text DEFAULT 'processing'::text NOT NULL,
  submitted_tax_id text,
  submitted_legal_name text,
  submitted_tax_office text,
  submitted_city text,
  extracted jsonb,
  checks jsonb,
  reasons text[] DEFAULT '{}'::text[] NOT NULL,
  model text,
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id uuid NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_badges (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  user_id uuid NOT NULL,
  badge_id text NOT NULL,
  earned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  blocker_user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.users (
  id uuid DEFAULT uuid_generate_v4() NOT NULL,
  role text,
  email text NOT NULL,
  full_name text,
  username text,
  avatar_url text,
  bio text,
  category text,
  city text,
  social_links jsonb DEFAULT '{}'::jsonb,
  spotlight_active boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  website_url text,
  verification_status text DEFAULT 'pending'::text NOT NULL,
  admin_notes text,
  displayed_badges text[] DEFAULT ARRAY[]::text[],
  email_notifications jsonb DEFAULT '{"offers": true, "updates": true, "messages": true, "marketing": false, "advert_applications": true}'::jsonb,
  tax_id text,
  company_legal_name text,
  tax_id_verified boolean DEFAULT false,
  social_links_last_updated timestamp with time zone,
  is_showcase_visible boolean DEFAULT true,
  email_verified_at timestamp with time zone,
  spotlight_plan spotlight_plan_enum,
  spotlight_expires_at timestamp with time zone,
  push_token text,
  creator_type text DEFAULT 'influencer'::text,
  tax_office text,
  tax_office_city text,
  blue_tick_override text,
  corporate_email text,
  corporate_email_verified_at timestamp with time zone
);

-- ------------------------------------------------------------------------------
-- Birincil anahtar, tekil ve CHECK kısıtları
-- ------------------------------------------------------------------------------

DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_projects ADD CONSTRAINT advert_projects_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.corporate_email_verifications ADD CONSTRAINT corporate_email_verifications_pkey PRIMARY KEY (user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.dismissed_offers ADD CONSTRAINT dismissed_offers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorite_lists ADD CONSTRAINT favorite_lists_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT favorites_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.feedback_submissions ADD CONSTRAINT feedback_submissions_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.offers ADD CONSTRAINT offers_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.profile_views ADD CONSTRAINT profile_views_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.rooms ADD CONSTRAINT rooms_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.social_account_history ADD CONSTRAINT social_account_history_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.system_state ADD CONSTRAINT system_state_pkey PRIMARY KEY (key); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.tax_verifications ADD CONSTRAINT tax_verifications_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_activity ADD CONSTRAINT user_activity_pkey PRIMARY KEY (user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_advert_id_influencer_user_id_key UNIQUE (advert_id, influencer_user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_secret_key UNIQUE (provider, secret); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_list_id_influencer_id_key UNIQUE (list_id, influencer_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_message_id_key UNIQUE (message_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.profile_views ADD CONSTRAINT profile_views_once_per_day UNIQUE (profile_id, viewer_id, viewed_on); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_user_id_platform_key UNIQUE (user_id, platform); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_user_id_blocked_user_id_key UNIQUE (blocker_user_id, blocked_user_id); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'shortlisted'::text, 'accepted'::text, 'rejected'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_projects ADD CONSTRAINT advert_projects_status_check CHECK ((status = ANY (ARRAY['open'::text, 'paused'::text, 'closed'::text, 'archived'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_provider_check CHECK ((provider = ANY (ARRAY['apify'::text, 'gemini'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_status_check CHECK ((status = ANY (ARRAY['unknown'::text, 'active'::text, 'low_credit'::text, 'exhausted'::text, 'rate_limited'::text, 'invalid'::text, 'error'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.feedback_submissions ADD CONSTRAINT feedback_submissions_role_check CHECK ((role = ANY (ARRAY['influencer'::text, 'brand'::text, 'admin'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.feedback_submissions ADD CONSTRAINT feedback_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'archived'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_reason_check CHECK ((reason = ANY (ARRAY['harassment'::text, 'spam'::text, 'inappropriate'::text, 'illegal'::text, 'other'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'resolved'::text, 'dismissed'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['system'::text, 'info'::text, 'warning'::text, 'success'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.offers ADD CONSTRAINT offers_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_priority_check CHECK ((priority = ANY (ARRAY['Düşük'::text, 'Orta'::text, 'Acil'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text, 'in_progress'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_subject_check CHECK ((subject = ANY (ARRAY['Ödeme Sorunu'::text, 'Teknik Hata'::text, 'Şikayet/Bildirim'::text, 'Öneri'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.tax_verifications ADD CONSTRAINT tax_verifications_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'auto_approved'::text, 'needs_review'::text, 'approved'::text, 'rejected'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_check CHECK ((blocker_user_id <> blocked_user_id)); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT displayed_badges_max_length CHECK (((array_length(displayed_badges, 1) IS NULL) OR (array_length(displayed_badges, 1) <= 3))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_blue_tick_override_check CHECK (((blue_tick_override IS NULL) OR (blue_tick_override = ANY (ARRAY['granted'::text, 'revoked'::text])))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_creator_type_check CHECK ((creator_type = ANY (ARRAY['influencer'::text, 'ugc'::text, 'both'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['influencer'::text, 'brand'::text, 'admin'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_username_not_empty CHECK (((username IS NULL) OR (length(TRIM(BOTH FROM username)) > 0))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.users ADD CONSTRAINT users_verification_status_check CHECK ((verification_status = ANY (ARRAY['pending'::text, 'verified'::text, 'rejected'::text]))); EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;

-- ------------------------------------------------------------------------------
-- Fonksiyonlar
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.award_user_badge(target_user_id uuid, badge_id_to_award text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok.';
  END IF;

  INSERT INTO public.user_badges (user_id, badge_id)
  VALUES (target_user_id, badge_id_to_award)
  ON CONFLICT (user_id, badge_id) DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_advert_project_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF EXISTS (SELECT 1 FROM public.advert_applications WHERE advert_id = OLD.id AND status = 'accepted') THEN
        RAISE EXCEPTION 'Kabul edilmiş başvurusu olan bir ilanı silemezsiniz.';
    END IF;
    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_messaging_block()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_receiver_id uuid;
BEGIN
    SELECT CASE WHEN brand_id = NEW.sender_id THEN influencer_id ELSE brand_id END INTO v_receiver_id
    FROM public.rooms WHERE id = NEW.room_id;

    IF EXISTS (SELECT 1 FROM public.user_blocks WHERE blocker_user_id = v_receiver_id AND blocked_user_id = NEW.sender_id) THEN
        RAISE EXCEPTION 'Bu kullanıcıya mesaj gönderemezsiniz çünkü sizi engellemiş.';
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_private_profile()
 RETURNS TABLE(email text, phone text, tax_id text, tax_office text, tax_office_city text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT j ->> 'email', j ->> 'phone', j ->> 'tax_id', j ->> 'tax_office', j ->> 'tax_office_city'
  FROM (SELECT to_jsonb(u) AS j FROM public.users u WHERE u.id = auth.uid()) AS s;
$function$
;

CREATE OR REPLACE FUNCTION public.get_offer_contact_email(p_offer_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT u.email
  FROM public.offers o
  JOIN public.users u
    ON u.id = CASE
      WHEN o.receiver_user_id = auth.uid() THEN o.sender_user_id
      WHEN o.sender_user_id = auth.uid() THEN o.receiver_user_id
    END
  WHERE o.id = p_offer_id
    AND o.status = 'accepted';
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  safe_role text;
  v_status text;
  safe_creator_type text;
BEGIN
  safe_role := coalesce(new.raw_user_meta_data->>'role', 'influencer');
  IF safe_role NOT IN ('brand', 'influencer') THEN
    safe_role := 'influencer';
  END IF;

  safe_creator_type := coalesce(new.raw_user_meta_data->>'creator_type', 'influencer');
  IF safe_creator_type NOT IN ('influencer', 'ugc', 'both') THEN
    safe_creator_type := 'influencer';
  END IF;

  v_status := 'pending';

  INSERT INTO public.users (
    id, email, role, full_name, username, created_at, verification_status, spotlight_active, creator_type
  )
  VALUES (
    new.id, new.email, safe_role, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'username', timezone('utc', now()), v_status, false, safe_creator_type
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    username = COALESCE(EXCLUDED.username, public.users.username),
    creator_type = COALESCE(EXCLUDED.creator_type, public.users.creator_type);

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$function$
;

CREATE OR REPLACE FUNCTION public.is_valid_tax_number(p_value text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_value ~ '^[0-9]{10}$' THEN (
      SELECT (10 - (sum(
               CASE
                 WHEN x.t = 0 THEN 0
                 WHEN (x.t * power(2, 9 - x.i)::int) % 9 = 0 THEN 9
                 ELSE (x.t * power(2, 9 - x.i)::int) % 9
               END) % 10)) % 10 = ascii(substr(p_value, 10, 1)) - 48
      FROM (
        SELECT g AS i, (ascii(substr(p_value, g + 1, 1)) - 48 + 9 - g) % 10 AS t
        FROM generate_series(0, 8) AS g
      ) AS x
    )
    WHEN p_value ~ '^[1-9][0-9]{10}$' THEN (
      SELECT ((((d[1] + d[3] + d[5] + d[7] + d[9]) * 7 - (d[2] + d[4] + d[6] + d[8])) % 10 + 10) % 10 = d[10])
         AND ((d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7] + d[8] + d[9] + d[10]) % 10 = d[11])
      FROM (
        SELECT array_agg(ascii(substr(p_value, g, 1)) - 48 ORDER BY g) AS d
        FROM generate_series(1, 11) AS g
      ) AS y
    )
    ELSE false
  END
$function$
;

CREATE OR REPLACE FUNCTION public.log_message(p_message_id uuid, p_room_id uuid, p_sender_id uuid, p_receiver_id uuid, p_content text, p_created_at timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Log to PostgreSQL log (visible in Supabase dashboard > Logs)
  RAISE LOG 'MESSAGE_SENT: message_id=%, room_id=%, sender_id=%, receiver_id=%, content=%, created_at=%', 
    p_message_id, 
    p_room_id, 
    p_sender_id, 
    p_receiver_id, 
    LEFT(p_content, 200), 
    p_created_at;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_application_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (auth.jwt()->>'role' = 'authenticated') THEN
        IF NOT EXISTS (SELECT 1 FROM public.advert_projects ap WHERE ap.id = OLD.advert_id AND ap.brand_user_id = auth.uid()) 
           AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.status = OLD.status;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_social_account_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (auth.jwt()->>'role' = 'authenticated') THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.follower_count = OLD.follower_count;
            NEW.engagement_rate = OLD.engagement_rate;
            NEW.avg_likes = OLD.avg_likes;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.protect_user_critical_data()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF (auth.jwt()->>'role' = 'authenticated') THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.role = OLD.role;
            NEW.verification_status = OLD.verification_status;
            NEW.spotlight_active = OLD.spotlight_active;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.record_api_key_result(p_key_id uuid, p_success boolean, p_status text DEFAULT NULL::text, p_message text DEFAULT NULL::text, p_cooldown_until timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  UPDATE public.api_keys SET
    status = CASE
      WHEN p_success AND status = 'low_credit' THEN 'low_credit'
      WHEN p_success THEN 'active'
      ELSE coalesce(p_status, 'error')
    END,
    status_message = CASE
      WHEN p_success AND status = 'low_credit' THEN status_message
      WHEN p_success THEN NULL
      ELSE p_message
    END,
    cooldown_until = CASE WHEN p_success THEN NULL ELSE p_cooldown_until END,
    consecutive_failures = CASE WHEN p_success THEN 0 ELSE consecutive_failures + 1 END,
    success_count = success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failure_count = failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    last_error = CASE WHEN p_success THEN last_error ELSE p_message END,
    last_used_at = now(),
    last_success_at = CASE WHEN p_success THEN now() ELSE last_success_at END,
    last_failure_at = CASE WHEN p_success THEN last_failure_at ELSE now() END,
    updated_at = now()
  WHERE id = p_key_id;
$function$
;

CREATE OR REPLACE FUNCTION public.record_profile_view(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR p_profile_id IS NULL OR auth.uid() = p_profile_id THEN
    RETURN;
  END IF;

  -- Yalnızca influencer/UGC profilleri sayılır; görüntüleyenin rolü kayda yazılır.
  INSERT INTO public.profile_views (profile_id, viewer_id, viewer_role)
  SELECT p_profile_id, viewer.id, viewer.role
  FROM public.users viewer
  WHERE viewer.id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users target WHERE target.id = p_profile_id AND target.role = 'influencer')
  ON CONFLICT ON CONSTRAINT profile_views_once_per_day DO NOTHING;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_message_reports_insert_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.status = 'pending';
            NEW.reviewed_by = NULL;
            NEW.reviewed_at = NULL;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_message_reports_update_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.status = OLD.status;
            NEW.reviewed_by = OLD.reviewed_by;
            NEW.reviewed_at = OLD.reviewed_at;
            NEW.reason = OLD.reason;
            NEW.description = OLD.description;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_messages_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Adminler hariç hiç kimse kendi mesajını silemez.
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Gönderilmiş mesajlar platform üzerinden silinemez.';
        END IF;
    END IF;
    RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_messages_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Admin değilse müdahale edemez
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            -- UPDATE Engelleyici (İçerik, gönderen ve oda bilgisi korunur)
            IF TG_OP = 'UPDATE' THEN
                NEW.content = OLD.content;
                NEW.sender_id = OLD.sender_id;
                NEW.room_id = OLD.room_id;
            END IF;
            
            -- DELETE Engelleyici (Kanıt silinemez)
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Gönderilmiş mesajlar adli kayıt sebebiyle sistemden silinemez.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_messages_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Adminler hariç hiç kimse kendi mesajını değiştiremez.
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            RAISE EXCEPTION 'Güvenlik İhlali: Gönderilmiş mesajlar değiştirilemez veya sonradan güncellenemez.';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_offers_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF auth.uid() = OLD.sender_user_id THEN
            NEW.status = OLD.status; 
        END IF;

        IF auth.uid() = OLD.receiver_user_id THEN
            NEW.budget = OLD.budget;
            NEW.message = OLD.message;
            NEW.campaign_name = OLD.campaign_name;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_rooms_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Adminler (Destek sistemi veya Hoşgeldin botları) bu kuraldan muaftır
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            
            -- KURAL 1: Ortada bir anlaşma yoksa (NULL ise) ODA AÇAMAZSIN.
            IF NEW.offer_id IS NULL AND NEW.advert_application_id IS NULL THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Piyasada bir anlaşma yokken doğrudan bir kullanıcıya özel mesaj başlatılamaz!';
            END IF;
            
            -- KURAL 2: Sahte Teklif ID ile başkasının özel odasını/teklifini çalamazsın.
            IF NEW.offer_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.offers 
                    WHERE id = NEW.offer_id 
                    AND sender_user_id IN (NEW.brand_id, NEW.influencer_id) 
                    AND receiver_user_id IN (NEW.brand_id, NEW.influencer_id)
                ) THEN
                    RAISE EXCEPTION 'Güvenlik İhlali: Belirtilen teklif numarası ile sizin aranızda bir bağ yok!';
                END IF;
            END IF;

            -- KURAL 3: Başkasının İlan Başvurusu ile marka-influencer mesajlaşmasına sızamazsın.
            IF NEW.advert_application_id IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1 FROM public.advert_applications aa
                    JOIN public.advert_projects ap ON aa.advert_id = ap.id
                    WHERE aa.id = NEW.advert_application_id
                    AND aa.influencer_user_id = NEW.influencer_id
                    AND ap.brand_user_id = NEW.brand_id
                ) THEN
                    RAISE EXCEPTION 'Güvenlik İhlali: İlgili ilanın başvuru detayları taraflarla uyuşmuyor!';
                END IF;
            END IF;
            
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_social_accounts_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.is_verified = OLD.is_verified;
            NEW.follower_count = OLD.follower_count;
            NEW.following_count = OLD.following_count;
            NEW.engagement_rate = OLD.engagement_rate;
            NEW.has_stats = OLD.has_stats;
            NEW.stats_payload = OLD.stats_payload;
            NEW.verified_at = OLD.verified_at;
            NEW.platform_user_id = OLD.platform_user_id; 
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_social_accounts_insert_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.is_verified = false;
            NEW.follower_count = 0;
            NEW.engagement_rate = 0;
            NEW.has_stats = false;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_support_tickets_insert_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
            NEW.admin_response = NULL; 
            NEW.status = 'open';       
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.restrict_users_sensitive_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        NEW.role = OLD.role;
        NEW.spotlight_active = OLD.spotlight_active;
        
        -- EĞER MARKA İSE VE ONAYLIYSA; VERGİ NO VEYA FİRMA ADI DEĞİŞİRSE ONAYI DÜŞÜR!
        IF OLD.role = 'brand' AND OLD.verification_status = 'verified' AND (NEW.tax_id IS DISTINCT FROM OLD.tax_id OR NEW.company_legal_name IS DISTINCT FROM OLD.company_legal_name) THEN
            NEW.verification_status = 'pending';
        ELSE
            NEW.verification_status = OLD.verification_status;
        END IF;

        -- SAHTE ROZET ENGELLENMESİ: Kullanıcı kendine ait olmayan bir rozeti sergileyemez!
        IF NEW.displayed_badges IS DISTINCT FROM OLD.displayed_badges AND ARRAY_LENGTH(NEW.displayed_badges, 1) > 0 THEN
            IF (
                SELECT COUNT(*) 
                FROM unnest(NEW.displayed_badges) AS b 
                WHERE b IN (SELECT badge_id FROM public.user_badges WHERE user_id = NEW.id)
            ) <> ARRAY_LENGTH(NEW.displayed_badges, 1) THEN
                RAISE EXCEPTION 'Güvenlik İhlali: Sahip olmadığınız bir rozeti profilinizde sergileyemezsiniz!';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.secure_offers_final()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF auth.role() = 'authenticated' THEN
        -- Teklif kesinleştiyse (Accepted/Rejected) bütçe ve içerik ASLA değişemez!
        IF OLD.status IN ('accepted', 'rejected') THEN
             NEW.budget = OLD.budget;
             NEW.message = OLD.message;
             NEW.campaign_name = OLD.campaign_name;
             NEW.status = OLD.status; 
             RETURN NEW;
        END IF;

        -- Diğer Durumlarda Yetki Kontrolleri
        IF auth.uid() = OLD.sender_user_id THEN NEW.status = OLD.status; END IF;
        IF auth.uid() = OLD.receiver_user_id THEN 
            NEW.budget = OLD.budget; NEW.message = OLD.message;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_email_verification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.users
  SET email_verified_at = NEW.email_confirmed_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.touch_last_seen()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Oturum yoksa ya da profil satırı yoksa hiçbir şey yazılmaz. Sık çağrılsa da en fazla 45 saniyede bir yazılır.
  INSERT INTO public.user_activity (user_id, last_seen_at)
  SELECT u.id, now() FROM public.users u WHERE u.id = auth.uid()
  ON CONFLICT (user_id) DO UPDATE
    SET last_seen_at = EXCLUDED.last_seen_at
    WHERE public.user_activity.last_seen_at < now() - interval '45 seconds';
END;
$function$
;

CREATE OR REPLACE FUNCTION public.track_analytics_event(p_event_type text, p_target_id uuid, p_brand_id uuid, p_meta jsonb DEFAULT '{}'::jsonb, OUT event_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Erişim Engellendi: oturum gerekli.';
  END IF;

  -- İlan görüntülemesinde brand_id ilanın gerçek sahibi olmalı; diğer olaylarda gerçek bir marka olmalı.
  IF NOT (CASE
            WHEN p_event_type = 'view_advert' THEN
              EXISTS (SELECT 1 FROM public.advert_projects WHERE id = p_target_id AND brand_user_id = p_brand_id)
            ELSE
              EXISTS (SELECT 1 FROM public.users WHERE id = p_brand_id AND role = 'brand')
          END) THEN
    RAISE EXCEPTION 'Erişim Engellendi: Geçersiz analiz verisi.';
  END IF;

  INSERT INTO public.analytics_events (event_type, target_id, actor_id, brand_id, meta)
  VALUES (p_event_type, p_target_id, auth.uid(), p_brand_id, coalesce(p_meta, '{}'::jsonb))
  RETURNING id INTO event_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_support_tickets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.users_before_insert_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' AND NOT public.is_admin() THEN
    IF NEW.role IS NULL OR NEW.role NOT IN ('influencer', 'brand') THEN
      NEW.role := 'influencer';
    END IF;

    -- jsonb_populate_record tabloda olmayan anahtarları yok sayar;
    -- böylece canlı şemada eksik kolon olsa bile trigger patlamaz.
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'email', auth.email(),
      'verification_status', 'pending',
      'spotlight_active', false,
      'spotlight_plan', NULL,
      'spotlight_expires_at', NULL,
      'tax_id_verified', false,
      'phone_verified', false,
      'email_verified_at', NULL,
      'admin_notes', NULL,
      'is_verified', false,
      'displayed_badges', '{}'::text[],
      'blue_tick_override', NULL,
      'corporate_email', NULL,
      'corporate_email_verified_at', NULL
    ));

    IF NEW.tax_id IS NOT NULL AND NOT public.is_valid_tax_number(NEW.tax_id) THEN
      RAISE EXCEPTION 'Geçersiz vergi numarası. Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girmelidir.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.users_before_update_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(auth.role(), '') <> 'authenticated' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Beyaz liste: satırın eski hali alınır, üzerine sadece izin verilen kolonların yeni değerleri yazılır.
  -- Not: Supabase SQL Editor ile uyum için fonksiyonda yerel değişken tanımlanmıyor.
  NEW := jsonb_populate_record(NEW, to_jsonb(OLD) || (
    SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each(to_jsonb(NEW)) AS e
    WHERE e.key = ANY (ARRAY[
      'full_name', 'username', 'avatar_url', 'bio', 'category', 'city',
      'social_links', 'social_links_last_updated', 'displayed_badges',
      'tax_id', 'tax_office', 'tax_office_city', 'company_legal_name',
      'creator_type', 'is_showcase_visible', 'email_notifications', 'push_token'
    ])
  ));

  -- Vergi numarası sadece geçerli bir numaraya değiştirilebilir.
  IF NEW.tax_id IS DISTINCT FROM OLD.tax_id
     AND NEW.tax_id IS NOT NULL
     AND NOT public.is_valid_tax_number(NEW.tax_id) THEN
    RAISE EXCEPTION 'Geçersiz vergi numarası. Şirketler 10 haneli vergi numarasını, şahıs şirketleri 11 haneli T.C. kimlik numarasını girmelidir.';
  END IF;

  -- Onaylı marka (hesap onayı veya vergi numarası onayı) yasal bilgilerini değiştirirse
  -- onay düşer ve Resmi İşletme rozeti hem rozetlerden hem vitrinden kaldırılır.
  IF OLD.role = 'brand'
     AND (OLD.verification_status = 'verified' OR OLD.tax_id_verified IS TRUE)
     AND (
          NEW.tax_id IS DISTINCT FROM OLD.tax_id
       OR NEW.company_legal_name IS DISTINCT FROM OLD.company_legal_name
       OR NEW.tax_office IS DISTINCT FROM OLD.tax_office
       OR NEW.tax_office_city IS DISTINCT FROM OLD.tax_office_city
     ) THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'verification_status', CASE WHEN OLD.verification_status = 'verified' THEN 'pending' ELSE OLD.verification_status END,
      'tax_id_verified', false,
      'displayed_badges', array_remove(coalesce(NEW.displayed_badges, '{}'::text[]), 'official-business')
    ));
    DELETE FROM public.user_badges WHERE user_id = NEW.id AND badge_id = 'official-business';
  END IF;

  -- Marka web sitesini değiştirirse kurumsal e-postanın alan adı kontrolü geçersiz kalır:
  -- kurumsal e-posta doğrulaması ve Resmi İşletme rozeti düşer.
  IF OLD.role = 'brand'
     AND public.website_host(NEW.social_links ->> 'website') IS DISTINCT FROM public.website_host(OLD.social_links ->> 'website') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'corporate_email_verified_at', NULL,
      'displayed_badges', array_remove(coalesce(NEW.displayed_badges, '{}'::text[]), 'official-business')
    ));
    DELETE FROM public.user_badges WHERE user_id = NEW.id AND badge_id = 'official-business';
  END IF;

  -- Kullanıcı sahip olmadığı rozeti vitrinde gösteremez.
  IF NEW.displayed_badges IS DISTINCT FROM OLD.displayed_badges
     AND coalesce(array_length(NEW.displayed_badges, 1), 0) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(NEW.displayed_badges) AS b
      WHERE b NOT IN (SELECT badge_id FROM public.user_badges WHERE user_id = NEW.id)
    ) THEN
      RAISE EXCEPTION 'Sahip olmadığınız bir rozeti profilinizde sergileyemezsiniz.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.website_host(p_url text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT nullif(
    split_part(split_part(split_part(split_part(
      regexp_replace(regexp_replace(lower(trim(coalesce(p_url, ''))), '^[a-z]+://', ''), '^www[.]', ''),
    '/', 1), chr(63), 1), '#', 1), ':', 1),
  '')
$function$
;

-- ------------------------------------------------------------------------------
-- Yabancı anahtarlar
-- ------------------------------------------------------------------------------

DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_advert_id_fkey FOREIGN KEY (advert_id) REFERENCES advert_projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_influencer_user_id_fkey FOREIGN KEY (influencer_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_applications ADD CONSTRAINT advert_applications_project_id_fkey FOREIGN KEY (project_id) REFERENCES advert_projects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_projects ADD CONSTRAINT advert_projects_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.advert_projects ADD CONSTRAINT advert_projects_brand_user_id_fkey FOREIGN KEY (brand_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.analytics_events ADD CONSTRAINT analytics_events_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.corporate_email_verifications ADD CONSTRAINT corporate_email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.dismissed_offers ADD CONSTRAINT dismissed_offers_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.dismissed_offers ADD CONSTRAINT dismissed_offers_receiver_user_id_fkey FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.dismissed_offers ADD CONSTRAINT dismissed_offers_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorite_list_items ADD CONSTRAINT favorite_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES favorite_lists(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorite_lists ADD CONSTRAINT favorite_lists_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT favorites_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT favorites_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.favorites ADD CONSTRAINT favorites_list_id_fkey FOREIGN KEY (list_id) REFERENCES favorite_lists(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.feedback_submissions ADD CONSTRAINT feedback_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_logs ADD CONSTRAINT message_logs_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_reporter_user_id_fkey FOREIGN KEY (reporter_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.message_reports ADD CONSTRAINT message_reports_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.messages ADD CONSTRAINT messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.messages ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.offers ADD CONSTRAINT offers_receiver_user_id_fkey FOREIGN KEY (receiver_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.offers ADD CONSTRAINT offers_sender_user_id_fkey FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.profile_views ADD CONSTRAINT profile_views_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.profile_views ADD CONSTRAINT profile_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.rooms ADD CONSTRAINT rooms_advert_application_id_fkey FOREIGN KEY (advert_application_id) REFERENCES advert_applications(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.rooms ADD CONSTRAINT rooms_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.rooms ADD CONSTRAINT rooms_influencer_id_fkey FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.rooms ADD CONSTRAINT rooms_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.social_account_history ADD CONSTRAINT social_account_history_social_account_id_fkey FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.social_accounts ADD CONSTRAINT social_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.tax_verifications ADD CONSTRAINT tax_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_activity ADD CONSTRAINT user_activity_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocked_user_id_fkey FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;
DO $c$ BEGIN ALTER TABLE public.user_blocks ADD CONSTRAINT user_blocks_blocker_user_id_fkey FOREIGN KEY (blocker_user_id) REFERENCES users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL; END $c$;

-- ------------------------------------------------------------------------------
-- İndeksler
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_advert_applications_influencer_id ON public.advert_applications USING btree (influencer_id);
CREATE INDEX IF NOT EXISTS idx_advert_applications_influencer_user_id ON public.advert_applications USING btree (influencer_user_id);
CREATE INDEX IF NOT EXISTS idx_advert_applications_project_id ON public.advert_applications USING btree (project_id);
CREATE INDEX IF NOT EXISTS idx_advert_projects_brand_id ON public.advert_projects USING btree (brand_id);
CREATE INDEX IF NOT EXISTS idx_advert_projects_brand_user_id ON public.advert_projects USING btree (brand_user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_actor_id ON public.analytics_events USING btree (actor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_brand_id ON public.analytics_events USING btree (brand_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_provider_priority ON public.api_keys USING btree (provider, priority, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS dismissed_offers_user_offer_unique ON public.dismissed_offers USING btree (user_id, offer_id) WHERE (offer_id IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS dismissed_offers_user_receiver_unique ON public.dismissed_offers USING btree (user_id, receiver_user_id) WHERE (receiver_user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_dismissed_offers_offer_id ON public.dismissed_offers USING btree (offer_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_offers_receiver_user_id ON public.dismissed_offers USING btree (receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_offers_user_id ON public.dismissed_offers USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_favorite_list_items_influencer_id ON public.favorite_list_items USING btree (influencer_id);
CREATE INDEX IF NOT EXISTS idx_favorite_lists_brand_id ON public.favorite_lists USING btree (brand_id);
CREATE UNIQUE INDEX IF NOT EXISTS favorites_brand_influencer_unique ON public.favorites USING btree (brand_id, influencer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_influencer_id ON public.favorites USING btree (influencer_id);
CREATE INDEX IF NOT EXISTS idx_favorites_list_id ON public.favorites USING btree (list_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at ON public.feedback_submissions USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_status ON public.feedback_submissions USING btree (status);
CREATE INDEX IF NOT EXISTS idx_feedback_submissions_user_id ON public.feedback_submissions USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON public.message_logs USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_logs_message_id ON public.message_logs USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_receiver_id ON public.message_logs USING btree (receiver_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_room_id ON public.message_logs USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_sender_id ON public.message_logs USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_created_at ON public.message_reports USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reports_message_id ON public.message_reports USING btree (message_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reported_user_id ON public.message_reports USING btree (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reporter_user_id ON public.message_reports USING btree (reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_reviewed_by ON public.message_reports USING btree (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_message_reports_room_id ON public.message_reports USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_message_reports_status ON public.message_reports USING btree (status);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages USING btree (created_at);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages USING btree (room_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages USING btree (sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_offers_receiver_user_id ON public.offers USING btree (receiver_user_id);
CREATE INDEX IF NOT EXISTS idx_offers_sender_user_id ON public.offers USING btree (sender_user_id);
CREATE INDEX IF NOT EXISTS profile_views_profile_day_idx ON public.profile_views USING btree (profile_id, viewed_on);
CREATE INDEX IF NOT EXISTS profile_views_viewer_idx ON public.profile_views USING btree (viewer_id);
CREATE INDEX IF NOT EXISTS idx_rooms_advert_application_id ON public.rooms USING btree (advert_application_id);
CREATE INDEX IF NOT EXISTS idx_rooms_brand_id ON public.rooms USING btree (brand_id);
CREATE INDEX IF NOT EXISTS idx_rooms_influencer_id ON public.rooms USING btree (influencer_id);
CREATE INDEX IF NOT EXISTS idx_rooms_offer_id ON public.rooms USING btree (offer_id);
CREATE INDEX IF NOT EXISTS idx_social_account_history_social_account_id ON public.social_account_history USING btree (social_account_id);
CREATE INDEX IF NOT EXISTS idx_has_stats ON public.social_accounts USING btree (has_stats);
CREATE INDEX IF NOT EXISTS idx_social_platform_user ON public.social_accounts USING btree (platform, platform_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON public.support_tickets USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets USING btree (status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_tax_verifications_status ON public.tax_verifications USING btree (status) WHERE (status = 'needs_review'::text);
CREATE INDEX IF NOT EXISTS idx_tax_verifications_user ON public.tax_verifications USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_activity_last_seen_idx ON public.user_activity USING btree (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges USING btree (badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON public.user_blocks USING btree (blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_user_id ON public.user_blocks USING btree (blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_users_company_legal_name ON public.users USING btree (company_legal_name) WHERE (company_legal_name IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_social_links_last_updated ON public.users USING btree (social_links_last_updated);
CREATE INDEX IF NOT EXISTS idx_users_tax_id ON public.users USING btree (tax_id) WHERE (tax_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_tax_id_verified ON public.users USING btree (tax_id_verified) WHERE (tax_id_verified = true);
CREATE INDEX IF NOT EXISTS idx_users_tax_office_city ON public.users USING btree (tax_office_city) WHERE (tax_office_city IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_users_verification_status ON public.users USING btree (verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON public.users USING btree (username) WHERE (username IS NOT NULL);

-- ------------------------------------------------------------------------------
-- Triggerlar (auth.users üzerindekiler dahil)
-- ------------------------------------------------------------------------------

DROP TRIGGER IF EXISTS tr_protect_application_status ON advert_applications;
CREATE TRIGGER tr_protect_application_status BEFORE UPDATE ON public.advert_applications FOR EACH ROW EXECUTE FUNCTION protect_application_status();
DROP TRIGGER IF EXISTS tr_check_advert_project_deletion ON advert_projects;
CREATE TRIGGER tr_check_advert_project_deletion BEFORE DELETE ON public.advert_projects FOR EACH ROW EXECUTE FUNCTION check_advert_project_deletion();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
DROP TRIGGER IF EXISTS on_auth_user_email_verified ON auth.users;
CREATE TRIGGER on_auth_user_email_verified AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION sync_email_verification();
DROP TRIGGER IF EXISTS restrict_message_reports_insert_trigger ON message_reports;
CREATE TRIGGER restrict_message_reports_insert_trigger BEFORE INSERT ON public.message_reports FOR EACH ROW EXECUTE FUNCTION restrict_message_reports_insert_columns();
DROP TRIGGER IF EXISTS restrict_message_reports_update_trigger ON message_reports;
CREATE TRIGGER restrict_message_reports_update_trigger BEFORE UPDATE ON public.message_reports FOR EACH ROW EXECUTE FUNCTION restrict_message_reports_update_columns();
DROP TRIGGER IF EXISTS messages_integrity_trigger ON messages;
CREATE TRIGGER messages_integrity_trigger BEFORE DELETE OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION restrict_messages_integrity();
DROP TRIGGER IF EXISTS restrict_messages_delete_trigger ON messages;
CREATE TRIGGER restrict_messages_delete_trigger BEFORE DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION restrict_messages_delete();
DROP TRIGGER IF EXISTS restrict_messages_update_trigger ON messages;
CREATE TRIGGER restrict_messages_update_trigger BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION restrict_messages_update();
DROP TRIGGER IF EXISTS tr_check_messaging_block ON messages;
CREATE TRIGGER tr_check_messaging_block BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION check_messaging_block();
DROP TRIGGER IF EXISTS restrict_offers_trigger ON offers;
CREATE TRIGGER restrict_offers_trigger BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION restrict_offers_columns();
DROP TRIGGER IF EXISTS secure_offers_trigger ON offers;
CREATE TRIGGER secure_offers_trigger BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION secure_offers_final();
DROP TRIGGER IF EXISTS restrict_rooms_insert_trigger ON rooms;
CREATE TRIGGER restrict_rooms_insert_trigger BEFORE INSERT ON public.rooms FOR EACH ROW EXECUTE FUNCTION restrict_rooms_insert();
DROP TRIGGER IF EXISTS restrict_social_accounts_insert_trigger ON social_accounts;
CREATE TRIGGER restrict_social_accounts_insert_trigger BEFORE INSERT ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION restrict_social_accounts_insert_columns();
DROP TRIGGER IF EXISTS restrict_social_accounts_trigger ON social_accounts;
CREATE TRIGGER restrict_social_accounts_trigger BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION restrict_social_accounts_columns();
DROP TRIGGER IF EXISTS tr_protect_social_account_metrics ON social_accounts;
CREATE TRIGGER tr_protect_social_account_metrics BEFORE UPDATE ON public.social_accounts FOR EACH ROW EXECUTE FUNCTION protect_social_account_metrics();
DROP TRIGGER IF EXISTS restrict_support_tickets_insert_trigger ON support_tickets;
CREATE TRIGGER restrict_support_tickets_insert_trigger BEFORE INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION restrict_support_tickets_insert_columns();
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION update_support_tickets_updated_at();
DROP TRIGGER IF EXISTS tr_users_before_insert_guard ON users;
CREATE TRIGGER tr_users_before_insert_guard BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION users_before_insert_guard();
DROP TRIGGER IF EXISTS tr_users_before_update_guard ON users;
CREATE TRIGGER tr_users_before_update_guard BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION users_before_update_guard();

-- ------------------------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------------------------

ALTER TABLE public.advert_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advert_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dismissed_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_account_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Politikalar (public + storage)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Brands update applications to their adverts" ON public.advert_applications;
CREATE POLICY "Brands update applications to their adverts" ON public.advert_applications AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM advert_projects ap
  WHERE ((ap.id = advert_applications.advert_id) AND (ap.brand_user_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM advert_projects ap
  WHERE ((ap.id = advert_applications.advert_id) AND (ap.brand_user_id = ( SELECT auth.uid() AS uid))))));

DROP POLICY IF EXISTS "Brands view applications to their adverts" ON public.advert_applications;
CREATE POLICY "Brands view applications to their adverts" ON public.advert_applications AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM advert_projects ap
  WHERE ((ap.id = advert_applications.advert_id) AND (ap.brand_user_id = ( SELECT auth.uid() AS uid))))));

DROP POLICY IF EXISTS "Influencers can apply to adverts" ON public.advert_applications;
CREATE POLICY "Influencers can apply to adverts" ON public.advert_applications AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((COALESCE(influencer_user_id, influencer_id) = ( SELECT auth.uid() AS uid)) AND ((influencer_id IS NULL) OR (influencer_id = ( SELECT auth.uid() AS uid))) AND ((influencer_user_id IS NULL) OR (influencer_user_id = ( SELECT auth.uid() AS uid))) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'influencer'::text) AND (u.verification_status = 'verified'::text)))) AND (EXISTS ( SELECT 1
   FROM advert_projects ap
  WHERE ((ap.id = advert_applications.advert_id) AND (ap.status = 'open'::text) AND ((ap.deadline IS NULL) OR (ap.deadline >= ((now() AT TIME ZONE 'Europe/Istanbul'::text))::date)))))));

DROP POLICY IF EXISTS "Influencers can view their own applications" ON public.advert_applications;
CREATE POLICY "Influencers can view their own applications" ON public.advert_applications AS PERMISSIVE FOR SELECT TO public
  USING (((influencer_user_id = ( SELECT auth.uid() AS uid)) OR (influencer_id = ( SELECT auth.uid() AS uid))));

DROP POLICY IF EXISTS "Influencers delete their own applications" ON public.advert_applications;
CREATE POLICY "Influencers delete their own applications" ON public.advert_applications AS PERMISSIVE FOR DELETE TO authenticated
  USING ((((influencer_user_id = ( SELECT auth.uid() AS uid)) OR (influencer_id = ( SELECT auth.uid() AS uid))) AND (status <> ALL (ARRAY['accepted'::text, 'shortlisted'::text]))));

DROP POLICY IF EXISTS "Brands can delete their adverts" ON public.advert_projects;
CREATE POLICY "Brands can delete their adverts" ON public.advert_projects AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.uid() AS uid) = brand_user_id));

DROP POLICY IF EXISTS "Brands can insert adverts if verified" ON public.advert_projects;
CREATE POLICY "Brands can insert adverts if verified" ON public.advert_projects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.uid() AS uid) = brand_user_id) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'brand'::text) AND (u.verification_status = 'verified'::text))))));

DROP POLICY IF EXISTS "Brands can update their adverts if verified" ON public.advert_projects;
CREATE POLICY "Brands can update their adverts if verified" ON public.advert_projects AS PERMISSIVE FOR UPDATE TO public
  USING (((( SELECT auth.uid() AS uid) = brand_user_id) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'brand'::text) AND (u.verification_status = 'verified'::text))))))
  WITH CHECK (((( SELECT auth.uid() AS uid) = brand_user_id) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'brand'::text) AND (u.verification_status = 'verified'::text))))));

DROP POLICY IF EXISTS "Everyone can view open adverts or own drafts" ON public.advert_projects;
CREATE POLICY "Everyone can view open adverts or own drafts" ON public.advert_projects AS PERMISSIVE FOR SELECT TO public
  USING (((status = 'open'::text) OR (( SELECT auth.uid() AS uid) = brand_user_id)));

DROP POLICY IF EXISTS "Users can only view their own brand analytics" ON public.analytics_events;
CREATE POLICY "Users can only view their own brand analytics" ON public.analytics_events AS PERMISSIVE FOR SELECT TO public
  USING (((brand_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text))))));

DROP POLICY IF EXISTS "Users can delete their own dismissed offers" ON public.dismissed_offers;
CREATE POLICY "Users can delete their own dismissed offers" ON public.dismissed_offers AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users can insert their own dismissed offers" ON public.dismissed_offers;
CREATE POLICY "Users can insert their own dismissed offers" ON public.dismissed_offers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users can view their own dismissed offers" ON public.dismissed_offers;
CREATE POLICY "Users can view their own dismissed offers" ON public.dismissed_offers AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Brands can manage their list items" ON public.favorite_list_items;
CREATE POLICY "Brands can manage their list items" ON public.favorite_list_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM favorite_lists fl
  WHERE ((fl.id = favorite_list_items.list_id) AND (fl.brand_id = ( SELECT auth.uid() AS uid))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM favorite_lists fl
  WHERE ((fl.id = favorite_list_items.list_id) AND (fl.brand_id = ( SELECT auth.uid() AS uid))))));

DROP POLICY IF EXISTS "Brands can manage their own favorite lists" ON public.favorite_lists;
CREATE POLICY "Brands can manage their own favorite lists" ON public.favorite_lists AS PERMISSIVE FOR ALL TO public
  USING ((( SELECT auth.uid() AS uid) = brand_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = brand_id));

DROP POLICY IF EXISTS "Brands can remove their own favorites" ON public.favorites;
CREATE POLICY "Brands can remove their own favorites" ON public.favorites AS PERMISSIVE FOR DELETE TO public
  USING ((( SELECT auth.uid() AS uid) = brand_id));

DROP POLICY IF EXISTS "Brands can view their own favorites" ON public.favorites;
CREATE POLICY "Brands can view their own favorites" ON public.favorites AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = brand_id));

DROP POLICY IF EXISTS "Influencers can view favorites targeting them" ON public.favorites;
CREATE POLICY "Influencers can view favorites targeting them" ON public.favorites AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = influencer_id));

DROP POLICY IF EXISTS "Verified brands only can add favorites" ON public.favorites;
CREATE POLICY "Verified brands only can add favorites" ON public.favorites AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.uid() AS uid) = brand_id) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'brand'::text) AND (u.verification_status = 'verified'::text))))));

DROP POLICY IF EXISTS "Admins can update feedback" ON public.feedback_submissions;
CREATE POLICY "Admins can update feedback" ON public.feedback_submissions AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback_submissions;
CREATE POLICY "Admins can view all feedback" ON public.feedback_submissions AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can insert their own feedback" ON public.feedback_submissions;
CREATE POLICY "Users can insert their own feedback" ON public.feedback_submissions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback_submissions;
CREATE POLICY "Users can view their own feedback" ON public.feedback_submissions AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Admins can view message logs" ON public.message_logs;
CREATE POLICY "Admins can view message logs" ON public.message_logs AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admins can update reports" ON public.message_reports;
CREATE POLICY "Admins can update reports" ON public.message_reports AS PERMISSIVE FOR UPDATE TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Admins can view all reports" ON public.message_reports;
CREATE POLICY "Admins can view all reports" ON public.message_reports AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can report messages" ON public.message_reports;
CREATE POLICY "Users can report messages" ON public.message_reports AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = reporter_user_id));

DROP POLICY IF EXISTS "Users can view their own reports" ON public.message_reports;
CREATE POLICY "Users can view their own reports" ON public.message_reports AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = reporter_user_id));

DROP POLICY IF EXISTS "Users can send messages in their rooms" ON public.messages;
CREATE POLICY "Users can send messages in their rooms" ON public.messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.uid() AS uid) = sender_id) AND (EXISTS ( SELECT 1
   FROM rooms
  WHERE ((rooms.id = messages.room_id) AND ((rooms.brand_id = ( SELECT auth.uid() AS uid)) OR (rooms.influencer_id = ( SELECT auth.uid() AS uid))) AND (NOT (EXISTS ( SELECT 1
           FROM user_blocks
          WHERE (((rooms.brand_id = user_blocks.blocker_user_id) AND (( SELECT auth.uid() AS uid) = user_blocks.blocked_user_id)) OR ((rooms.influencer_id = user_blocks.blocker_user_id) AND (( SELECT auth.uid() AS uid) = user_blocks.blocked_user_id)))))) AND (NOT (EXISTS ( SELECT 1
           FROM user_blocks
          WHERE (((( SELECT auth.uid() AS uid) = user_blocks.blocker_user_id) AND (rooms.brand_id = user_blocks.blocked_user_id)) OR ((( SELECT auth.uid() AS uid) = user_blocks.blocker_user_id) AND (rooms.influencer_id = user_blocks.blocked_user_id)))))))))));

DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.messages;
CREATE POLICY "Users can view messages in their rooms" ON public.messages AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM rooms
  WHERE ((rooms.id = messages.room_id) AND ((rooms.brand_id = ( SELECT auth.uid() AS uid)) OR (rooms.influencer_id = ( SELECT auth.uid() AS uid)))))));

DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)" ON public.notifications;
CREATE POLICY "Users can update their own notifications (mark as read)" ON public.notifications AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Brands can update their sent offers" ON public.offers;
CREATE POLICY "Brands can update their sent offers" ON public.offers AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = sender_user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = sender_user_id));

DROP POLICY IF EXISTS "Brands can view their sent offers" ON public.offers;
CREATE POLICY "Brands can view their sent offers" ON public.offers AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = sender_user_id));

DROP POLICY IF EXISTS "Influencers can update offers addressed to them" ON public.offers;
CREATE POLICY "Influencers can update offers addressed to them" ON public.offers AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = receiver_user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = receiver_user_id));

DROP POLICY IF EXISTS "Influencers can view offers sent to them" ON public.offers;
CREATE POLICY "Influencers can view offers sent to them" ON public.offers AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = receiver_user_id));

DROP POLICY IF EXISTS "Verified brands only can insert offers" ON public.offers;
CREATE POLICY "Verified brands only can insert offers" ON public.offers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.uid() AS uid) = sender_user_id) AND (EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = 'brand'::text) AND (u.verification_status = 'verified'::text))))));

DROP POLICY IF EXISTS "Users can insert rooms they are part of" ON public.rooms;
CREATE POLICY "Users can insert rooms they are part of" ON public.rooms AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((( SELECT auth.uid() AS uid) = brand_id) OR (( SELECT auth.uid() AS uid) = influencer_id)));

DROP POLICY IF EXISTS "Users can view their rooms" ON public.rooms;
CREATE POLICY "Users can view their rooms" ON public.rooms AS PERMISSIVE FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = brand_id) OR (( SELECT auth.uid() AS uid) = influencer_id)));

DROP POLICY IF EXISTS "Admins can view all history" ON public.social_account_history;
CREATE POLICY "Admins can view all history" ON public.social_account_history AS PERMISSIVE FOR SELECT TO public
  USING ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'admin'::text)))));

DROP POLICY IF EXISTS "Users can view their own history" ON public.social_account_history;
CREATE POLICY "Users can view their own history" ON public.social_account_history AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) IN ( SELECT social_accounts.user_id
   FROM social_accounts
  WHERE (social_accounts.id = social_account_history.social_account_id))));

DROP POLICY IF EXISTS "Public can view verified social accounts" ON public.social_accounts;
CREATE POLICY "Public can view verified social accounts" ON public.social_accounts AS PERMISSIVE FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "Users can view their own social accounts" ON public.social_accounts;
CREATE POLICY "Users can view their own social accounts" ON public.social_accounts AS PERMISSIVE FOR SELECT TO public
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets" ON public.support_tickets AS PERMISSIVE FOR UPDATE TO authenticated
  USING (( SELECT is_admin() AS is_admin))
  WITH CHECK (( SELECT is_admin() AS is_admin));

DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all support tickets" ON public.support_tickets AS PERMISSIVE FOR SELECT TO authenticated
  USING (( SELECT is_admin() AS is_admin));

DROP POLICY IF EXISTS "Users can create their own support tickets" ON public.support_tickets;
CREATE POLICY "Users can create their own support tickets" ON public.support_tickets AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users can view their own support tickets" ON public.support_tickets;
CREATE POLICY "Users can view their own support tickets" ON public.support_tickets AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users read their own tax verifications" ON public.tax_verifications;
CREATE POLICY "Users read their own tax verifications" ON public.tax_verifications AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Admins can insert badges for any user" ON public.user_badges;
CREATE POLICY "Admins can insert badges for any user" ON public.user_badges AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (( SELECT is_admin() AS is_admin));

DROP POLICY IF EXISTS "User badges are viewable by everyone" ON public.user_badges;
CREATE POLICY "User badges are viewable by everyone" ON public.user_badges AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "User badges are viewable publicly" ON public.user_badges;
CREATE POLICY "User badges are viewable publicly" ON public.user_badges AS PERMISSIVE FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Users can delete their own badges" ON public.user_badges;
CREATE POLICY "Users can delete their own badges" ON public.user_badges AS PERMISSIVE FOR DELETE TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

DROP POLICY IF EXISTS "Users can block other users" ON public.user_blocks;
CREATE POLICY "Users can block other users" ON public.user_blocks AS PERMISSIVE FOR ALL TO public
  USING ((( SELECT auth.uid() AS uid) = blocker_user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = blocker_user_id));

DROP POLICY IF EXISTS "Users can view their own blocks" ON public.user_blocks;
CREATE POLICY "Users can view their own blocks" ON public.user_blocks AS PERMISSIVE FOR SELECT TO public
  USING (((( SELECT auth.uid() AS uid) = blocker_user_id) OR (( SELECT auth.uid() AS uid) = blocked_user_id)));

DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
CREATE POLICY "Admins can update any user" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING (( SELECT is_admin() AS is_admin))
  WITH CHECK (( SELECT is_admin() AS is_admin));

DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.users;
CREATE POLICY "Authenticated users can view profiles" ON public.users AS PERMISSIVE FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile" ON public.users AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((( SELECT auth.uid() AS uid) = id));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
CREATE POLICY "Users can update their own profile" ON public.users AS PERMISSIVE FOR UPDATE TO public
  USING ((( SELECT auth.uid() AS uid) = id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = id));

DROP POLICY IF EXISTS "Anyone can view chat attachments" ON storage.objects;
CREATE POLICY "Anyone can view chat attachments" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
  USING (((bucket_id = 'chat-attachments'::text) AND (EXISTS ( SELECT 1
   FROM rooms r
  WHERE (((r.id)::text = (storage.foldername(objects.name))[1]) AND ((r.brand_id = ( SELECT auth.uid() AS uid)) OR (r.influencer_id = ( SELECT auth.uid() AS uid))))))));

DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'chat-attachments'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM rooms r
  WHERE (((r.id)::text = (storage.foldername(objects.name))[1]) AND ((r.brand_id = ( SELECT auth.uid() AS uid)) OR (r.influencer_id = ( SELECT auth.uid() AS uid))))))));

DROP POLICY IF EXISTS "Authenticated users can upload feedback images" ON storage.objects;
CREATE POLICY "Authenticated users can upload feedback images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'feedback-images'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));

DROP POLICY IF EXISTS "Authenticated users can upload hero images" ON storage.objects;
CREATE POLICY "Authenticated users can upload hero images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'advert-hero-images'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));

DROP POLICY IF EXISTS "Brands upload their own tax documents" ON storage.objects;
CREATE POLICY "Brands upload their own tax documents" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (((bucket_id = 'tax-documents'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Everyone can read hero images" ON storage.objects;
CREATE POLICY "Everyone can read hero images" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'advert-hero-images'::text));

DROP POLICY IF EXISTS "Users can delete their own feedback images" ON storage.objects;
CREATE POLICY "Users can delete their own feedback images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'feedback-images'::text) AND (( SELECT auth.uid() AS uid) = owner)));

DROP POLICY IF EXISTS "Users can delete their own hero images" ON storage.objects;
CREATE POLICY "Users can delete their own hero images" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
  USING (((bucket_id = 'advert-hero-images'::text) AND (( SELECT auth.uid() AS uid) = owner)));

DROP POLICY IF EXISTS "Users can manage their own avatar" ON storage.objects;
CREATE POLICY "Users can manage their own avatar" ON storage.objects AS PERMISSIVE FOR ALL TO authenticated
  USING (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

DROP POLICY IF EXISTS "Users can update their own feedback images" ON storage.objects;
CREATE POLICY "Users can update their own feedback images" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'feedback-images'::text) AND (( SELECT auth.uid() AS uid) = owner)));

DROP POLICY IF EXISTS "Users can update their own hero images" ON storage.objects;
CREATE POLICY "Users can update their own hero images" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
  USING (((bucket_id = 'advert-hero-images'::text) AND (( SELECT auth.uid() AS uid) = owner)));

DROP POLICY IF EXISTS "avatars delete" ON storage.objects;
CREATE POLICY "avatars delete" ON storage.objects AS PERMISSIVE FOR DELETE TO public
  USING (((bucket_id = 'avatars'::text) AND (( SELECT auth.uid() AS uid) = owner)));

DROP POLICY IF EXISTS "avatars insert" ON storage.objects;
CREATE POLICY "avatars insert" ON storage.objects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((bucket_id = 'avatars'::text) AND (( SELECT auth.role() AS role) = 'authenticated'::text)));

DROP POLICY IF EXISTS "avatars select" ON storage.objects;
CREATE POLICY "avatars select" ON storage.objects AS PERMISSIVE FOR SELECT TO public
  USING ((bucket_id = 'avatars'::text));

DROP POLICY IF EXISTS "avatars update" ON storage.objects;
CREATE POLICY "avatars update" ON storage.objects AS PERMISSIVE FOR UPDATE TO public
  USING (((bucket_id = 'avatars'::text) AND (( SELECT auth.uid() AS uid) = owner)))
  WITH CHECK (((bucket_id = 'avatars'::text) AND (( SELECT auth.uid() AS uid) = owner)));

-- ------------------------------------------------------------------------------
-- Yetkiler (tablo, kolon, fonksiyon)
-- ------------------------------------------------------------------------------

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.advert_applications TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.advert_applications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.advert_projects TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.advert_projects TO authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE ON public.analytics_events TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.analytics_events TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.dismissed_offers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.dismissed_offers TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.favorite_list_items TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.favorite_list_items TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.favorite_lists TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.favorite_lists TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.favorites TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.favorites TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.feedback_submissions TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.feedback_submissions TO authenticated;
GRANT REFERENCES, TRIGGER, TRUNCATE ON public.message_logs TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.message_logs TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.message_reports TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.message_reports TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.messages TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.messages TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notifications TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.notifications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.offers TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.offers TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.rooms TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.rooms TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.social_account_history TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.social_account_history TO authenticated;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.social_accounts TO anon;
GRANT REFERENCES, SELECT, TRIGGER, TRUNCATE ON public.social_accounts TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.support_tickets TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.support_tickets TO authenticated;
GRANT SELECT ON public.tax_verifications TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_badges TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_badges TO authenticated;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_blocks TO anon;
GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON public.user_blocks TO authenticated;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.users TO anon;
GRANT DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE ON public.users TO authenticated;

GRANT SELECT (avatar_url, bio, category, city, company_legal_name, created_at, creator_type, displayed_badges, email_notifications, email_verified_at, full_name, id, is_showcase_visible, role, social_links, social_links_last_updated, spotlight_active, spotlight_expires_at, spotlight_plan, tax_id_verified, username, verification_status, website_url) ON public.users TO authenticated;

REVOKE ALL ON FUNCTION public.award_user_badge(target_user_id uuid, badge_id_to_award text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_user_badge(target_user_id uuid, badge_id_to_award text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_user_badge(target_user_id uuid, badge_id_to_award text) TO service_role;
REVOKE ALL ON FUNCTION public.check_advert_project_deletion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_advert_project_deletion() TO service_role;
REVOKE ALL ON FUNCTION public.check_messaging_block() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_messaging_block() TO service_role;
REVOKE ALL ON FUNCTION public.get_my_private_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_private_profile() TO service_role;
REVOKE ALL ON FUNCTION public.get_offer_contact_email(p_offer_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_offer_contact_email(p_offer_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offer_contact_email(p_offer_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
REVOKE ALL ON FUNCTION public.is_valid_tax_number(p_value text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_tax_number(p_value text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_valid_tax_number(p_value text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_tax_number(p_value text) TO service_role;
REVOKE ALL ON FUNCTION public.log_message(p_message_id uuid, p_room_id uuid, p_sender_id uuid, p_receiver_id uuid, p_content text, p_created_at timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_message(p_message_id uuid, p_room_id uuid, p_sender_id uuid, p_receiver_id uuid, p_content text, p_created_at timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.protect_application_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_application_status() TO service_role;
REVOKE ALL ON FUNCTION public.protect_social_account_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_social_account_metrics() TO service_role;
REVOKE ALL ON FUNCTION public.protect_user_critical_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.protect_user_critical_data() TO service_role;
REVOKE ALL ON FUNCTION public.record_api_key_result(p_key_id uuid, p_success boolean, p_status text, p_message text, p_cooldown_until timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_api_key_result(p_key_id uuid, p_success boolean, p_status text, p_message text, p_cooldown_until timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION public.record_profile_view(p_profile_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_profile_view(p_profile_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_profile_view(p_profile_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.restrict_message_reports_insert_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_message_reports_insert_columns() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_message_reports_update_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_message_reports_update_columns() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_messages_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_messages_delete() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_messages_integrity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_messages_integrity() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_messages_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_messages_update() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_offers_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_offers_columns() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_rooms_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_rooms_insert() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_social_accounts_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_social_accounts_columns() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_social_accounts_insert_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_social_accounts_insert_columns() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_support_tickets_insert_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_support_tickets_insert_columns() TO service_role;
REVOKE ALL ON FUNCTION public.restrict_users_sensitive_columns() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restrict_users_sensitive_columns() TO service_role;
REVOKE ALL ON FUNCTION public.secure_offers_final() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.secure_offers_final() TO service_role;
REVOKE ALL ON FUNCTION public.sync_email_verification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_email_verification() TO service_role;
REVOKE ALL ON FUNCTION public.touch_last_seen() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO service_role;
REVOKE ALL ON FUNCTION public.track_analytics_event(p_event_type text, p_target_id uuid, p_brand_id uuid, p_meta jsonb, OUT event_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_analytics_event(p_event_type text, p_target_id uuid, p_brand_id uuid, p_meta jsonb, OUT event_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_analytics_event(p_event_type text, p_target_id uuid, p_brand_id uuid, p_meta jsonb, OUT event_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.update_support_tickets_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_support_tickets_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION public.update_support_tickets_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_support_tickets_updated_at() TO service_role;
REVOKE ALL ON FUNCTION public.users_before_insert_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.users_before_insert_guard() TO service_role;
REVOKE ALL ON FUNCTION public.users_before_update_guard() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.users_before_update_guard() TO service_role;
REVOKE ALL ON FUNCTION public.website_host(p_url text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.website_host(p_url text) TO anon;
GRANT EXECUTE ON FUNCTION public.website_host(p_url text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.website_host(p_url text) TO service_role;

-- ------------------------------------------------------------------------------
-- Realtime yayını
-- ------------------------------------------------------------------------------

DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.advert_applications; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dismissed_offers; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.offers; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;
DO $p$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_badges; EXCEPTION WHEN duplicate_object THEN NULL; END $p$;

-- ------------------------------------------------------------------------------
-- Storage kovaları
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('advert-hero-images', 'advert-hero-images', true, 5242880, '{image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('avatars', 'avatars', true, 5242880, '{image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('chat-attachments', 'chat-attachments', false, 5242880, '{image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('feedback-images', 'feedback-images', false, 5242880, '{image/png,image/jpeg,image/jpg,image/webp,image/gif,image/heic,image/heif}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('tax-documents', 'tax-documents', false, 5242880, '{application/pdf,image/jpeg,image/png,image/webp}'::text[]) ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
