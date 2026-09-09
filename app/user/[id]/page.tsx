'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  useParams,
  useRouter,
} from 'next/navigation'

import { supabase } from '../../../lib/supabase'

import HaikuCard, {
  Haiku,
} from '../../components/HaikuCard'

import BottomNav from '../../components/BottomNav'
import Avatar from '../../components/Avatar'

import { useAuth } from '../../hooks/useAuth'
import { useAvatarFrames } from '../../hooks/useAvatarFrames'

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

type LoadedUserDataTarget = {
  targetProfileId: string
  viewerUserId: string | null
}

type UserDataLoadResult = {
  requestId: number
  targetProfileId: string
  viewerUserId: string | null
  status: 'success' | 'error'
  profile: Profile | null
  haikus: Haiku[]
  followingCount: number
  followerCount: number
  mutualCount: number
  isFollowing: boolean
  likeCounts: {
    [key: string]: number
  }
  userLikes: {
    [key: string]: boolean
  }
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

  const avatarFrames = useAvatarFrames([
    profile?.id,
    ...haikus.map((haiku) => haiku.user_id),
  ])

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

  const userDataRequestIdRef =
    useRef(0)

  const [
    loadedUserDataTarget,
    setLoadedUserDataTarget,
  ] = useState<
    LoadedUserDataTarget | null
  >(null)

  const userDataLoading =
    isLoading ||
    loadedUserDataTarget === null ||
    loadedUserDataTarget.targetProfileId !==
      userId ||
    loadedUserDataTarget.viewerUserId !==
      currentUserId

  // =============================
  // データ取得
  // =============================

  const fetchUserData =
    useCallback(async (
      targetProfileId: string,
      viewerUserId: string | null
    ): Promise<UserDataLoadResult> => {
      const requestId =
        ++userDataRequestIdRef.current

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
            targetProfileId
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
            targetProfileId
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
            targetProfileId
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
            targetProfileId
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

        // -------------------------
        // ログイン中の人が
        // この歌人を贔屓しているか
        // -------------------------

        let loadedIsFollowing = false

        if (
          viewerUserId &&
          viewerUserId !==
            targetProfileId
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
              viewerUserId
            )
            .eq(
              'following_id',
              targetProfileId
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

          loadedIsFollowing =
            Boolean(
              followData
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
              viewerUserId
            ) {
              myLikes[
                haiku.id
              ] =
                haikuLikes.some(
                  (like) =>
                    like.user_id ===
                    viewerUserId
                )
            }
          }
        )

        return {
          requestId,
          targetProfileId,
          viewerUserId,
          status: 'success',
          profile:
            profileData ?? null,
          haikus: haikusWithTags,
          followingCount:
            followingIds.length,
          followerCount:
            followerIds.length,
          mutualCount:
            mutualIds.length,
          isFollowing:
            loadedIsFollowing,
          likeCounts: counts,
          userLikes: myLikes,
        }
      } catch (error) {
        console.error(
          '歌人録取得エラー:',
          error
        )

        return {
          requestId,
          targetProfileId,
          viewerUserId,
          status: 'error',
          profile: null,
          haikus: [],
          followingCount: 0,
          followerCount: 0,
          mutualCount: 0,
          isFollowing: false,
          likeCounts: {},
          userLikes: {},
        }
      }
    }, [])

  const applyUserDataResult =
    useCallback((
      result: UserDataLoadResult
    ) => {
      if (
        result.requestId !==
        userDataRequestIdRef.current
      ) {
        return
      }

      setProfile(result.profile)
      setHaikus(result.haikus)
      setFollowingCount(
        result.followingCount
      )
      setFollowerCount(
        result.followerCount
      )
      setMutualCount(
        result.mutualCount
      )
      setIsFollowing(
        result.isFollowing
      )
      setLikeCounts(
        result.likeCounts
      )
      setUserLikes(
        result.userLikes
      )
      setLoadedUserDataTarget({
        targetProfileId:
          result.targetProfileId,
        viewerUserId:
          result.viewerUserId,
      })
      setIsLoading(false)
    }, [])

  // =============================
  // 初回取得
  // =============================

  useEffect(() => {
    if (
      authLoading
    ) {
      return
    }

    if (!userId) {
      ++userDataRequestIdRef.current
      return
    }

    void fetchUserData(
      userId,
      currentUserId
    ).then((result) => {
      applyUserDataResult(
        result
      )
    })
  }, [
    applyUserDataResult,
    authLoading,
    currentUserId,
    fetchUserData,
    userId,
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
        const {
          data,
          error,
        } =
          await supabase.rpc(
            'toggle_follow_with_notifications',
            {
              p_target_user_id:
                userId,
            }
          )

        if (
          error
        ) {
          console.error(
            '贔屓処理エラー:',
            error
          )

          alert(
            error.message ||
              '贔屓の変更に失敗しました'
          )

          return
        }

        const nowFollowing =
          Boolean(
            data
          )

        setIsFollowing(
          nowFollowing
        )

        setFollowerCount(
          (prev) =>
            nowFollowing
              ? prev + 1
              : Math.max(
                  prev - 1,
                  0
                )
        )

        setIsLoading(true)

        const result =
          await fetchUserData(
            userId,
            currentUserId
          )

        applyUserDataResult(
          result
        )
      } catch (error) {
        console.error(
          '贔屓処理エラー:',
          error
        )

        alert(
          '贔屓の変更中にエラーが発生しました'
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

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            'toggle_haiku_like_with_notification',
            {
              p_haiku_id:
                Number(
                  haikuId
                ),
            }
          )

        if (
          error
        ) {
          console.error(
            '雅処理エラー:',
            error
          )

          alert(
            error.message ||
              '雅を変更できませんでした'
          )

          return
        }

        const nowLiked =
          Boolean(
            data
          )

        setUserLikes(
          (prev) => ({
            ...prev,
            [haikuId]:
              nowLiked,
          })
        )

        setLikeCounts(
          (prev) => ({
            ...prev,
            [haikuId]:
              nowLiked
                ? (
                    prev[
                      haikuId
                    ] ??
                    0
                  ) + 1
                : Math.max(
                    (
                      prev[
                        haikuId
                      ] ??
                      1
                    ) - 1,
                    0
                  ),
          })
        )
      } catch (error) {
        console.error(
          '雅処理エラー:',
          error
        )

        alert(
          '雅の変更中にエラーが発生しました'
        )
      }
    }

  // =============================
  // ローディング
  // =============================

  if (
    userDataLoading ||
    authLoading
  ) {
    return (
      <div
        style={{
          minHeight:
            '100vh',

          backgroundColor:
            'var(--page-background)',

          color:
            'var(--foreground-muted)',

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
          'var(--page-background)',

        color:
          'var(--foreground)',

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
              'var(--foreground-muted)',

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

              <Avatar
                src={
                  profile?.avatar_url
                }

                name={
                  profile?.username ??
                  '歌人'
                }

                size={80}

                frame={
                  profile?.id
                    ? avatarFrames[profile.id]
                    : null
                }

                style={{
                  border:
                    '2px solid var(--border)',
                }}
              />

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
                      'var(--surface-elevated)',

                    border:
                      '1px solid var(--border)',

                    borderRadius:
                      '20px',

                    padding:
                      '5px 9px',

                    color:
                      'var(--primary)',

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
                      'var(--foreground-muted)',
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
                      : 'var(--primary)',

                  color:
                    isFollowing
                      ? 'var(--foreground)'
                      : 'var(--page-background)',

                  border:
                    isFollowing
                      ? '1px solid var(--border)'
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
                'var(--foreground)',

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
                '1px solid var(--border)',

              borderBottom:
                '1px solid var(--border)',

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
              '1px solid var(--border)',

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
                '2px solid var(--primary)',

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
                'var(--foreground-muted)',

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

                  avatarFrame={
                    haiku.user_id
                      ? avatarFrames[haiku.user_id]
                      : null
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
            'var(--foreground)',
        }}
      >
        {number}
      </div>

      <div
        style={{
          color:
            'var(--foreground-muted)',

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
    '1px solid var(--border)',

  color:
    'var(--foreground)',

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
