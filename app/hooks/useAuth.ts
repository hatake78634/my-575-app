'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type AuthState = {
  userId: string | null
  userName: string | null
  userAvatar: string | null
  loading: boolean
}

export function useAuth(): AuthState {
  const [userId, setUserId] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const loadUser = async () => {
      if (!active) return

      setLoading(true)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const user = session?.user ?? null

      if (!active) return

      if (!user) {
        setUserId(null)
        setUserName(null)
        setUserAvatar(null)
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: profile, error } = await supabase
        .from('profiles_3')
        .select('username, avatar_url')
        .eq('id', user.id)
        .maybeSingle()

      if (!active) return

      if (error) {
        console.error('プロフィール取得エラー:', error)
      }

      setUserName(profile?.username ?? null)
      setUserAvatar(profile?.avatar_url ?? null)
      setLoading(false)
    }

    void loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadUser()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return {
    userId,
    userName,
    userAvatar,
    loading,
  }
}