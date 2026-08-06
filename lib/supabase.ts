import { createClient } from '@supabase/supabase-js'

// .env.local を使わず直接URLとキーを指定して検証します
const supabaseUrl = 'https://zpjersmyvaqetjrsklhh.supabase.co'
const supabaseAnonKey = 'sb_publishable_Arw4cjKddBTv_1trAsekkA_co3h7vNN'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    storageKey: 'supabase.auth.token',
  },
})