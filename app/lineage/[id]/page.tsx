'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Relation = { mentor_id: string; apprentice_id: string }
type Person = { id: string; username: string | null }

export default function LineagePage() {
  const { id } = useParams<{ id: string }>()
  const [relations, setRelations] = useState<Relation[]>([])
  const [people, setPeople] = useState<Record<string, Person>>({})
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error } = await supabase.from('mentorships').select('mentor_id, apprentice_id').eq('status', 'accepted').limit(500)
      if (!active) return
      if (error) { setErrorText('一門図を取得できませんでした。'); setLoadedId(id); return }
      const rows = (data ?? []) as Relation[]
      const ids = [...new Set([id, ...rows.flatMap((row) => [row.mentor_id, row.apprentice_id])])]
      const { data: profiles } = await supabase.from('profiles_3').select('id, username').in('id', ids)
      if (!active) return
      setRelations(rows); setPeople(Object.fromEntries((profiles ?? []).map((person) => [person.id, person]))); setLoadedId(id)
    })()
    return () => { active = false }
  }, [id])

  const renderBranch = (personId: string, direction: 'mentor' | 'apprentice', depth: number, visited: Set<string>): React.ReactNode => {
    if (depth > 3 || visited.has(personId)) return null
    const nextVisited = new Set(visited).add(personId)
    const related = direction === 'mentor'
      ? relations.filter((row) => row.apprentice_id === personId).map((row) => row.mentor_id)
      : relations.filter((row) => row.mentor_id === personId).map((row) => row.apprentice_id)
    return related.length > 0 && <ul style={{ display: 'grid', gap: 8 }}>{related.map((relatedId) => <li key={relatedId}>
      <Link href={`/user/${relatedId}`} style={{ color: '#ffda79' }}>{people[relatedId]?.username || '名無しの歌人'}</Link>
      {renderBranch(relatedId, direction, depth + 1, nextVisited)}
    </li>)}</ul>
  }

  return <main className="app-shell" style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 96px' }}>
    <h1 style={{ color: '#ffda79' }}>一門図</h1>
    {loadedId !== id ? <p role="status">読み込み中です…</p> : errorText ? <p role="alert" style={{ color: '#ff8d8d' }}>{errorText}</p> : <>
      <section className="panel-card" style={{ padding: 18 }}><h2>師匠の系譜</h2>{renderBranch(id, 'mentor', 0, new Set()) || <p style={{ color: '#bda991' }}>登録された師匠はいません。</p>}</section>
      <div style={{ textAlign: 'center', padding: 18 }}><Link href={`/user/${id}`} className="gold-button" style={{ display: 'inline-block', padding: '10px 18px', textDecoration: 'none' }}>{people[id]?.username || '中心の歌人'}</Link></div>
      <section className="panel-card" style={{ padding: 18 }}><h2>弟子の系譜</h2>{renderBranch(id, 'apprentice', 0, new Set()) || <p style={{ color: '#bda991' }}>登録された弟子はいません。</p>}</section>
    </>}
  </main>
}
