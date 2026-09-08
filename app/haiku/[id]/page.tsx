'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import Avatar from '../../components/Avatar'
import ShareButton from '../../components/ShareButton'
import { useAvatarFrames } from '../../hooks/useAvatarFrames'

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

type Reply = {
  id: string
  haiku_id: string
  user_id: string
  author: string
  avatar_url?: string
  second_line: string
  third_line: string
  created_at?: string
}

export default function HaikuDetail() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [haiku, setHaiku] = useState<Haiku | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const avatarFrames = useAvatarFrames([
    haiku?.user_id,
    ...replies.map((reply) => reply.user_id),
  ])

  // 返歌用の入力フォーム
  const [secondLine, setSecondLine] = useState('')
  const [thirdLine, setThirdLine] = useState('')
  const [isReplyFormOpen, setIsReplyFormOpen] = useState(false)

  const replySecondLength = secondLine.length
  const replyThirdLength = thirdLine.length

  const replySecondError = replySecondLength === 0
    ? '3文字以上入力してください'
    : replySecondLength < 3
      ? '3文字以上入力してください'
      : replySecondLength > 10
        ? '10文字以内にしてください'
        : ''

  const replyThirdError = replyThirdLength === 0
    ? '3文字以上入力してください'
    : replyThirdLength < 3
      ? '3文字以上入力してください'
      : replyThirdLength > 10
        ? '10文字以内にしてください'
        : ''

  const isReplyValid = !replySecondError && !replyThirdError

  // ログインユーザー情報
  const [userName, setUserName] = useState<string | null>(null)
  const [userAvatar, setUserAvatar] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // 元の俳句のいいね状態
  const [likeCount, setLikeCount] = useState(0)
  const [isLiked, setIsLiked] = useState(false)

  // 返歌のいいね状態管理
  const [replyLikeCounts, setReplyLikeCounts] = useState<{ [key: string]: number }>({})
  const [userReplyLikes, setUserReplyLikes] = useState<{ [key: string]: boolean }>({})
  const [bestReplyId, setBestReplyId] = useState<string | null>(null)
  const [bestReplyUpdating, setBestReplyUpdating] = useState<string | null>(null)

  // データを取得・再取得するための関数をここで定義
  const fetchData = async (targetId: string) => {
    try {
      setIsLoading(true)

      // 1. ユーザー情報の取得
      const { data: { user } } = await supabase.auth.getUser()
      const authUserId = user?.id ?? null
      setCurrentUserId(authUserId)

      if (authUserId) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles_3')
          .select('username, avatar_url')
          .eq('id', authUserId)
          .maybeSingle()

        if (profileError) {
          console.error('プロフィール取得エラー:', profileError)
        }

        if (profile && profile.username) {
          setUserName(profile.username)
          setUserAvatar(profile.avatar_url)
        } else {
          setUserName(null)
          setUserAvatar(null)
        }
      } else {
        setUserName(null)
        setUserAvatar(null)
      }

      // 2. 俳句データの取得
      const { data: haikuData, error: haikuError } = await supabase
        .from('haikus_2')
        .select('*')
        .eq('id', targetId)
        .maybeSingle()

      if (haikuError) {
        console.error('俳句取得エラー:', haikuError)
      }

      if (!haikuData) {
        setHaiku(null)
        setReplies([])
        setReplyLikeCounts({})
        setUserReplyLikes({})
        return
      }

      setHaiku(haikuData)

      // 3. 元の俳句のいいね取得
      const { data: likesData } = await supabase
        .from('likes_2')
        .select('*')
        .eq('haiku_id', targetId)

      if (likesData) {
        setLikeCount(likesData.length)
        if (authUserId) {
          setIsLiked(likesData.some((l) => l.user_id === authUserId))
        } else {
          setIsLiked(false)
        }
      }

      // 4. 返歌データの取得
      const { data: repliesData } = await supabase
        .from('replies_2')
        .select('*')
        .eq('haiku_id', targetId)

      const reversed = repliesData ? [...repliesData].reverse() : []
      setReplies(reversed)

      const { data: bestReply } = await supabase
        .from('haiku_best_replies')
        .select('reply_id')
        .eq('haiku_id', targetId)
        .maybeSingle()
      setBestReplyId(bestReply?.reply_id ? String(bestReply.reply_id) : null)

      // 5. 返歌のいいね取得
      const { data: replyLikesData } = await supabase.from('reply_likes_2').select('*')

      if (replyLikesData && reversed.length > 0) {
        const counts: { [key: string]: number } = {}
        const myLikes: { [key: string]: boolean } = {}

        reversed.forEach((reply) => {
          const targetLikes = replyLikesData.filter((l) => l.reply_id === String(reply.id))
          counts[reply.id] = targetLikes.length

          if (authUserId) {
            const likedByMe = targetLikes.some((l) => l.user_id === authUserId)
            if (likedByMe) {
              myLikes[reply.id] = true
            }
          }
        })

        setReplyLikeCounts(counts)
        setUserReplyLikes(myLikes)
      } else {
        setReplyLikeCounts({})
        setUserReplyLikes({})
      }

    } catch (err) {
      console.error('データ取得エラー:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    const isMounted = { current: true }

    const loadData = async () => {
      await fetchData(id)
    }

    void loadData()

    return () => {
      isMounted.current = false
    }
  }, [id])

  const handleLike = async () => {
    if (!currentUserId) {
      alert('いいねするにはログインが必要です！')
      router.push('/auth')
      return
    }

    if (isLiked) {
      await supabase
        .from('likes_2')
        .delete()
        .eq('haiku_id', id)
        .eq('user_id', currentUserId)

      setIsLiked(false)
      setLikeCount((prev) => Math.max(0, prev - 1))
    } else {
      await supabase.from('likes_2').insert([
        {
          haiku_id: id,
          user_id: currentUserId,
        },
      ])

      setIsLiked(true)
      setLikeCount((prev) => prev + 1)
    }
  }

  const handleReplyLike = async (replyId: string) => {
    if (!currentUserId) {
      alert('いいねするにはログインが必要です！')
      router.push('/auth')
      return
    }

    const isAlreadyLiked = userReplyLikes[replyId]

    if (isAlreadyLiked) {
      await supabase
        .from('reply_likes_2')
        .delete()
        .eq('reply_id', String(replyId))
        .eq('user_id', currentUserId)

      setUserReplyLikes({ ...userReplyLikes, [replyId]: false })
      setReplyLikeCounts({ ...replyLikeCounts, [replyId]: (replyLikeCounts[replyId] || 1) - 1 })
    } else {
      await supabase.from('reply_likes_2').insert([
        {
          reply_id: String(replyId),
          user_id: currentUserId,
        },
      ])

      setUserReplyLikes({ ...userReplyLikes, [replyId]: true })
      setReplyLikeCounts({ ...replyLikeCounts, [replyId]: (replyLikeCounts[replyId] || 0) + 1 })
    }
  }

  const handleBestReply = async (replyId: string) => {
    if (!currentUserId || haiku?.user_id !== currentUserId || bestReplyUpdating) return
    setBestReplyUpdating(replyId)
    const { data, error } = await supabase.rpc('toggle_best_reply', {
      p_haiku_id: id,
      p_reply_id: replyId,
    })
    if (error) {
      console.error('ベスト返歌更新エラー:', error)
      alert('ベスト返歌を更新できませんでした。')
    } else {
      setBestReplyId(data ? String(data) : null)
    }
    setBestReplyUpdating(null)
  }

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isReplyValid) return
    if (!userName || !currentUserId) {
      alert('返歌を詠むにはログインが必要です！')
      router.push('/auth')
      return
    }

    const { error } = await supabase.from('replies_2').insert([
      {
        haiku_id: id,
        user_id: currentUserId,
        author: userName,
        avatar_url: userAvatar,
        second_line: secondLine,
        third_line: thirdLine,
        created_at: new Date().toISOString(),
      },
    ])

    if (error) {
      alert(`保存エラー: ${error.message}`)
    } else {
      setSecondLine('')
      setThirdLine('')
      setIsReplyFormOpen(false)
      void fetchData(id) // ここで定義済みの fetchData を安全に呼び出す
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

  if (isLoading && !haiku) {
    return <div style={{ backgroundColor: 'var(--page-background)', color: 'var(--foreground)', minHeight: '100vh', padding: '20px' }}>読み込み中...</div>
  }

  if (!haiku) {
    return <div style={{ backgroundColor: 'var(--page-background)', color: 'var(--foreground)', minHeight: '100vh', padding: '20px' }}>俳句が見つかりませんでした。</div>
  }

  return (
    <div style={{ backgroundColor: 'var(--page-background)', color: 'var(--foreground)', minHeight: '100vh', paddingBottom: '80px' }}>
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        
        {/* 戻るボタン */}
        <button 
          onClick={() => router.back()} 
          style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', marginBottom: '20px', fontSize: '0.95rem' }}
        >
          ← 戻る
        </button>

        {/* 元の俳句 */}
        <div style={{ 
          backgroundColor: 'var(--surface)',
          borderRadius: '16px', 
          padding: '20px', 
          border: '1px solid var(--border)',
          boxShadow: '0 4px 12px var(--shadow)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
            {haiku.avatar_url ? (
              <Avatar
                src={haiku.avatar_url} 
                name={haiku.author}
                size={40}
                frame={haiku.user_id ? avatarFrames[haiku.user_id] : null}
                onClick={() => haiku.user_id && router.push(`/user/${haiku.user_id}`)}
                style={{ cursor: 'pointer' }}
              />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--surface-elevated)' }} />
            )}
            <div>
              <div 
                onClick={() => haiku.user_id && router.push(`/user/${haiku.user_id}`)}
                style={{ fontWeight: 'bold', fontSize: '0.95rem', cursor: 'pointer', color: 'var(--foreground)' }}
              >
                {haiku.author || '名無し'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                {formatDate(haiku.created_at)}
              </div>
            </div>
          </div>

          <div style={{ 
            marginBottom: '20px', 
            color: 'var(--foreground)',
            textAlign: 'center'
          }}>
            {haiku.joshi && (
              <div style={{ fontSize: '0.95rem', color: 'var(--foreground-muted)', marginBottom: '12px', fontStyle: 'italic' }}>
                {haiku.joshi}
              </div>
            )}
            <div style={{ display: 'inline-block', textAlign: 'left' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '0px' }}>{haiku.first_line}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '30px' }}>{haiku.second_line}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 'bold', lineHeight: '1.8', letterSpacing: '2px', marginLeft: '60px' }}>{haiku.third_line}</div>
            </div>
          </div>

          {haiku.description && (
            <div style={{ 
              backgroundColor: 'var(--surface-elevated)',
              padding: '14px', 
              borderRadius: '10px', 
              marginBottom: '20px', 
              fontSize: '0.9rem', 
              color: 'var(--foreground)',
              lineHeight: '1.6',
              borderLeft: '3px solid var(--primary)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)', marginBottom: '4px', fontWeight: 'bold' }}>句の解説・想い</div>
              {haiku.description}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button
              onClick={handleLike}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isLiked ? 'var(--primary)' : 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem'
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{isLiked ? '❤️' : '🤍'}</span> <span>{likeCount}</span>
            </button>
            <ShareButton
              title={`${haiku.author || '名無しの歌人'}の俳句`}
              text={`${haiku.first_line} ${haiku.second_line} ${haiku.third_line}`}
              path={`/haiku/${id}`}
            />

            <button
              onClick={() => setIsReplyFormOpen(!isReplyFormOpen)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: isReplyFormOpen ? 'var(--primary)' : 'var(--foreground-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.95rem',
                fontWeight: isReplyFormOpen ? 'bold' : 'normal'
              }}
            >
              💬 返歌を詠む
            </button>
          </div>
        </div>

        {/* 返歌フォーム */}
        {isReplyFormOpen && (
          <section style={{ marginBottom: '30px', backgroundColor: 'var(--surface)', padding: '20px', borderRadius: '16px', border: '1px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--primary)' }}>返歌を詠む（下の句 7・7）</h3>
              <button 
                onClick={() => setIsReplyFormOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--foreground-muted)', cursor: 'pointer', fontSize: '1rem' }}
              >
                ✕ 閉じる
              </button>
            </div>
            
            <form onSubmit={handleReplySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <input 
                  type="text" 
                  placeholder="四句 (3〜10文字)" 
                  value={secondLine} 
                  onChange={(e) => setSecondLine(e.target.value)} 
                  maxLength={10}
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--foreground-muted)' }}>{replySecondLength}/10文字</span>
                  <span style={{ color: replySecondError ? 'var(--danger)' : 'transparent' }}>{replySecondError || ' '}</span>
                </div>
              </div>
              <div>
                <input 
                  type="text" 
                  placeholder="結句 (3〜10文字)" 
                  value={thirdLine} 
                  onChange={(e) => setThirdLine(e.target.value)} 
                  maxLength={10}
                  required 
                  style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--input-background)', color: 'var(--foreground)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.8rem' }}>
                  <span style={{ color: 'var(--foreground-muted)' }}>{replyThirdLength}/10文字</span>
                  <span style={{ color: replyThirdError ? 'var(--danger)' : 'transparent' }}>{replyThirdError || ' '}</span>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={!isReplyValid}
                style={{ 
                  marginTop: '5px', 
                  padding: '12px', 
                  borderRadius: '8px', 
                  backgroundColor: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  fontWeight: 'bold', 
                  border: 'none', 
                  cursor: isReplyValid ? 'pointer' : 'not-allowed',
                  opacity: isReplyValid ? 1 : 0.6
                }}
              >
                {userName ? `${userName} として返歌を投稿する` : '返歌を投稿する'}
              </button>
            </form>
          </section>
        )}

        {/* 返歌一覧 */}
        <section>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>返歌一覧 ({replies.length})</h2>
          {replies.length === 0 ? (
            <p style={{ color: 'var(--foreground-muted)', fontSize: '0.95rem' }}>まだ返歌はありません。最初の返歌（7・7）を詠んでみましょう！</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {replies.map((reply) => {
                const isReplyLiked = userReplyLikes[reply.id] || false
                const replyCount = replyLikeCounts[reply.id] || 0
                const isBestReply = bestReplyId === String(reply.id)

                return (
                  <div key={reply.id} style={{ backgroundColor: 'var(--surface)', borderRadius: '16px', padding: '20px', border: isBestReply ? '1px solid var(--primary)' : '1px solid var(--border)' }}>
                    {isBestReply && <div style={{ color: 'var(--primary)', fontWeight: 'bold', marginBottom: 10 }}>金選・ベスト返歌</div>}
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {reply.avatar_url && (
                          <Avatar
                            src={reply.avatar_url}
                            name={reply.author}
                            size={28}
                            frame={avatarFrames[reply.user_id]}
                          />
                        )}
                        <span style={{ color: 'var(--foreground)', fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {reply.author || '名無し'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--foreground-muted)' }}>
                        {formatDate(reply.created_at)}
                      </div>
                    </div>

                    <div style={{ padding: '10px 0 15px 0', textAlign: 'left', lineHeight: '1.8' }}>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', marginLeft: 0 }}>{reply.second_line}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', marginLeft: '1.4rem' }}>{reply.third_line}</div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', alignItems: 'center' }}>
                      <button
                        onClick={() => handleReplyLike(reply.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: isReplyLiked ? 'var(--primary)' : 'var(--foreground-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.95rem'
                        }}
                      >
                        <span style={{ fontSize: '1.1rem' }}>{isReplyLiked ? '❤️' : '🤍'}</span> <span>{replyCount}</span>
                      </button>
                      {haiku?.user_id === currentUserId && reply.user_id !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => handleBestReply(reply.id)}
                          disabled={bestReplyUpdating !== null}
                          className={isBestReply ? 'gold-button' : 'soft-button'}
                          style={{ marginLeft: 'auto', padding: '7px 12px', cursor: bestReplyUpdating ? 'wait' : 'pointer' }}
                        >
                          {isBestReply ? '選出を解除' : 'ベスト返歌に選ぶ'}
                        </button>
                      )}
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
