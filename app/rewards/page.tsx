'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { AppShell, Button, LoadingState, Surface } from '../components/ui'

type Task = { id: string; name: string; description: string; reward: number }
type RewardResult = { requestId: number; userId: string; tasks: Task[]; balance: number; errorText: string }

export default function RewardsPage() {
  const { userId, loading: authLoading } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [balance, setBalance] = useState<number | null>(null)
  const [loaded, setLoaded] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const requestIdRef = useRef(0)
  const load = useCallback(async (id: string): Promise<RewardResult> => {
    const requestId = ++requestIdRef.current
    const [taskResult, walletResult] = await Promise.all([supabase.from('daily_task_catalog').select('id,name,description,reward'), supabase.rpc('ensure_my_wallet')])
    if (taskResult.error || walletResult.error) return { requestId, userId: id, tasks: [], balance: 0, errorText: '報酬情報を取得できませんでした。' }
    return { requestId, userId: id, tasks: (taskResult.data ?? []) as Task[], balance: Number(walletResult.data), errorText: '' }
  }, [])
  const apply = useCallback((result: RewardResult) => {
    if (result.requestId !== requestIdRef.current) return
    setTasks(result.tasks); setBalance(result.balance); setMessage(result.errorText); setLoaded(result.userId)
  }, [])
  useEffect(() => { if (!authLoading && userId) void load(userId).then(apply) }, [apply, authLoading, load, userId])
  const claim = async (kind: 'login' | 'task', taskId?: string) => {
    if (!userId) return
    const result = kind === 'login' ? await supabase.rpc('claim_daily_login_bonus') : await supabase.rpc('claim_daily_task', { p_task_id: taskId })
    if (result.error) setMessage(result.error.message)
    else { setBalance(Number(result.data)); setMessage('報酬を受け取りました。') }
  }
  const loading = authLoading || (!!userId && loaded !== userId)
  return <AppShell><h1 style={{ color: 'var(--primary)' }}>今日のご褒美</h1>{loading ? <LoadingState /> : !userId ? <p>ログインすると報酬を受け取れます。</p> : <><h2>残高: {balance ?? 0} コイン</h2>{message && <p className="ui-status" role="status">{message}</p>}<Button variant="primary" onClick={() => claim('login')}>本日のログイン報酬を受け取る</Button><h2>デイリー</h2><div style={{ display: 'grid', gap: 10 }}>{tasks.map((task) => <Surface key={task.id} style={{ padding: 16 }}><h3>{task.name}</h3><p>{task.description}</p><Button onClick={() => claim('task', task.id)}>{task.reward} コインを受け取る</Button></Surface>)}</div></>}</AppShell>
}
