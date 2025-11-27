-- Delete all users except:
-- 1. Admin accounts (role = 'admin')
-- 2. Influencers with spotlight_active = true (the 4 featured influencers)
-- 
-- WARNING: This will permanently delete all other user accounts!
-- Make sure to backup your data before running this!

-- First, let's see what will be deleted (for verification)
SELECT 
  id,
  email,
  full_name,
  username,
  role,
  spotlight_active,
  verification_status
FROM public.users
WHERE 
  role != 'admin' 
  AND (role != 'influencer' OR spotlight_active != true)
ORDER BY created_at DESC;

-- Uncomment the DELETE statement below after verifying the SELECT results above
-- DELETE FROM public.users
-- WHERE 
--   role != 'admin' 
--   AND (role != 'influencer' OR spotlight_active != true);

-- Note: This will also cascade delete related data in:
-- - offers table
-- - advert_projects table
-- - messages table
-- - user_blocks table
-- - dismissed_offers table
-- - user_badges table (if exists)
-- - And other tables with foreign key constraints

