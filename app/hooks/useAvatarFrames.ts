'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

type AvatarFrameSettingsRow = {
  user_id: string
  frame_id: string | null
}

type AvatarFrameCatalogRow = {
  id: string
  css_key: string
}

const DEBUG_AVATAR_USER_ID = 'bdb43d19-f1f2-45fd-a9ed-d51730deb427'

export function useAvatarFrames(userIds: Array<string | null | undefined>) {
  const userIdsKey = Array.from(new Set(userIds.filter((userId): userId is string => Boolean(userId)))).sort().join(',')
  const [framesByUserId, setFramesByUserId] = useState<Record<string, string>>({})

  const normalizedUserIds = useMemo(
    () => userIdsKey ? userIdsKey.split(',') : [],
    [userIdsKey]
  )

  useEffect(() => {
    let active = true

    const loadFrames = async () => {
      if (normalizedUserIds.length === 0) {
        setFramesByUserId({})
        return
      }

      const { data: settings, error: settingsError } = await supabase
        .from('user_cosmetic_settings')
        .select('user_id,frame_id')
        .in('user_id', normalizedUserIds)
        .not('frame_id', 'is', null)

      if (normalizedUserIds.includes(DEBUG_AVATAR_USER_ID)) {
        console.log('[AvatarFrames] settings', {
          normalizedUserIds,
          settings: (settings as AvatarFrameSettingsRow[] ?? []).filter((setting) => setting.user_id === DEBUG_AVATAR_USER_ID),
          settingsError,
        })
      }

      if (settingsError || !active) {
        if (active) setFramesByUserId({})
        return
      }

      const frameIds = Array.from(new Set((settings as AvatarFrameSettingsRow[] ?? []).flatMap((setting) => setting.frame_id ? [setting.frame_id] : [])))

      if (frameIds.length === 0) {
        setFramesByUserId({})
        return
      }

      const { data: catalog, error: catalogError } = await supabase
        .from('avatar_frame_catalog')
        .select('id,css_key')
        .in('id', frameIds)

      if (normalizedUserIds.includes(DEBUG_AVATAR_USER_ID)) {
        console.log('[AvatarFrames] catalog', {
          catalog: (catalog as AvatarFrameCatalogRow[] ?? []).filter((frame) => frame.id === 'gold-ring'),
          catalogError,
        })
      }

      if (catalogError || !active) {
        if (active) setFramesByUserId({})
        return
      }

      const cssKeyByFrameId = new Map((catalog as AvatarFrameCatalogRow[] ?? []).map((frame) => [frame.id, frame.css_key]))
      const nextFramesByUserId = Object.fromEntries(
        (settings as AvatarFrameSettingsRow[] ?? []).flatMap((setting) => {
          const cssKey = setting.frame_id ? cssKeyByFrameId.get(setting.frame_id) : null
          return cssKey ? [[setting.user_id, cssKey]] : []
        })
      )

      if (normalizedUserIds.includes(DEBUG_AVATAR_USER_ID)) {
        console.log('[AvatarFrames] nextFramesByUserId', {
          [DEBUG_AVATAR_USER_ID]: nextFramesByUserId[DEBUG_AVATAR_USER_ID],
        })
      }

      if (active) setFramesByUserId(nextFramesByUserId)
    }

    void loadFrames()

    return () => {
      active = false
    }
  }, [normalizedUserIds])

  return framesByUserId
}
