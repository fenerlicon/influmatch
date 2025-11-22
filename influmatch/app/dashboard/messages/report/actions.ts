'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ReportMessagePayload {
  messageId: string
  reportedUserId: string
  roomId: string
  reason: 'harassment' | 'spam' | 'inappropriate' | 'illegal' | 'other'
  description?: string
}

export async function reportMessage(payload: ReportMessagePayload) {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Verify the message exists and belongs to the reported user
  const { data: message, error: messageError } = await supabase
    .from('messages')
    .select('id, sender_id, room_id')
    .eq('id', payload.messageId)
    .single()

  if (messageError || !message) {
    return { success: false, error: 'Message not found' }
  }

  if (message.sender_id !== payload.reportedUserId) {
    return { success: false, error: 'Invalid report' }
  }

  if (message.room_id !== payload.roomId) {
    return { success: false, error: 'Invalid room' }
  }

  // Check if user has already reported this message
  const { data: existingReport } = await supabase
    .from('message_reports')
    .select('id')
    .eq('message_id', payload.messageId)
    .eq('reporter_user_id', user.id)
    .maybeSingle()

  if (existingReport) {
    return { success: false, error: 'You have already reported this message' }
  }

  // Create the report
  const { error: reportError } = await supabase.from('message_reports').insert({
    message_id: payload.messageId,
    reporter_user_id: user.id,
    reported_user_id: payload.reportedUserId,
    room_id: payload.roomId,
    reason: payload.reason,
    description: payload.description || null,
  })

  if (reportError) {
    console.error('Report creation error:', reportError)
    return { success: false, error: 'Failed to create report' }
  }

  revalidatePath('/dashboard')
  return { success: true }
}

