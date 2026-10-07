-- Delete all influencer accounts
-- Keep only admin accounts
-- 
-- WARNING: This will permanently delete all influencer accounts!
-- Make sure to backup your data before running this!

-- First, see what will be deleted (for verification)
SELECT 
  id,
  email,
  full_name,
  username,
  role,
  spotlight_active,
  verification_status,
  created_at
FROM public.users
WHERE role = 'influencer'
ORDER BY created_at DESC;

-- Check how many will be deleted
SELECT COUNT(*) as total_influencers_to_delete
FROM public.users
WHERE role = 'influencer';

-- Uncomment the DELETE statement below after verifying the SELECT results above
-- DELETE FROM public.users
-- WHERE role = 'influencer';

-- Note: This will also cascade delete related data in:
-- - offers table (where sender_user_id or receiver_user_id references deleted influencers)
-- - advert_projects table (where brand_user_id references deleted influencers)
-- - messages table (where sender_id or receiver_id references deleted influencers)
-- - user_blocks table (where blocker_user_id or blocked_user_id references deleted influencers)
-- - dismissed_offers table (where user_id or receiver_user_id references deleted influencers)
-- - user_badges table (if exists, where user_id references deleted influencers)
-- - And other tables with foreign key constraints

