'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AppShell, Button, ErrorState, LoadingState, Surface } from '../components/ui'
import { COSMETIC_FRAME_CHANGE_EVENT } from '../components/ThemeProvider'

type Item = { id: string; name: string; description: string; css_key: string; price: number; owned?: boolean }

export default function CustomizePage() {
  const { userId, loading: authLoading } = useAuth()
  const [themes, setThemes] = useState<Item[]>([])
  const [frames, setFrames] = useState<Item[]>([])
  const [equippedTheme, setEquippedTheme] = useState('default')
  const [equippedFrame, setEquippedFrame] = useState<string | null>(null)
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [errorText, setErrorText] = useState('')

  const load = useCallback(async (targetUserId: string) => {
    const [themeCatalog, frameCatalog, ownedThemes, ownedFrames, settings] = await Promise.all([
      supabase.from('theme_catalog').select('id,name,description,css_key,price').order('display_order'),
      supabase.from('avatar_frame_catalog').select('id,name,description,css_key,price').order('display_order'),
      supabase.from('user_themes').select('theme_id').eq('user_id', targetUserId),
      supabase.from('user_avatar_frames').select('frame_id').eq('user_id', targetUserId),
      supabase.from('user_cosmetic_settings').select('theme_id,frame_id').eq('user_id', targetUserId).maybeSingle(),
    ])
    const error = themeCatalog.error ?? frameCatalog.error ?? ownedThemes.error ?? ownedFrames.error ?? settings.error
    if (error) { console.error('着せ替え取得エラー:', error); setErrorText('着せ替え情報を取得できませんでした。'); setLoadedUserId(targetUserId); return }
    const themeIds = new Set((ownedThemes.data ?? []).map((row) => row.theme_id)); themeIds.add('default')
    const frameIds = new Set((ownedFrames.data ?? []).map((row) => row.frame_id))
    setThemes((themeCatalog.data ?? []).map((item) => ({ ...item, owned: themeIds.has(item.id) })))
    setFrames((frameCatalog.data ?? []).map((item) => ({ ...item, owned: frameIds.has(item.id) })))
    setEquippedTheme(settings.data?.theme_id || 'default'); setEquippedFrame(settings.data?.frame_id || null); setErrorText(''); setLoadedUserId(targetUserId)
  }, [])

  useEffect(() => { if (!authLoading && userId) void load(userId) }, [authLoading, load, userId])

  const equip = async (kind: 'theme' | 'frame', itemId: string | null) => {
    if (!userId) return
    const { error } = await supabase.rpc('equip_my_cosmetic', { p_kind: kind, p_item_id: itemId })
    if (error) { setErrorText(error.message); return }
    if (kind === 'theme') { setEquippedTheme(itemId || 'default'); document.documentElement.dataset.theme = itemId || 'default' }
    else {
      setEquippedFrame(itemId)
      window.dispatchEvent(new Event(COSMETIC_FRAME_CHANGE_EVENT))
    }
  }

  const loading = authLoading || (!!userId && loadedUserId !== userId)
  const section = (label: string, items: Item[], kind: 'theme' | 'frame') => <section><h2>{label}</h2><div style={{ display: 'grid', gap: 10 }}>{kind === 'frame' && <Button variant={!equippedFrame ? 'primary' : 'secondary'} onClick={() => equip('frame', null)} style={{ padding: 12 }}>フレームなし</Button>}{items.map((item) => {
    const equipped = kind === 'theme' ? equippedTheme === item.id : equippedFrame === item.id
    return <Surface key={item.id} style={{ padding: 16 }}><h3>{item.name}</h3><p className="ui-muted">{item.description}</p><Button variant={equipped ? 'primary' : 'secondary'} disabled={!item.owned} onClick={() => equip(kind, item.id)}>{equipped ? '装備中' : item.owned ? '装備する' : `未所持（${item.price}コイン）`}</Button></Surface>
  })}</div></section>

  return <AppShell><h1 style={{ color: 'var(--primary)' }}>着せ替え</h1>{loading ? <LoadingState /> : !userId ? <p>ログインすると着せ替えを利用できます。</p> : <>{errorText && <ErrorState>{errorText}</ErrorState>}{section('テーマ', themes, 'theme')}{section('アイコンフレーム', frames, 'frame')}</>}</AppShell>
}
