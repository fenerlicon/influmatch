-- Create function to log messages to Supabase PostgreSQL logs
-- This function will be called when a message is sent
-- Messages are already stored in the 'messages' table, this function only logs to PostgreSQL logs
-- which are visible in Supabase dashboard under Logs section
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
  -- This does NOT create a duplicate table, it only writes to PostgreSQL logs
  RAISE LOG 'MESSAGE_SENT: message_id=%, room_id=%, sender_id=%, receiver_id=%, content=%, created_at=%', 
    p_message_id, 
    p_room_id, 
    p_sender_id, 
    p_receiver_id, 
    LEFT(p_content, 200), 
    p_created_at;
END;
$$;

