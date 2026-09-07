'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'

type TitleItem = {
  id: string
  name: string
  description: string
  owned: boolean
  equipped: boolean
}

type TitleLoadResult = {
  requestId: number
  userId: string
  status: 'success' | 'error'
  titles: TitleItem[]
  errorText: string
}

export default function TitlesPage() {
  const { userId, loading: authLoading } = useAuth()
  const [titles, setTitles] = useState<TitleItem[]>([])
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [errorText, setErrorText] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const loadTitles = useCallback(async (targetUserId: string): Promise<TitleLoadResult> => {
    const requestId = ++requestIdRef.current
    try {
      const { error: refreshError } = await supabase.rpc('refresh_my_titles')
      if (refreshError) throw refreshError

      const [{ data: catalog, error: catalogError }, { data: owned, error: ownedError }, { data: equipped, error: equippedError }] =
        await Promise.all([
          supabase.from('title_catalog').select('id, name, description').order('display_order'),
          supabase.from('user_titles').select('title_id').eq('user_id', targetUserId),
          supabase.from('user_equipped_titles').select('title_id').eq('user_id', targetUserId).maybeSingle(),
        ])
      if (catalogError || ownedError || equippedError) throw catalogError ?? ownedError ?? equippedError

      const ownedIds = new Set((owned ?? []).map((item) => item.title_id))
      return {
        requestId,
        userId: targetUserId,
        status: 'success',
        titles: (catalog ?? []).map((item) => ({
          ...item,
          owned: ownedIds.has(item.id),
          equipped: equipped?.title_id === item.id,
        })),
        errorText: '',
      }
    } catch (error) {
      console.error('称号取得エラー:', error)
      return { requestId, userId: targetUserId, status: 'error', titles: [], errorText: '称号を取得できませんでした。' }
    }
  }, [])

  const applyResult = useCallback((result: TitleLoadResult) => {
    if (result.requestId !== requestIdRef.current) return
    setTitles(result.titles)
    setErrorText(result.errorText)
    setLoadedUserId(result.userId)
  }, [])

  const reload = useCallback(async (targetUserId: string) => {
    applyResult(await loadTitles(targetUserId))
  }, [applyResult, loadTitles])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      requestIdRef.current += 1
      return
    }
    void reload(userId)
  }, [authLoading, reload, userId])

  const equip = async (titleId: string | null) => {
    if (!userId || updating) return
    setUpdating(titleId ?? 'none')
    const { error } = await supabase.rpc('equip_my_title', { p_title_id: titleId })
    if (error) {
      console.error('称号装備エラー:', error)
      setErrorText('称号を変更できませんでした。')
    } else {
      await reload(userId)
    }
    setUpdating(null)
  }

  const loading = authLoading || (userId !== null && loadedUserId !== userId)

  return (
    <main className="app-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 96px' }}>
      <Link href={userId ? `/user/${userId}` : '/'} style={{ color: '#d7c2a7' }}>← 戻る</Link>
      <h1 style={{ color: '#ffda79' }}>称号</h1>
      <p style={{ color: '#bda991' }}>歩みから得た称号を一つだけ掲げられます。</p>
      {loading ? <p role="status">読み込み中です…</p> : !userId ? (
        <p><Link href="/auth" style={{ color: '#ffda79' }}>ログイン</Link>すると称号を確認できます。</p>
      ) : errorText ? <p role="alert" style={{ color: '#ff8d8d' }}>{errorText}</p> : (
        <div style={{ display: 'grid', gap: 12 }}>
          {titles.map((title) => (
            <article key={title.id} className="panel-card" style={{ padding: 18, opacity: title.owned ? 1 : 0.55 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18 }}>{title.name}</h2>
                  <p style={{ color: '#bda991', marginBottom: 0 }}>{title.description}</p>
                </div>
                <button
                  type="button"
                  className={title.equipped ? 'gold-button' : 'soft-button'}
                  disabled={!title.owned || updating !== null}
                  onClick={() => equip(title.equipped ? null : title.id)}
                  style={{ padding: '8px 12px', cursor: title.owned ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                >
                  {title.equipped ? '装備中' : title.owned ? '装備する' : '未所持'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
