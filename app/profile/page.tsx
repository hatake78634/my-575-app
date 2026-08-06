'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ProfilePage() {
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasLoadedRef = useRef(false)
  const router = useRouter()

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    let isMounted = true

    const getProfile = async () => {
      setIsLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!isMounted) return

      if (!user) {
        setIsLoading(false)
        router.replace('/auth')
        return
      }

      setUserId(user.id)

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!isMounted) return
      if (profileError) {
        console.error('プロフィール取得エラー:', profileError)
      }
      if (data) {
        setUsername(data.username || '')
        setBio(data.bio || '')
        setAvatarUrl(data.avatar_url || '')
      }

      if (isMounted) {
        setIsLoading(false)
      }
    }

    void getProfile()

    return () => {
      isMounted = false
    }
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return

    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      username,
      bio,
      avatar_url: avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
    })

    if (error) {
      alert(`保存エラー: ${error.message}`)
    } else {
      alert('プロフィールを保存しました！')
      router.push('/')
    }
  }

  return (
    <main style={{ padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
      <h1>プロフィール設定</h1>
      {isLoading && <p style={{ color: '#666', marginTop: '10px' }}>読み込み中...</p>}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>ユーザー名（表示名）</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '10px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>自己紹介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            style={{ width: '100%', padding: '10px', height: '80px' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '5px' }}>アイコン画像URL</label>
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px', cursor: 'pointer' }}>保存する</button>
      </form>
    </main>
  )
}