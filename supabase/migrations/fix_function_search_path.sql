-- Fix Security Advisor warnings: Add search_path to functions
-- This migration fixes the "Function Search Path Mutable" warnings

-- Fix log_message function
CREATE OR REPLACE FUNCTION public.log_message(
  p_message_id uuid,
  p_room_id uuid,
  p_sender_id uuid,
  p_receiver_id uuid,
  p_content text,
  p_created_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Fix update_support_tickets_updated_at function
CREATE OR REPLACE FUNCTION public.update_support_tickets_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

