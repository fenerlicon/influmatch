-- Create a security definer function to award badges
-- This allows server actions to insert badges without RLS issues

CREATE OR REPLACE FUNCTION public.award_user_badge(
  target_user_id uuid,
  badge_id_to_award text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if badge already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM public.user_badges 
    WHERE user_id = target_user_id 
    AND badge_id = badge_id_to_award
  ) THEN
    -- Insert the badge
    INSERT INTO public.user_badges (user_id, badge_id)
    VALUES (target_user_id, badge_id_to_award)
    ON CONFLICT (user_id, badge_id) DO NOTHING;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.award_user_badge(uuid, text) TO authenticated;

