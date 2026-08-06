'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Profile = {
  id: string
  username: string
  bio: string
  avatar_url: string
}

type Haiku = {
  id: string
  first_line: string
  second_line: string
  third_line: string
  author: string
  joshi?: string
  avatar_url?: string
  user_id?: string
  created_at: string
}

export default function UserPage() {
  const params = useParams()
  const userId = params.id as string
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [haikus, setHaikus] = useState<Haiku[]>([])
  const [likeCounts, setLikeCounts] = useState<{ [key: string]: number }>({})
  const [userLikes, setUserLikes] = useState<{ [key: string]: boolean }>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  const [activeTab, setActiveTab] = useState('posts')

  useEffect(() => {
    if (!userId) {
      return
    }

    let isMounted = true

    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!isMounted) return
        setCurrentUserId(user?.id ?? null)

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()

        if (!isMounted) return
        if (profileError) {
          console.error('プロフィール取得エラー:', profileError)
        }
        setProfile(profileData || null)

        const { data: haikuData, error: haikuError } = await supabase
          .from('haikus_2')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (!isMounted) return
        if (haikuError) {
          console.error('俳句取得エラー:', haikuError)
        }
        const loadedHaikus = haikuData || []
        setHaikus(loadedHaikus)

        const { count: followersCount, error: followersError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId)

        const { count: followingsCount, error: followingsError } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId)

        if (!isMounted) return
        if (followersError) {
          console.error('フォロワー数取得エラー:', followersError)
        }
        if (followingsError) {
          console.error('フォロー数取得エラー:', followingsError)
        }
        setFollowerCount(followersCount || 0)
        setFollowingCount(followingsCount || 0)

        if (user?.id && user.id !== userId) {
          const { data: followData, error: followError } = await supabase
            .from('follows')
            .select('*')
            .eq('follower_id', user.id)
            .eq('following_id', userId)
            .maybeSingle()

          if (!isMounted) return
          if (followError) {
            console.error('フォロー状態取得エラー:', followError)
          }
          setIsFollowing(!!followData)
        } else {
          setIsFollowing(false)
        }

        const { data: likesData, error: likesError } = await supabase.from('likes_2').select('*')
        if (!isMounted) return
        if (likesError) {
          console.error('いいね情報取得エラー:', likesError)
        }

        const counts: { [key: string]: number } = {}
        const myLikes: { [key: string]: boolean } = {}
        const allLikes = Array.isArray(likesData) ? likesData : []

        loadedHaikus.forEach((haiku) => {
          const haikuLikes = allLikes.filter((l) => String(l.haiku_id) === String(haiku.id))
          counts[haiku.id] = haikuLikes.length
          myLikes[haiku.id] = Boolean(user?.id && haikuLikes.some((l) => l.user_id === user.id))
        })

        setLikeCounts(counts)
        setUserLikes(myLikes)
      } catch (err) {
        console.error('データ取得エラー:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchUserData()

    return () => {
      isMounted = false
    }
  }, [userId])

  const handleFollowToggle = async () => {
    if (!currentUserId) {
      alert('フォローするにはログインが必要です！')
      router.push('/auth')
      return
    }

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', userId)

      setIsFollowing(false)
      setFollowerCount((prev) => Math.max(0, prev - 1))
    } else {
      await supabase
        .from('follows')
        .insert([
          {
            follower_id: currentUserId,
            following_id: userId,
          },
        ])

      setIsFollowing(true)
      setFollowerCount((prev) => prev + 1)
    }
  }

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
    <div style={{ backgroundColor: '#121212', color: '#fff', minHeight: '100vh', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        <button 
          onClick={() => router.push('/')} 
          style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', marginBottom: '20px', fontSize: '0.95rem' }}
        >
          ← トップに戻る
        </button>

        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '15px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              {profile?.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt="avatar"
                  width={80}
                  height={80}
                  style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333' }}
                  unoptimized
                />
              ) : (
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#444' }} />
              )}
              <div>
                <h1 style={{ fontSize: '1.3rem', fontWeight: 'bold', margin: 0, color: '#fff' }}>
                  {profile?.username || (isLoading ? '読み込み中...' : '名無し')}
                </h1>
                <span style={{ fontSize: '0.75rem', color: '#888' }}>ID: {userId ? userId.slice(0, 8) : ''}</span>
              </div>
            </div>

            {currentUserId === userId ? (
              <button
                onClick={() => router.push('/profile')}
                style={{
                  backgroundColor: 'transparent',
                  border: '1px solid #444',
                  color: '#fff',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                情報編集
              </button>
            ) : currentUserId ? (
              <button
                onClick={handleFollowToggle}
                style={{
                  backgroundColor: isFollowing ? 'transparent' : '#ffda79',
                  border: isFollowing ? '1px solid #444' : 'none',
                  color: isFollowing ? '#fff' : '#121212',
                  padding: '6px 16px',
                  borderRadius: '20px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isFollowing ? 'フォロー中' : 'フォローする'}
              </button>
            ) : null}
          </div>

          <p style={{ color: '#ccc', fontSize: '0.9rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', marginBottom: '15px' }}>
            {profile?.bio || '自己紹介はまだありません。'}
          </p>

          <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: '#aaa', borderBottom: '1px solid #2a2a2a', paddingBottom: '20px' }}>
            <div><strong style={{ color: '#fff' }}>{haikus.length}</strong> 句の詠草</div>
            <div><strong style={{ color: '#fff' }}>{followingCount}</strong> フォロー</div>
            <div><strong style={{ color: '#fff' }}>{followerCount}</strong> フォロワー</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '25px', borderBottom: '1px solid #2a2a2a', marginBottom: '20px', fontSize: '0.95rem' }}>
          <div 
            onClick={() => setActiveTab('posts')}
            style={{ 
              paddingBottom: '10px', 
              cursor: 'pointer', 
              color: activeTab === 'posts' ? '#fff' : '#777', 
              borderBottom: activeTab === 'posts' ? '2px solid #ffda79' : 'none',
              fontWeight: activeTab === 'posts' ? 'bold' : 'normal'
            }}
          >
            全ての投稿
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#777', marginTop: '40px' }}>読み込み中...</p>
          ) : haikus.length === 0 ? (
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {profile?.avatar_url && (
                        <Image
                          src={profile.avatar_url}
                          alt="avatar"
                          width={28}
                          height={28}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          unoptimized
                        />
                      )}
                      <span style={{ fontSize: '0.85rem', color: '#ccc', fontWeight: 'bold' }}>
                        {profile?.username || '名無し'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#888' }}>
                      {formatDate(haiku.created_at)}
                    </div>
                  </div>

                  <div 
                    onClick={() => router.push(`/haiku/${haiku.id}`)}
                    style={{ 
                      cursor: 'pointer',
                      marginBottom: '20px',
                      color: '#f0f0f0',
                      textAlign: 'center'
                    }}
                  >
                    {haiku.joshi && (
                      <div style={{ fontSize: '0.9rem', color: '#b0a892', marginBottom: '10px', fontStyle: 'italic' }}>
                        {haiku.joshi}
                      </div>
                    )}
                    <div style={{ display: 'inline-block', textAlign: 'left' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '0px' }}>{haiku.first_line}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '30px' }}>{haiku.second_line}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '60px' }}>{haiku.third_line}</div>
                    </div>
                  </div>

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
      </main>
    </div>
  )
}