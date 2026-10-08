'use server'

import { createSupabaseServerClient } from '@/utils/supabase/server'
import { createSupportTicketAs, type CreateSupportTicketPayload, type CreateSupportTicketResult } from '@/lib/support'
import { revalidatePath } from 'next/cache'

export async function createSupportTicket(payload: CreateSupportTicketPayload): Promise<CreateSupportTicketResult> {
  try {
    const supabase = createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Oturum açmanız gerekiyor' }
    }

    // Doğrulama ve kayıt ortak kodda (lib/support.ts); mobil uç da aynısını kullanır.
    const result = await createSupportTicketAs(supabase, user.id, payload)
    if (!result.success) return result

    revalidatePath('/dashboard/influencer/settings')
    revalidatePath('/dashboard/brand/settings')

    return result
  } catch (error) {
    console.error('[createSupportTicket] exception:', error)
    return { success: false, error: 'Beklenmeyen bir hata oluştu' }
  }
}
