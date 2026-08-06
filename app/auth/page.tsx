'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('') // ユーザー名
  const [avatarUrl, setAvatarUrl] = useState('') // アイコンURL
  const [isSignUp, setIsSignUp] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const waitForSession = async (): Promise<boolean> => {
    const maxAttempts = 12
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        return true
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    return false
  }

  const refreshSession = async (): Promise<boolean> => {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      console.error('refreshSession error:', error)
      return false
    }
    return Boolean(data?.session)
  }

  const loginAfterSignUp = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    console.log('signup fallback signInWithPassword', { data, error })
    if (error) {
      console.error('signup login fallback error:', error.message)
      return false
    }
    if (data?.session) {
      return true
    }
    return await waitForSession()
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (isSignUp) {
      // 新規登録：metadata に username と avatar_url を一緒に保存
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username || '名無し',
            avatar_url: avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + encodeURIComponent(username || email), // 初期アイコン
          },
        },
      })
      console.log('signUp', { data, error })
      if (error) {
        setErrorMsg(error.message)
        return
      }

      if (data?.session) {
        console.log('signUp session established')
        window.location.href = '/'
        return
      }

      const loggedIn = await loginAfterSignUp()
      if (loggedIn) {
        window.location.href = '/'
        return
      }

      setErrorMsg('アカウント登録は完了しました。メール確認が必要な場合は、確認メールを受信してからログインしてください。')
      return
    }

    // ログイン
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    console.log('signInWithPassword', { data, error })
    if (error) {
      setErrorMsg(error.message)
      return
    }

    if (data?.session) {
      window.location.href = '/'
      return
    }

    const sessionReady = await waitForSession()
    if (sessionReady) {
      window.location.href = '/'
      return
    }

    const refreshed = await refreshSession()
    if (refreshed) {
      window.location.href = '/'
      return
    }

    setErrorMsg('ログインには成功しましたが、セッションの確立に失敗しました。ページをリロードして再試行してください。')
  }

  return (
    <main style={{ padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
      <h1>{isSignUp ? '新規アカウント登録' : 'ログイン'}</h1>

      {errorMsg && <p style={{ color: 'red' }}>{errorMsg}</p>}

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        {isSignUp && (
          <>
            <input
              type="text"
              placeholder="ユーザー名（表示名）"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ padding: '10px' }}
            />
            <input
              type="text"
              placeholder="アイコン画像URL（空欄で自動生成）"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              style={{ padding: '10px' }}
            />
          </>
        )}
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <input
          type="password"
          placeholder="パスワード (6文字以上)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px' }}
        />
        <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>
          {isSignUp ? '登録する' : 'ログインする'}
        </button>
      </form>

      <button
        onClick={() => setIsSignUp(!isSignUp)}
        style={{ marginTop: '20px', background: 'none', border: 'none', color: '#0070f3', cursor: 'pointer' }}
      >
        {isSignUp ? 'すでにアカウントをお持ちの方（ログイン）' : 'アカウントをお持ちでない方（新規登録）'}
      </button>
    </main>
  )
}