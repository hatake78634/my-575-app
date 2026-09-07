'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'

type RelationshipTab = 'following' | 'followers' | 'mutual'

type RelationshipProfile = {
  id: string
  username: string | null
  avatar_url: string | null
  bio: string | null
}

type RelationshipLoadResult = {
  requestId: number
  targetUserId: string
  status: 'success' | 'error'
  profiles: RelationshipProfile[]
  errorText: string
}

const tabs: Array<{ key: RelationshipTab; label: string }> = [
  { key: 'following', label: '贔屓' },
  { key: 'followers', label: '好読者' },
  { key: 'mutual', label: '歌友' },
]

export default function FollowingPage() {
  const { userId, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState<RelationshipTab>('following')
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<RelationshipProfile[]>([])
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [errorText, setErrorText] = useState('')
  const requestIdRef = useRef(0)

  const loadRelationships = useCallback(
    async (
      targetUserId: string,
      tab: RelationshipTab,
    ): Promise<RelationshipLoadResult> => {
      const requestId = ++requestIdRef.current

      try {
        const [{ data: following, error: followingError }, { data: followers, error: followersError }] =
          await Promise.all([
            supabase.from('follows').select('following_id').eq('follower_id', targetUserId),
            supabase.from('follows').select('follower_id').eq('following_id', targetUserId),
          ])

        if (followingError || followersError) {
          throw followingError ?? followersError
        }

        const followingIds = new Set((following ?? []).map((row) => row.following_id))
        const followerIds = new Set((followers ?? []).map((row) => row.follower_id))
        const ids =
          tab === 'following'
            ? [...followingIds]
            : tab === 'followers'
              ? [...followerIds]
              : [...followingIds].filter((id) => followerIds.has(id))

        if (ids.length === 0) {
          return { requestId, targetUserId, status: 'success', profiles: [], errorText: '' }
        }

        const { data, error } = await supabase
          .from('profiles_3')
          .select('id, username, avatar_url, bio')
          .in('id', ids)
          .order('username', { ascending: true })

        if (error) throw error

        return {
          requestId,
          targetUserId,
          status: 'success',
          profiles: (data ?? []) as RelationshipProfile[],
          errorText: '',
        }
      } catch (error) {
        console.error('関係一覧取得エラー:', error)
        return {
          requestId,
          targetUserId,
          status: 'error',
          profiles: [],
          errorText: '一覧を取得できませんでした。',
        }
      }
    },
    [],
  )

  const applyResult = useCallback((result: RelationshipLoadResult, key: string) => {
    if (result.requestId !== requestIdRef.current) return
    setProfiles(result.profiles)
    setErrorText(result.errorText)
    setLoadedKey(key)
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      requestIdRef.current += 1
      return
    }

    const key = `${userId}:${activeTab}`
    void loadRelationships(userId, activeTab).then((result) => applyResult(result, key))
  }, [activeTab, applyResult, authLoading, loadRelationships, userId])

  const currentKey = userId ? `${userId}:${activeTab}` : null
  const loading = authLoading || currentKey === null || loadedKey !== currentKey
  const normalizedQuery = query.trim().toLocaleLowerCase('ja')
  const visibleProfiles = useMemo(
    () =>
      normalizedQuery
        ? profiles.filter((profile) =>
            (profile.username ?? '').toLocaleLowerCase('ja').includes(normalizedQuery),
          )
        : profiles,
    [normalizedQuery, profiles],
  )

  return (
    <main className="app-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 96px' }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: '#ffda79' }}>歌人のつながり</h1>
        <p style={{ color: '#bda991', marginBottom: 0 }}>贔屓、好読者、歌友を確認できます。</p>
      </header>

      <div role="tablist" aria-label="関係の種類" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={activeTab === tab.key ? 'gold-button' : 'soft-button'}
            onClick={() => setActiveTab(tab.key)}
            style={{ flex: 1, padding: '10px 12px', cursor: 'pointer' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <label style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
        <span style={{ color: '#d7c2a7', fontSize: 14 }}>歌人名で検索</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="歌人名を入力"
          style={{ borderRadius: 12, border: '1px solid #6f5636', background: '#160f0b', color: '#fff', padding: 12 }}
        />
      </label>

      {loading ? (
        <p role="status" style={{ color: '#bda991' }}>読み込み中です…</p>
      ) : !userId ? (
        <div className="panel-card" style={{ padding: 22 }}>
          <p>一覧を見るにはログインしてください。</p>
          <Link href="/auth" style={{ color: '#ffda79' }}>ログインへ</Link>
        </div>
      ) : errorText ? (
        <p role="alert" style={{ color: '#ff8d8d' }}>{errorText}</p>
      ) : visibleProfiles.length === 0 ? (
        <p style={{ color: '#bda991' }}>{normalizedQuery ? '該当する歌人はいません。' : 'まだ該当する歌人はいません。'}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {visibleProfiles.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/user/${profile.id}`}
                className="panel-card"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, color: 'inherit', textDecoration: 'none' }}
              >
                <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', background: '#3a2a20', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {profile.avatar_url ? (
                    <Image src={profile.avatar_url} alt="" width={48} height={48} unoptimized style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : '歌'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <strong>{profile.username || '名無しの歌人'}</strong>
                  {profile.bio && <p style={{ color: '#bda991', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
