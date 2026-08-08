import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://zpjersmyvaqetjrsklhh.supabase.co'
const supabaseAnonKey = 'sb_publishable_Arw4cjKddBTv_1trAsekkA_co3h7vNN'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)