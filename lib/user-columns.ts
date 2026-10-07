// users tablosunda sadece sahibine ve admine açık kolonlar.
// Bu kolonlar anon/authenticated rollerinden kolon bazında gizlenir
// (bkz. supabase/migrations/20260930000000_hide_private_user_columns.sql).
// İstemci kodu bu kolonları users tablosundan doğrudan okumamalı:
// - kendi bilgileri için: get_my_private_profile() RPC
// - admin ekranları için: sunucuda service role
export const PRIVATE_USER_COLUMNS = ['email', 'phone', 'tax_id', 'tax_office', 'tax_office_city', 'admin_notes', 'corporate_email', 'corporate_email_verified_at'] as const

// Admin panelinin kullanıcı kartları için okuduğu kolonlar (sadece service role ile kullanılır).
export const ADMIN_USER_SELECT =
  'id, full_name, email, role, avatar_url, username, social_links, verification_status, admin_notes, created_at, bio, category, city, tax_id, company_legal_name, tax_office, tax_office_city, spotlight_active, spotlight_plan, spotlight_expires_at, displayed_badges, tax_id_verified, email_verified_at, blue_tick_override, corporate_email, corporate_email_verified_at'
