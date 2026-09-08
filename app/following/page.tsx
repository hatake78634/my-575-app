'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAvatarFrames } from '../hooks/useAvatarFrames'
import { supabase } from '@/lib/supabase'
import Avatar from '../components/Avatar'
import { AppShell, Button, EmptyState, ErrorState, Field, LoadingState, Surface, Tabs } from '../components/ui'

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
  const avatarFrames = useAvatarFrames(profiles.map((profile) => profile.id))
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
    <AppShell>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, color: 'var(--primary)' }}>歌人のつながり</h1>
        <p className="ui-muted" style={{ marginBottom: 0 }}>贔屓、好読者、歌友を確認できます。</p>
      </header>

      <Tabs role="tablist" aria-label="関係の種類" style={{ marginBottom: 16 }}>
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            variant={activeTab === tab.key ? 'primary' : 'secondary'}
            onClick={() => setActiveTab(tab.key)}
            className="ui-tab"
            style={{ padding: '10px 12px' }}
          >
            {tab.label}
          </Button>
        ))}
      </Tabs>

      <label style={{ display: 'grid', gap: 6, marginBottom: 18 }}>
        <span className="ui-muted" style={{ fontSize: 14 }}>歌人名で検索</span>
        <Field
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="歌人名を入力"
          style={{ padding: 12 }}
        />
      </label>

      {loading ? (
        <LoadingState />
      ) : !userId ? (
        <Surface style={{ padding: 22 }}>
          <p>一覧を見るにはログインしてください。</p>
          <Link href="/auth" className="ui-link">ログインへ</Link>
        </Surface>
      ) : errorText ? (
        <ErrorState>{errorText}</ErrorState>
      ) : visibleProfiles.length === 0 ? (
        <EmptyState>{normalizedQuery ? '該当する歌人はいません。' : 'まだ該当する歌人はいません。'}</EmptyState>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {visibleProfiles.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/user/${profile.id}`}
                className="ui-surface"
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, color: 'inherit', textDecoration: 'none' }}
              >
                <Avatar src={profile.avatar_url} name={profile.username} size={48} frame={avatarFrames[profile.id]} />
                <div style={{ minWidth: 0 }}>
                  <strong>{profile.username || '名無しの歌人'}</strong>
                  {profile.bio && <p className="ui-muted" style={{ margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.bio}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  )
}
