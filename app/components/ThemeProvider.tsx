'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const EquippedAvatarFrameContext = createContext<string | null>(null)

export const COSMETIC_FRAME_CHANGE_EVENT = 'cosmetic-frame-change'

export function useEquippedAvatarFrame() {
  return useContext(EquippedAvatarFrameContext)
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [equippedAvatarFrame, setEquippedAvatarFrame] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const applyCosmetics = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) {
        document.documentElement.dataset.theme = 'default'
        setEquippedAvatarFrame(null)
        return
      }

      const { data: settings } = await supabase
        .from('user_cosmetic_settings')
        .select('theme_id,frame_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!active) return

      document.documentElement.dataset.theme = settings?.theme_id || 'default'

      if (!settings?.frame_id) {
        setEquippedAvatarFrame(null)
        return
      }

      const { data: frame } = await supabase
        .from('avatar_frame_catalog')
        .select('css_key')
        .eq('id', settings.frame_id)
        .maybeSingle()

      if (active) setEquippedAvatarFrame(frame?.css_key || null)
    }

    void applyCosmetics()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => void applyCosmetics())
    window.addEventListener(COSMETIC_FRAME_CHANGE_EVENT, applyCosmetics)

    return () => {
      active = false
      subscription.unsubscribe()
      window.removeEventListener(COSMETIC_FRAME_CHANGE_EVENT, applyCosmetics)
    }
  }, [])

  return <EquippedAvatarFrameContext.Provider value={equippedAvatarFrame}>{children}</EquippedAvatarFrameContext.Provider>
}
