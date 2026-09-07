'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'

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

  return <main className="app-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 96px' }}>
    <h1 style={{ color: '#ffda79' }}>師匠・弟子</h1>
    {loading ? <p role="status">読み込み中です…</p> : !userId ? <p><Link href="/auth" style={{ color: '#ffda79' }}>ログイン</Link>が必要です。</p> : <>
      {errorText && <p role="alert" style={{ color: '#ff8d8d' }}>{errorText}</p>}
      <section className="panel-card" style={{ padding: 18, marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>弟子入りを申請</h2>
        <p style={{ color: '#bda991' }}>プロフィールURL末尾のユーザーIDを入力してください。</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={mentorId} onChange={(e) => setMentorId(e.target.value.trim())} placeholder="師匠のユーザーID" style={{ flex: 1, minWidth: 0, padding: 10, borderRadius: 10, background: '#160f0b', color: '#fff', border: '1px solid #6f5636' }} />
          <button className="gold-button" disabled={!mentorId || working || mentorId === userId} onClick={() => act(() => supabase.rpc('request_mentorship', { p_mentor_id: mentorId }))} style={{ padding: '8px 14px' }}>申請</button>
        </div>
      </section>
      <section style={{ display: 'grid', gap: 10 }}>
        {relations.length === 0 ? <p style={{ color: '#bda991' }}>現在の申請・師弟関係はありません。</p> : relations.map((relation) => {
          const isMentor = relation.mentor_id === userId
          const otherId = isMentor ? relation.apprentice_id : relation.mentor_id
          return <article key={relation.id} className="panel-card" style={{ padding: 16 }}>
            <Link href={`/user/${otherId}`} style={{ color: '#ffda79', fontWeight: 'bold' }}>{name(otherId)}</Link>
            <p>{relation.status === 'accepted' ? (isMentor ? 'あなたの弟子' : 'あなたの師匠') : (isMentor ? '届いた弟子入り申請' : '承認待ちの申請')}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {relation.status === 'pending' && isMentor && <>
                <button className="gold-button" disabled={working} onClick={() => act(() => supabase.rpc('respond_to_mentorship', { p_request_id: relation.id, p_accept: true }))} style={{ padding: '7px 12px' }}>承認</button>
                <button className="soft-button" disabled={working} onClick={() => act(() => supabase.rpc('respond_to_mentorship', { p_request_id: relation.id, p_accept: false }))} style={{ padding: '7px 12px' }}>拒否</button>
              </>}
              {(relation.status === 'accepted' || !isMentor) && <button className="soft-button" disabled={working} onClick={() => act(() => supabase.rpc('close_mentorship', { p_request_id: relation.id }))} style={{ padding: '7px 12px' }}>{relation.status === 'pending' ? '申請を取消' : '関係を解消'}</button>}
            </div>
          </article>
        })}
      </section>
      <p><Link href={`/lineage/${userId}`} style={{ color: '#ffda79' }}>自分の一門図を見る →</Link></p>
    </>}
  </main>
}
