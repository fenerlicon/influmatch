import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// ⚠️ BURAYI DOLDURUN: Web projenizdeki .env.local dosyasından bu değerleri alıp yapıştırın.
const supabaseUrl = 'https://aiftdpagcnwqzzemtkwt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpZnRkcGFnY253cXp6ZW10a3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODc0ODgsImV4cCI6MjA3OTE2MzQ4OH0.wyBnuq01fGU2_PLowFeQKhWWyq3NlLbsbyyca0HijFE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})
