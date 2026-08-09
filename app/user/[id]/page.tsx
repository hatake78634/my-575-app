'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  useParams,
  useRouter,
} from 'next/navigation'

import { supabase } from '../../../lib/supabase'

import HaikuCard, {
  Haiku,
} from '../../components/HaikuCard'

import BottomNav from '../../components/BottomNav'

import { useAuth } from '../../hooks/useAuth'

// =============================
// 型
// =============================

type Profile = {
  id: string
  username: string | null
  bio: string | null
  avatar_url: string | null
  rating: number | null
}

// =============================
// rating → 位
// =============================

function getRankName(
  rating: number
) {
  if (rating < 1100) {
    return '初花'
  }

  if (rating < 1250) {
    return '若葉'
  }

  if (rating < 1450) {
    return '詠士'
  }

  if (rating < 1700) {
    return '詠匠'
  }

  if (rating < 2000) {
    return '歌豪'
  }

  return '歌聖'
}

// =============================
// 位の記号
// =============================

function getRankSymbol(
  rank: string
) {
  if (rank === '初花') {
    return '🌸'
  }

  if (rank === '若葉') {
    return '🌿'
  }

  if (rank === '詠士') {
    return '🖌️'
  }

  if (rank === '詠匠') {
    return '📜'
  }

  if (rank === '歌豪') {
    return '🔥'
  }

  return '✨'
}

// =============================
// ページ
// =============================

export default function UserPage() {
  const params = useParams()
  const router = useRouter()

  const userId =
    params.id as string

  const {
    userId:
      currentUserId,

    loading:
      authLoading,
  } = useAuth()

  // =============================
  // プロフィール
  // =============================

  const [
    profile,
    setProfile,
  ] = useState<Profile | null>(
    null
  )

  const [
    haikus,
    setHaikus,
  ] = useState<Haiku[]>([])

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  // =============================
  // 贔屓・好読者・歌友
  // =============================

  const [
    isFollowing,
    setIsFollowing,
  ] = useState(false)

  const [
    followingCount,
    setFollowingCount,
  ] = useState(0)

  const [
    followerCount,
    setFollowerCount,
  ] = useState(0)

  const [
    mutualCount,
    setMutualCount,
  ] = useState(0)

  // =============================
  // 雅
  // =============================

  const [
    likeCounts,
    setLikeCounts,
  ] = useState<{
    [key: string]: number
  }>({})

  const [
    userLikes,
    setUserLikes,
  ] = useState<{
    [key: string]: boolean
  }>({})

  // =============================
  // データ取得
  // =============================

  const fetchUserData =
    async () => {
      if (!userId) {
        return
      }

      setIsLoading(true)

      try {
        // -------------------------
        // プロフィール
        // -------------------------

        const {
          data:
            profileData,

          error:
            profileError,
        } = await supabase
          .from(
            'profiles_3'
          )
          .select(
            'id, username, bio, avatar_url, rating'
          )
          .eq(
            'id',
            userId
          )
          .maybeSingle()

        if (
          profileError
        ) {
          console.error(
            'プロフィール取得エラー:',
            profileError
          )
        }

        setProfile(
          profileData ??
            null
        )

        // -------------------------
        // この歌人の俳句
        // -------------------------

        const {
          data:
            haikuData,

          error:
            haikuError,
        } = await supabase
          .from(
            'haikus_2'
          )
          .select('*')
          .eq(
            'user_id',
            userId
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            }
          )

        if (
          haikuError
        ) {
          console.error(
            '俳句取得エラー:',
            haikuError
          )
        }

        const loadedHaikus =
          (haikuData ??
            []) as Haiku[]

        // -------------------------
        // 札
        // -------------------------

        const haikuIds =
          loadedHaikus.map(
            (haiku) =>
              String(
                haiku.id
              )
          )

        let haikusWithTags =
          loadedHaikus

        if (
          haikuIds.length >
          0
        ) {
          const {
            data:
              linkData,

            error:
              linkError,
          } = await supabase
            .from(
              'haiku_tags'
            )
            .select(
              'haiku_id, tag_id'
            )
            .in(
              'haiku_id',
              haikuIds
            )

          if (
            linkError
          ) {
            console.error(
              '札紐付け取得エラー:',
              linkError
            )
          }

          const links =
            linkData ??
            []

          const tagIds = [
            ...new Set(
              links.map(
                (link) =>
                  link.tag_id
              )
            ),
          ]

          let tagData: {
            id: number
            name: string
          }[] = []

          if (
            tagIds.length >
            0
          ) {
            const {
              data,
              error:
                tagError,
            } = await supabase
              .from(
                'tags'
              )
              .select(
                'id, name'
              )
              .in(
                'id',
                tagIds
              )

            if (
              tagError
            ) {
              console.error(
                '札取得エラー:',
                tagError
              )
            }

            tagData =
              (data ??
                []) as {
                id: number
                name: string
              }[]
          }

          haikusWithTags =
            loadedHaikus.map(
              (haiku) => {
                const haikuLinks =
                  links.filter(
                    (link) =>
                      String(
                        link.haiku_id
                      ) ===
                      String(
                        haiku.id
                      )
                  )

                const tags =
                  haikuLinks
                    .map(
                      (link) => {
                        const tag =
                          tagData.find(
                            (
                              item
                            ) =>
                              item.id ===
                              link.tag_id
                          )

                        return tag?.name
                      }
                    )
                    .filter(
                      (
                        name
                      ): name is string =>
                        Boolean(
                          name
                        )
                    )

                return {
                  ...haiku,
                  tags,
                }
              }
            )
        }

        setHaikus(
          haikusWithTags
        )

        // -------------------------
        // 贔屓
        // この人 → 誰か
        // -------------------------

        const {
          data:
            followingData,

          error:
            followingError,
        } = await supabase
          .from(
            'follows'
          )
          .select(
            'following_id'
          )
          .eq(
            'follower_id',
            userId
          )

        if (
          followingError
        ) {
          console.error(
            '贔屓取得エラー:',
            followingError
          )
        }

        // -------------------------
        // 好読者
        // 誰か → この人
        // -------------------------

        const {
          data:
            followerData,

          error:
            followerError,
        } = await supabase
          .from(
            'follows'
          )
          .select(
            'follower_id'
          )
          .eq(
            'following_id',
            userId
          )

        if (
          followerError
        ) {
          console.error(
            '好読者取得エラー:',
            followerError
          )
        }

        const followingIds =
          followingData?.map(
            (follow) =>
              follow.following_id
          ) ?? []

        const followerIds =
          followerData?.map(
            (follow) =>
              follow.follower_id
          ) ?? []

        setFollowingCount(
          followingIds.length
        )

        setFollowerCount(
          followerIds.length
        )

        // -------------------------
        // 歌友
        // -------------------------

        const mutualIds =
          followingIds.filter(
            (id) =>
              followerIds.includes(
                id
              )
          )

        setMutualCount(
          mutualIds.length
        )

        // -------------------------
        // ログイン中の人が
        // この歌人を贔屓しているか
        // -------------------------

        if (
          currentUserId &&
          currentUserId !==
            userId
        ) {
          const {
            data:
              followData,

            error:
              followError,
          } = await supabase
            .from(
              'follows'
            )
            .select('*')
            .eq(
              'follower_id',
              currentUserId
            )
            .eq(
              'following_id',
              userId
            )
            .maybeSingle()

          if (
            followError
          ) {
            console.error(
              '贔屓状態取得エラー:',
              followError
            )
          }

          setIsFollowing(
            Boolean(
              followData
            )
          )
        } else {
          setIsFollowing(
            false
          )
        }

        // -------------------------
        // 雅
        // -------------------------

        const {
          data:
            likesData,

          error:
            likesError,
        } = await supabase
          .from(
            'likes_2'
          )
          .select('*')

        if (
          likesError
        ) {
          console.error(
            '雅取得エラー:',
            likesError
          )
        }

        const allLikes =
          likesData ??
          []

        const counts: {
          [key: string]:
            number
        } = {}

        const myLikes: {
          [key: string]:
            boolean
        } = {}

        haikusWithTags.forEach(
          (haiku) => {
            const haikuLikes =
              allLikes.filter(
                (like) =>
                  String(
                    like.haiku_id
                  ) ===
                  String(
                    haiku.id
                  )
              )

            counts[
              haiku.id
            ] =
              haikuLikes.length

            if (
              currentUserId
            ) {
              myLikes[
                haiku.id
              ] =
                haikuLikes.some(
                  (like) =>
                    like.user_id ===
                    currentUserId
                )
            }
          }
        )

        setLikeCounts(
          counts
        )

        setUserLikes(
          myLikes
        )
      } catch (error) {
        console.error(
          '歌人録取得エラー:',
          error
        )
      } finally {
        setIsLoading(
          false
        )
      }
    }

  // =============================
  // 初回取得
  // =============================

  useEffect(() => {
    if (
      authLoading
    ) {
      return
    }

    void fetchUserData()
  }, [
    userId,
    currentUserId,
    authLoading,
  ])

  // =============================
  // 贔屓
  // =============================

  const handleFollowToggle =
    async () => {
      if (
        !currentUserId
      ) {
        alert(
          '贔屓に加えるにはログインが必要です！'
        )

        router.push(
          '/auth'
        )

        return
      }

      if (
        currentUserId ===
        userId
      ) {
        return
      }

      try {
        if (
          isFollowing
        ) {
          // -------------------------
          // 贔屓解除
          // -------------------------

          const {
            error,
          } = await supabase
            .from(
              'follows'
            )
            .delete()
            .eq(
              'follower_id',
              currentUserId
            )
            .eq(
              'following_id',
              userId
            )

          if (
            error
          ) {
            console.error(
              '贔屓解除エラー:',
              error
            )

            return
          }

          setIsFollowing(
            false
          )

          setFollowerCount(
            (prev) =>
              Math.max(
                prev - 1,
                0
              )
          )
        } else {
          // -------------------------
          // 贔屓追加
          // -------------------------

          const {
            error,
          } = await supabase
            .from(
              'follows'
            )
            .insert([
              {
                follower_id:
                  currentUserId,

                following_id:
                  userId,
              },
            ])

          if (
            error
          ) {
            console.error(
              '贔屓追加エラー:',
              error
            )

            return
          }

          setIsFollowing(
            true
          )

          setFollowerCount(
            (prev) =>
              prev + 1
          )
        }

        await fetchUserData()
      } catch (error) {
        console.error(
          '贔屓処理エラー:',
          error
        )
      }
    }

  // =============================
  // 雅
  // =============================

  const handleLike =
    async (
      haikuId: string
    ) => {
      if (
        !currentUserId
      ) {
        alert(
          '雅を贈るにはログインが必要です！'
        )

        router.push(
          '/auth'
        )

        return
      }

      const isAlreadyLiked =
        userLikes[
          haikuId
        ] ??
        false

      try {
        if (
          isAlreadyLiked
        ) {
          const {
            error,
          } = await supabase
            .from(
              'likes_2'
            )
            .delete()
            .eq(
              'haiku_id',
              String(
                haikuId
              )
            )
            .eq(
              'user_id',
              currentUserId
            )

          if (
            error
          ) {
            console.error(
              '雅取り消しエラー:',
              error
            )

            return
          }

          setUserLikes(
            (prev) => ({
              ...prev,

              [haikuId]:
                false,
            })
          )

          setLikeCounts(
            (prev) => ({
              ...prev,

              [haikuId]:
                Math.max(
                  (
                    prev[
                      haikuId
                    ] ?? 1
                  ) - 1,
                  0
                ),
            })
          )
        } else {
          const now =
            new Date()
              .toISOString()

          const {
            error,
          } = await supabase
            .from(
              'likes_2'
            )
            .insert([
              {
                haiku_id:
                  String(
                    haikuId
                  ),

                user_id:
                  currentUserId,

                created_at:
                  now,
              },
            ])

          if (
            error
          ) {
            console.error(
              '雅エラー:',
              error
            )

            return
          }

          setUserLikes(
            (prev) => ({
              ...prev,

              [haikuId]:
                true,
            })
          )

          setLikeCounts(
            (prev) => ({
              ...prev,

              [haikuId]:
                (
                  prev[
                    haikuId
                  ] ?? 0
                ) + 1,
            })
          )
        }
      } catch (error) {
        console.error(
          '雅処理エラー:',
          error
        )
      }
    }

  // =============================
  // ローディング
  // =============================

  if (
    isLoading ||
    authLoading
  ) {
    return (
      <div
        style={{
          minHeight:
            '100vh',

          backgroundColor:
            '#121212',

          color:
            '#777',

          display:
            'flex',

          justifyContent:
            'center',

          alignItems:
            'center',
        }}
      >
        歌人録を開いています...
      </div>
    )
  }

  // =============================
  // rating・位
  // =============================

  const rating =
    profile?.rating ??
    1000

  const rank =
    getRankName(
      rating
    )

  // =============================
  // 表示
  // =============================

  return (
    <div
      style={{
        backgroundColor:
          '#121212',

        color:
          '#fff',

        minHeight:
          '100vh',

        paddingBottom:
          '100px',
      }}
    >
      <main
        style={{
          maxWidth:
            '600px',

          margin:
            '0 auto',

          padding:
            '20px',
        }}
      >
        {/* =====================
            戻る
        ===================== */}

        <button
          type="button"

          onClick={() =>
            router.push(
              '/'
            )
          }

          style={{
            background:
              'none',

            border:
              'none',

            color:
              '#888',

            cursor:
              'pointer',

            marginBottom:
              '20px',

            fontSize:
              '0.9rem',
          }}
        >
          ← ホームへ
        </button>

        {/* =====================
            プロフィール
        ===================== */}

        <section
          style={{
            marginBottom:
              '25px',
          }}
        >
          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'flex-start',

              gap:
                '15px',
            }}
          >
            {/* 左 */}

            <div
              style={{
                display:
                  'flex',

                gap:
                  '15px',

                alignItems:
                  'center',
              }}
            >
              {/* アイコン */}

              {profile?.avatar_url ? (
                <Image
                  src={
                    profile.avatar_url
                  }

                  alt={`${
                    profile.username ??
                    '歌人'
                  }のアイコン`}

                  width={80}
                  height={80}

                  style={{
                    width:
                      '80px',

                    height:
                      '80px',

                    borderRadius:
                      '50%',

                    objectFit:
                      'cover',

                    border:
                      '2px solid #333',
                  }}

                  unoptimized
                />
              ) : (
                <div
                  style={{
                    width:
                      '80px',

                    height:
                      '80px',

                    borderRadius:
                      '50%',

                    backgroundColor:
                      '#444',
                  }}
                />
              )}

              {/* 名前・番付 */}

              <div>
                <h1
                  style={{
                    fontSize:
                      '1.35rem',

                    margin: 0,

                    marginBottom:
                      '6px',
                  }}
                >
                  {profile?.username ??
                    '名無し'}
                </h1>

                {/* 位・rating */}

                <button
                  type="button"

                  onClick={() =>
                    router.push(
                      '/ranking'
                    )
                  }

                  style={{
                    backgroundColor:
                      '#211f19',

                    border:
                      '1px solid #554923',

                    borderRadius:
                      '20px',

                    padding:
                      '5px 9px',

                    color:
                      '#ffda79',

                    fontSize:
                      '0.75rem',

                    cursor:
                      'pointer',

                    marginBottom:
                      '6px',
                  }}
                >
                  {getRankSymbol(
                    rank
                  )}
                  {' '}
                  <strong>
                    {rank}
                  </strong>
                  {' ・ '}
                  {rating}
                  {' '}
                  rating
                </button>

                <div
                  style={{
                    fontSize:
                      '0.72rem',

                    color:
                      '#777',
                  }}
                >
                  ID:{' '}
                  {userId.slice(
                    0,
                    8
                  )}
                </div>
              </div>
            </div>

            {/* 右 */}

            {currentUserId ===
            userId ? (
              <button
                type="button"

                onClick={() =>
                  router.push(
                    '/profile'
                  )
                }

                style={
                  secondaryButton
                }
              >
                情報編集
              </button>
            ) : currentUserId ? (
              <button
                type="button"

                onClick={
                  handleFollowToggle
                }

                style={{
                  ...secondaryButton,

                  backgroundColor:
                    isFollowing
                      ? 'transparent'
                      : '#ffda79',

                  color:
                    isFollowing
                      ? '#fff'
                      : '#121212',

                  border:
                    isFollowing
                      ? '1px solid #444'
                      : 'none',
                }}
              >
                {isFollowing
                  ? '贔屓中'
                  : '贔屓に加える'}
              </button>
            ) : null}
          </div>

          {/* =====================
              自己紹介
          ===================== */}

          <p
            style={{
              color:
                '#ccc',

              fontSize:
                '0.9rem',

              lineHeight:
                '1.7',

              whiteSpace:
                'pre-wrap',

              marginTop:
                '20px',

              marginBottom:
                '20px',
            }}
          >
            {profile?.bio ||
              '自己紹介はまだありません。'}
          </p>

          {/* =====================
              実績・関係
          ===================== */}

          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(4, 1fr)',

              gap:
                '5px',

              borderTop:
                '1px solid #2a2a2a',

              borderBottom:
                '1px solid #2a2a2a',

              padding:
                '16px 0',
            }}
          >
            <StatItem
              number={
                haikus.length
              }

              label="詠句"
            />

            <StatItem
              number={
                followingCount
              }

              label="贔屓"
            />

            <StatItem
              number={
                followerCount
              }

              label="好読者"
            />

            <StatItem
              number={
                mutualCount
              }

              label="歌友"
            />
          </div>
        </section>

        {/* =====================
            投稿一覧
        ===================== */}

        <div
          style={{
            borderBottom:
              '1px solid #2a2a2a',

            marginBottom:
              '20px',
          }}
        >
          <div
            style={{
              display:
                'inline-block',

              padding:
                '0 3px 10px',

              borderBottom:
                '2px solid #ffda79',

              fontSize:
                '0.95rem',

              fontWeight:
                'bold',
            }}
          >
            詠んだ句
          </div>
        </div>

        {/* =====================
            俳句
        ===================== */}

        {haikus.length ===
        0 ? (
          <div
            style={{
              textAlign:
                'center',

              color:
                '#777',

              padding:
                '50px 20px',
            }}
          >
            まだ句は詠まれていません。
          </div>
        ) : (
          <div
            style={{
              display:
                'flex',

              flexDirection:
                'column',

              gap:
                '15px',
            }}
          >
            {haikus.map(
              (haiku) => (
                <HaikuCard
                  key={
                    haiku.id
                  }

                  haiku={
                    haiku
                  }

                  isLiked={
                    userLikes[
                      haiku.id
                    ] ??
                    false
                  }

                  likeCount={
                    likeCounts[
                      haiku.id
                    ] ??
                    0
                  }

                  onLike={
                    handleLike
                  }

                  currentUserId={
                    currentUserId
                  }
                />
              )
            )}
          </div>
        )}
      </main>

      <BottomNav
        currentUserId={
          currentUserId
        }
      />
    </div>
  )
}

// =============================
// 小さい表示部品
// =============================

type StatItemProps = {
  number: number
  label: string
}

function StatItem({
  number,
  label,
}: StatItemProps) {
  return (
    <div
      style={{
        textAlign:
          'center',
      }}
    >
      <div
        style={{
          fontWeight:
            'bold',

          fontSize:
            '1rem',

          color:
            '#fff',
        }}
      >
        {number}
      </div>

      <div
        style={{
          color:
            '#888',

          fontSize:
            '0.72rem',

          marginTop:
            '3px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// =============================
// ボタン
// =============================

const secondaryButton = {
  backgroundColor:
    'transparent',

  border:
    '1px solid #444',

  color:
    '#fff',

  padding:
    '7px 14px',

  borderRadius:
    '20px',

  fontSize:
    '0.82rem',

  cursor:
    'pointer',

  fontWeight:
    'bold',
}