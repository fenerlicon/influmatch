// users tablosunda e-posta, telefon, vergi no, vergi dairesi ve admin notları gizlidir;
// istemci bu kolonları okuyamaz, bu yüzden users tablosunda select('*') kullanılamaz.
// Kendi gizli bilgilerin için: supabase.rpc('get_my_private_profile')
export const OWN_PROFILE_COLUMNS =
    'id, role, full_name, username, avatar_url, bio, category, city, social_links, social_links_last_updated, ' +
    'spotlight_active, spotlight_plan, spotlight_expires_at, verification_status, displayed_badges, ' +
    'is_showcase_visible, company_legal_name, tax_id_verified, creator_type, created_at';

// Başka kullanıcıların kartlarında gösterilen kolonlar.
export const PUBLIC_CARD_COLUMNS = 'id, full_name, username, avatar_url, role, verification_status, displayed_badges';
