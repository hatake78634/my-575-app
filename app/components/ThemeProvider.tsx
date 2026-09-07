'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let active = true
    const applyTheme = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) { document.documentElement.dataset.theme = 'default'; return }
      const { data: settings } = await supabase.from('user_cosmetic_settings').select('theme_id').eq('user_id', user.id).maybeSingle()
      if (active) document.documentElement.dataset.theme = settings?.theme_id || 'default'
    }
    void applyTheme()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void applyTheme())
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return children
}
