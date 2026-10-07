-- Delete all users except:
-- 1. Admin accounts (role = 'admin')
-- 2. Specific influencers by username (update the usernames below)
-- 
-- WARNING: This will permanently delete all other user accounts!
-- Make sure to backup your data before running this!

-- Update these usernames to match the 4 influencers you want to keep
-- Remove the @ symbol if present in the username
WITH keep_users AS (
  SELECT id FROM public.users
  WHERE 
    role = 'admin'
    OR username IN (
      'larasoydan',      -- Update this
      'mehmetdemir',     -- Update this
      'zeynepkaya',      -- Update this
      'canozkan'         -- Update this
    )
)

-- First, see what will be deleted (for verification)
SELECT 
  id,
  email,
  full_name,
  username,
  role,
  spotlight_active,
  verification_status
FROM public.users
WHERE id NOT IN (SELECT id FROM keep_users)
ORDER BY created_at DESC;

-- Uncomment the DELETE statement below after verifying the SELECT results above
-- DELETE FROM public.users
-- WHERE id NOT IN (SELECT id FROM keep_users);

-- Note: This will also cascade delete related data in:
-- - offers table
-- - advert_projects table
-- - messages table
-- - user_blocks table
-- - dismissed_offers table
-- - user_badges table (if exists)
-- - And other tables with foreign key constraints

