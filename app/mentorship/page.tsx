'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AppShell, Button, EmptyState, ErrorState, Field, LoadingState, Surface } from '../components/ui'

type Relation = { id: number; mentor_id: string; apprentice_id: string; status: 'pending' | 'accepted'; requested_at: string }
type Person = { id: string; username: string | null }
type LoadResult = { requestId: number; userId: string; relations: Relation[]; people: Record<string, Person>; errorText: string }

export default function MentorshipPage() {
  const { userId, loading: authLoading } = useAuth()
  const [relations, setRelations] = useState<Relation[]>([])
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [mentorId, setMentorId] = useState('')
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null)
  const [errorText, setErrorText] = useState('')
  const [working, setWorking] = useState(false)
  const requestIdRef = useRef(0)

  const load = useCallback(async (targetUserId: string): Promise<LoadResult> => {
    const requestId = ++requestIdRef.current
    try {
      const { data, error } = await supabase.from('mentorships').select('id, mentor_id, apprentice_id, status, requested_at').or(`mentor_id.eq.${targetUserId},apprentice_id.eq.${targetUserId}`).in('status', ['pending', 'accepted']).order('requested_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as Relation[]
      const ids = [...new Set(rows.flatMap((row) => [row.mentor_id, row.apprentice_id]))]
      const { data: profileRows, error: profileError } = ids.length
        ? await supabase.from('profiles_3').select('id, username').in('id', ids)
        : { data: [], error: null }
      if (profileError) throw profileError
      return { requestId, userId: targetUserId, relations: rows, people: Object.fromEntries((profileRows ?? []).map((person) => [person.id, person])), errorText: '' }
    } catch (error) {
      console.error('師弟関係取得エラー:', error)
      return { requestId, userId: targetUserId, relations: [], people: {}, errorText: '師弟関係を取得できませんでした。' }
    }
  }, [])

  const apply = useCallback((result: LoadResult) => {
    if (result.requestId !== requestIdRef.current) return
    setRelations(result.relations); setPeople(result.people); setErrorText(result.errorText); setLoadedUserId(result.userId)
  }, [])
  const reload = useCallback(async (id: string) => apply(await load(id)), [apply, load])

  useEffect(() => {
    if (authLoading) return
    if (!userId) { requestIdRef.current += 1; return }
    void reload(userId)
  }, [authLoading, reload, userId])

  const act = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (!userId || working) return
    setWorking(true); setErrorText('')
    const { error } = await action()
    if (error) setErrorText(error.message)
    else await reload(userId)
    setWorking(false)
  }

  const name = (id: string) => people[id]?.username || '名無しの歌人'
  const loading = authLoading || (!!userId && loadedUserId !== userId)

  return <AppShell>
    <h1 style={{ color: 'var(--primary)' }}>師匠・弟子</h1>
    {loading ? <LoadingState /> : !userId ? <p><Link href="/auth" className="ui-link">ログイン</Link>が必要です。</p> : <>
      {errorText && <ErrorState>{errorText}</ErrorState>}
      <Surface style={{ padding: 18, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>弟子入りを申請</h2>
        <p className="ui-muted">プロフィールURL末尾のユーザーIDを入力してください。</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Field value={mentorId} onChange={(e) => setMentorId(e.target.value.trim())} placeholder="師匠のユーザーID" style={{ flex: 1, minWidth: 0 }} />
          <Button variant="primary" disabled={!mentorId || working || mentorId === userId} onClick={() => act(() => supabase.rpc('request_mentorship', { p_mentor_id: mentorId }))}>申請</Button>
        </div>
      </Surface>
      <section style={{ display: 'grid', gap: 10 }}>
        {relations.length === 0 ? <EmptyState>現在の申請・師弟関係はありません。</EmptyState> : relations.map((relation) => {
          const isMentor = relation.mentor_id === userId
          const otherId = isMentor ? relation.apprentice_id : relation.mentor_id
          return <Surface key={relation.id} style={{ padding: 16 }}>
            <Link href={`/user/${otherId}`} className="ui-link" style={{ fontWeight: 'bold' }}>{name(otherId)}</Link>
            <p>{relation.status === 'accepted' ? (isMentor ? 'あなたの弟子' : 'あなたの師匠') : (isMentor ? '届いた弟子入り申請' : '承認待ちの申請')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {relation.status === 'pending' && isMentor && <>
                <Button variant="primary" disabled={working} onClick={() => act(() => supabase.rpc('respond_to_mentorship', { p_request_id: relation.id, p_accept: true }))}>承認</Button>
                <Button disabled={working} onClick={() => act(() => supabase.rpc('respond_to_mentorship', { p_request_id: relation.id, p_accept: false }))}>拒否</Button>
              </>}
              {(relation.status === 'accepted' || !isMentor) && <Button disabled={working} onClick={() => act(() => supabase.rpc('close_mentorship', { p_request_id: relation.id }))}>{relation.status === 'pending' ? '申請を取消' : '関係を解消'}</Button>}
            </div>
          </Surface>
        })}
      </section>
      <p><Link href={`/lineage/${userId}`} className="ui-link">自分の一門図を見る →</Link></p>
    </>}
  </AppShell>
}
