'use client'

import { useCallback, useState } from 'react'
import { useSession, useSessionContext } from '@supabase/auth-helpers-react'
import type { AuthResponse } from '@supabase/supabase-js'
import type { UserRole } from '@/types/auth'

interface SignUpPayload {
  email: string
  password: string
  fullName: string
  role: UserRole
}

interface SignInPayload {
  email: string
  password: string
}

export const useSupabaseAuth = () => {
  const session = useSession()
  const { supabaseClient, isLoading: isSessionLoading } = useSessionContext()
  const [authError, setAuthError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const translateAuthError = (errorMessage: string): string => {
    const errorLower = errorMessage.toLowerCase()
    
    // Login errors
    if (errorLower.includes('invalid login credentials') || errorLower.includes('invalid credentials')) {
      return 'Email veya şifre hatalı. Lütfen tekrar deneyin.'
    }
    if (errorLower.includes('email not confirmed')) {
      return 'Email adresiniz henüz doğrulanmamış. Lütfen email kutunuzu kontrol edin.'
    }
    if (errorLower.includes('user not found')) {
      return 'Bu email adresi ile kayıtlı bir hesap bulunamadı.'
    }
    
    // Signup errors
    if (errorLower.includes('user already registered')) {
      return 'Bu email adresi zaten kayıtlı. Giriş yapmayı deneyin.'
    }
    if (errorLower.includes('password')) {
      if (errorLower.includes('too short')) {
        return 'Şifre çok kısa. En az 6 karakter olmalıdır.'
      }
      if (errorLower.includes('weak')) {
        return 'Şifre çok zayıf. Daha güçlü bir şifre seçin.'
      }
    }
    
    // Network errors
    if (errorLower.includes('network') || errorLower.includes('fetch')) {
      return 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.'
    }
    
    // Default: return original message if no translation found
    return errorMessage
  }

  const handleResponse = useCallback((response: AuthResponse) => {
    if (response.error) {
      setAuthError(translateAuthError(response.error.message))
    } else {
      setAuthError(null)
    }
    return response
  }, [])

  const signUpWithEmail = useCallback(
    async ({ email, password, fullName, role }: SignUpPayload): Promise<AuthResponse> => {
      setIsSubmitting(true)
      try {
        const response = await supabaseClient.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              role,
              full_name: fullName,
            },
          },
        })
        return handleResponse(response)
      } finally {
        setIsSubmitting(false)
      }
    },
    [handleResponse, supabaseClient],
  )

  const signInWithEmail = useCallback(
    async ({ email, password }: SignInPayload): Promise<AuthResponse> => {
      setIsSubmitting(true)
      try {
        const response = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        })
        return handleResponse(response)
      } finally {
        setIsSubmitting(false)
      }
    },
    [handleResponse, supabaseClient],
  )

  const signOut = useCallback(async () => {
    setAuthError(null)
    await supabaseClient.auth.signOut()
  }, [supabaseClient])

  return {
    session,
    supabaseClient,
    authError,
    isSubmitting,
    isSessionLoading,
    signUpWithEmail,
    signInWithEmail,
    signOut,
  }
}

