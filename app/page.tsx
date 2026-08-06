'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

type Haiku = {
  id: string
  first_line: string
  second_line: string
  third_line: string
  joshi?: string
  description?: string
  author: string
  avatar_url?: string
  user_id?: string
  created_at?: string
}

export default function Home() {
  const [haikus, setHaikus] = useState<Haiku[]>([])
  const [firstLine, setFirstLine] = useState('')
  const [secondLine, setSecondLine] = useState('')
  const [thirdLine, setThirdLine] = useState('')
  const [joshi, setJoshi] = useState('')
  const [description, setDescription] = useState('')
  
  const [userName, setUserName] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({})
  const [userLikes, setUserLikes] = useState<{ [key: string]: boolean }>({})

  // 投稿モーダルの開閉状態
  const [isModalOpen, setIsModalOpen] = useState(false)

  const firstLineLength = firstLine.length
  const secondLineLength = secondLine.length
  const thirdLineLength = thirdLine.length

  const firstLineError = firstLineLength === 0
    ? '1文字以上入力してください'
    : firstLineLength > 7
      ? '7文字以内にしてください'
      : ''

  const secondLineError = secondLineLength === 0
    ? '3文字以上入力してください'
    : secondLineLength < 3
      ? '3文字以上入力してください'
      : secondLineLength > 10
        ? '10文字以内にしてください'
        : ''

  const thirdLineError = thirdLineLength === 0
    ? '1文字以上入力してください'
    : thirdLineLength > 7
      ? '7文字以内にしてください'
      : ''

  const isSubmitValid = !firstLineError && !secondLineError && !thirdLineError

  const router = useRouter()

  // データを取得・再取得するための関数
  const loadData = async () => {
    setIsLoading(true)

    try {
      // 1. ユーザー情報の取得
      const { data: { user } } = await supabase.auth.getUser()
      const authUserId = user?.id ?? null
      setCurrentUserId(authUserId)

      let activeUserName: string | null = null
      let activeUserAvatar: string | null = null

      if (authUserId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUserId)
          .maybeSingle()

        if (profileError) {
          console.error('プロフィール取得エラー:', profileError)
        }

        if (profile && profile.username) {
          activeUserName = profile.username
          activeUserAvatar = profile.avatar_url
        }
      }

      setUserName(activeUserName)
      setUserAvatar(activeUserAvatar)

      // 2. 俳句一覧の取得
      const { data: haikuData } = await supabase.from('haikus_2').select('*')

      if (!haikuData || haikuData.length === 0) {
        setHaikus([])
        setLikeCounts({})
        setUserLikes({})
        return
      }

      const reversedHaikus = [...haikuData].reverse()
      setHaikus(reversedHaikus)

      // 3. いいね情報の取得
      const { data: likesData } = await supabase.from('likes_2').select('*')

      const counts: { [key: string]: number } = {}
      const myLikes: { [key: string]: boolean } = {}

      reversedHaikus.forEach((haiku) => {
        const haikuLikes = likesData ? likesData.filter((l) => l.haiku_id === String(haiku.id)) : []
        counts[haiku.id] = haikuLikes.length

        if (authUserId) {
          const likedByMe = haikuLikes.some((l) => l.user_id === authUserId)
          if (likedByMe) {
            myLikes[haiku.id] = true
          }
        }
      })

      setLikeCounts(counts)
      setUserLikes(myLikes)

    } catch (err) {
      console.error('データ取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const isMounted = { current: true }

    const init = async () => {
      if (!isMounted.current) return
      await loadData()
    }

    void init()

    return () => {
      isMounted.current = false
    }
  }, [])

  const handleLike = async (haikuId: string) => {
    if (!currentUserId) {
      alert('いいねするにはログインが必要です！')
      router.push('/auth')
      return
    }

    const isAlreadyLiked = userLikes[haikuId]

    if (isAlreadyLiked) {
      await supabase
        .from('likes_2')
        .delete()
        .eq('haiku_id', String(haikuId))
        .eq('user_id', currentUserId)

      setUserLikes({ ...userLikes, [haikuId]: false })
      setLikeCounts({ ...likeCounts, [haikuId]: (likeCounts[haikuId] || 1) - 1 })
    } else {
      await supabase.from('likes_2').insert([
        {
          haiku_id: String(haikuId),
          user_id: currentUserId,
        },
      ])

      setUserLikes({ ...userLikes, [haikuId]: true })
      setLikeCounts({ ...likeCounts, [haikuId]: (likeCounts[haikuId] || 0) + 1 })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isSubmitValid) return
    if (!userName || !currentUserId) {
      router.push('/auth')
      return
    }

    await supabase.from('haikus_2').insert([
      {
        first_line: firstLine,
        second_line: secondLine,
        third_line: thirdLine,
        joshi: joshi,
        description: description,
        author: userName,
        avatar_url: userAvatar,
        user_id: currentUserId,
        created_at: new Date().toISOString(),
      },
    ])

    setFirstLine('')
    setSecondLine('')
    setThirdLine('')
    setJoshi('')
    setDescription('')
    setIsModalOpen(false) 
    await loadData()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUserName(null)
    setUserAvatar(null)
    setCurrentUserId(null)
    await loadData()
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    if (diffMin < 1) return 'たった今'
    if (diffMin < 60) return `${diffMin}分前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}時間前`

    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  }

  return (
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', paddingBottom: '100px' }}>
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* ヘッダー */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #2a2a2a', paddingBottom: '15px' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 'bold', letterSpacing: '1px' }}>新着俳句</h1>
          {userName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {userAvatar && (
                <Image
                  src={userAvatar}
                  alt="avatar"
                  width={36}
                  height={36}
                  onClick={() => currentUserId && router.push(`/user/${currentUserId}`)}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '1px solid #444' }}
                  unoptimized
                />
              )}
              <button onClick={() => router.push('/profile')} style={{ background: 'none', border: '1px solid #444', color: '#ccc', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.85rem' }}>設定</button>
              <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #444', color: '#ff6b6b', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '0.85rem' }}>ログアウト</button>
            </div>
          ) : (
            <button onClick={() => router.push('/auth')} style={{ backgroundColor: '#ffda79', color: '#121212', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' }}>ログイン</button>
          )}
        </header>

        {/* タイムライン一覧（カード型） */}
        {isLoading ? (
          <p style={{ textAlign: 'center', color: '#777', marginTop: '40px' }}>読み込み中...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {haikus.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#777', marginTop: '40px' }}>まだ投稿はありません。</p>
            ) : (
              haikus.map((haiku) => {
                const isLiked = userLikes[haiku.id] || false
                const count = likeCounts[haiku.id] || 0

                return (
                  <div 
                    key={haiku.id} 
                    style={{ 
                      backgroundColor: '#1e1e1e', 
                      borderRadius: '16px', 
                      padding: '20px', 
                      border: '1px solid #2a2a2a',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                    }}
                  >
                    {/* ユーザー情報 header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                      {haiku.avatar_url ? (
                        <Image
                          src={haiku.avatar_url}
                          alt="avatar"
                          width={40}
                          height={40}
                          onClick={() => haiku.user_id && router.push(`/user/${haiku.user_id}`)}
                          style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer' }}
                          unoptimized
                        />
                      ) : (
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#444' }} />
                      )}
                      <div>
                        <div 
                          onClick={() => haiku.user_id && router.push(`/user/${haiku.user_id}`)}
                          style={{ fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', color: '#fff' }}
                        >
                          {haiku.author || '名無し'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>
                          {formatDate(haiku.created_at)}
                        </div>
                      </div>
                    </div>

                    {/* 俳句本文 (タップで詳細へ) */}
                    <div 
                      onClick={() => router.push(`/haiku/${haiku.id}`)}
                      style={{ 
                        cursor: 'pointer',
                        marginBottom: '20px',
                        color: '#f0f0f0',
                        textAlign: 'center'
                      }}
                    >
                      {/* 序詞の表示（あれば） */}
                      {haiku.joshi && (
                        <div style={{ fontSize: '0.9rem', color: '#b0a892', marginBottom: '10px', fontStyle: 'italic' }}>
                          {haiku.joshi}
                        </div>
                      )}
                      <div style={{ display: 'inline-block', textAlign: 'left' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px' }}>{haiku.first_line}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '30px' }}>{haiku.second_line}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '60px' }}>{haiku.third_line}</div>
                      </div>
                    </div>

                    {/* アクションボタン群 (いいね等) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderTop: '1px solid #2a2a2a', paddingTop: '12px' }}>
                      <button
                        onClick={() => handleLike(haiku.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: isLiked ? '#ff4757' : '#aaa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.95rem'
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{isLiked ? '❤️' : '🤍'}</span> <span>{count}</span>
                      </button>

                      <button
                        onClick={() => router.push(`/haiku/${haiku.id}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#aaa',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.95rem'
                        }}
                      >
                        💬 詳細・返歌
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* 右下のフローティング・プラスボタン */}
        <button
          onClick={() => {
            if (!userName) {
              alert('投稿するにはログインが必要です！')
              router.push('/auth')
              return
            }
            setIsModalOpen(true)
          }}
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '25px',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#ffda79',
            color: '#121212',
            fontSize: '2rem',
            border: 'none',
            boxShadow: '0 4px 15px rgba(255, 218, 121, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            transition: 'transform 0.2s'
          }}
        >
          ＋
        </button>

        {/* ＋ボタンを押したときに出てくる投稿モーダル */}
        {isModalOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: '#1e1e1e',
              padding: '25px',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '400px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid #333',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>俳句を詠む</h3>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 序詞入力欄 */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>序詞（1文ほどの情緒ある言葉・任意）</label>
                  <input 
                    type="text" 
                    placeholder="例: 春風に誘われて" 
                    value={joshi} 
                    onChange={(e) => setJoshi(e.target.value)} 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} 
                  />
                </div>

                <div>
                  <input 
                    type="text" 
                    placeholder="初句 (1〜7文字)" 
                    value={firstLine} 
                    onChange={(e) => setFirstLine(e.target.value)} 
                    maxLength={7}
                    required 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#aaa' }}>{firstLineLength}/7文字</span>
                    <span style={{ color: firstLineError ? '#ff6b6b' : 'transparent' }}>{firstLineError || ' '}</span>
                  </div>
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="二句 (3〜10文字)" 
                    value={secondLine} 
                    onChange={(e) => setSecondLine(e.target.value)} 
                    maxLength={10}
                    required 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#aaa' }}>{secondLineLength}/10文字</span>
                    <span style={{ color: secondLineError ? '#ff6b6b' : 'transparent' }}>{secondLineError || ' '}</span>
                  </div>
                </div>
                <div>
                  <input 
                    type="text" 
                    placeholder="三句 (1〜7文字)" 
                    value={thirdLine} 
                    onChange={(e) => setThirdLine(e.target.value)} 
                    maxLength={7}
                    required 
                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff' }} 
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
                    <span style={{ color: '#aaa' }}>{thirdLineLength}/7文字</span>
                    <span style={{ color: thirdLineError ? '#ff6b6b' : 'transparent' }}>{thirdLineError || ' '}</span>
                  </div>
                </div>

                {/* 詳細説明入力欄 */}
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#aaa', display: 'block', marginBottom: '4px' }}>詳細・解説文（詳細ページでのみ表示・任意）</label>
                  <textarea 
                    placeholder="句に込めた想いや背景など..." 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '8px', border: '1px solid #444', backgroundColor: '#2a2a2a', color: '#fff', resize: 'vertical' }} 
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={!isSubmitValid}
                  style={{ 
                    marginTop: '10px', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    backgroundColor: '#ffda79', 
                    color: '#121212', 
                    fontWeight: 'bold', 
                    border: 'none', 
                    cursor: isSubmitValid ? 'pointer' : 'not-allowed',
                    opacity: isSubmitValid ? 1 : 0.6
                  }}
                >
                  投稿する
                </button>
              </form>
            </div>
          </div>
        )}

      </main>

      {/* 画面下部の固定メニューバー（右から：新着、フォロー中、歌合、歌人録） */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100%',
        backgroundColor: '#1a1a1a',
        borderTop: '1px solid #2a2a2a',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '12px 0',
        zIndex: 90,
        boxShadow: '0 -4px 10px rgba(0,0,0,0.3)'
      }}>
        {/* 新着 */}
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: '#ffda79', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <span>✨</span>
          <span>新着</span>
        </button>

        {/* フォロー中 */}
        <button
          onClick={() => router.push('/following')}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <span>👥</span>
          <span>フォロー中</span>
        </button>

        {/* 歌合 */}
        <button
          onClick={() => router.push('/utaawase')}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <span>📜</span>
          <span>歌合</span>
        </button>

        {/* 歌人録（マイページ） */}
        <button
          onClick={() => {
            if (!currentUserId) {
              alert('ログインが必要です！')
              router.push('/auth')
              return
            }
            router.push(`/user/${currentUserId}`)
          }}
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <span>👤</span>
          <span>歌人録</span>
        </button>
      </nav>
    </div>
  )
}