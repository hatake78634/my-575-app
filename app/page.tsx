'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

import Header from './components/Header'
import HaikuCard, {
  Haiku,
} from './components/HaikuCard'
import PostModal from './components/PostModal'
import BottomNav from './components/BottomNav'
import TimelineTabs, {
  TimelineTab,
} from './components/TimelineTabs'

import { useAuth } from './hooks/useAuth'
import { useAvatarFrames } from './hooks/useAvatarFrames'

// =============================
// 型
// =============================

type LikeRow = {
  haiku_id: string
  user_id: string
  created_at?: string | null
}

type ProfileCreatedAt = {
  id: string
  created_at: string | null
}

type ScoredHaiku = {
  haiku: Haiku
  score: number
  totalLikes: number
  recent3: number
  previous3: number
  recent6: number
  recent24: number
  acceleration: number
  ageHours: number
  isNewUser: boolean
  isNewPost: boolean
}

type HaikuLoadResult = {
  requestId: number
  targetUserId: string | null
  status: 'success' | 'empty' | 'error'
  haikus: Haiku[]
  likeRows: LikeRow[]
  likeCounts: Record<string, number>
  userLikes: Record<string, boolean>
  profileCreatedAt: ProfileCreatedAt[]
}

type CompetitiveStatusState = {
  userId: string
  rating: number
  remaining: number
}

type CompetitiveStatusResult = {
  requestId: number
  targetUserId: string
  status: 'success' | 'error'
  rating: number
  remaining: number
}

// =============================
// みつける設定
// =============================

const NEW_USER_DAYS = 14

const NEW_USER_POST_HOURS = 48

const DISCOVER_REFRESH_MINUTES = 30

// =============================
// 勝負句設定
// =============================

const MAX_COMPETITIVE_PER_DAY = 3

const COMPETITIVE_HOURS = 48

const getTodayJstRange = () => {
  const now =
    new Date()

  const jstNow =
    new Date(
      now.getTime() +
        9 *
          60 *
          60 *
          1000
    )

  const year =
    jstNow.getUTCFullYear()

  const month =
    jstNow.getUTCMonth()

  const day =
    jstNow.getUTCDate()

  const startMs =
    Date.UTC(
      year,
      month,
      day,
      0,
      0,
      0
    ) -
    9 *
      60 *
      60 *
      1000

  const endMs =
    startMs +
    24 *
      60 *
      60 *
      1000

  return {
    start:
      new Date(
        startMs
      ).toISOString(),

    end:
      new Date(
        endMs
      ).toISOString(),
  }
}

export default function Home() {
  const router = useRouter()

  // =============================
  // ログイン情報
  // =============================

  const {
    userId,
    userName,
    userAvatar,
    loading: authLoading,
  } = useAuth()

  // =============================
  // タイムライン
  // =============================

  const [
    activeTab,
    setActiveTab,
  ] = useState<TimelineTab>('new')

  // =============================
  // 俳句
  // =============================

  const [
    haikus,
    setHaikus,
  ] = useState<Haiku[]>([])

  const avatarFrames = useAvatarFrames(
    haikus.map((haiku) => haiku.user_id)
  )

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)

  const haikuRequestIdRef =
    useRef(0)

  const [
    loadedHaikusUserId,
    setLoadedHaikusUserId,
  ] = useState<
    string | null | undefined
  >(undefined)

  const timelineLoading =
    isLoading ||
    loadedHaikusUserId !== userId

  // =============================
  // 歌人情報
  // =============================

  const [
    profileCreatedAt,
    setProfileCreatedAt,
  ] = useState<ProfileCreatedAt[]>([])

  // =============================
  // 勝負句
  // =============================

  const [
    competitiveStatusState,
    setCompetitiveStatusState,
  ] = useState<
    CompetitiveStatusState | null
  >(null)

  const competitiveRequestIdRef =
    useRef(0)

  const competitiveRemaining =
    userId &&
    competitiveStatusState?.userId ===
      userId
      ? competitiveStatusState.remaining
      : MAX_COMPETITIVE_PER_DAY

  // =============================
  // 贔屓
  // =============================

  const [
    favoriteUsersState,
    setFavoriteUsersState,
  ] = useState<{
    userId: string
    ids: string[]
  } | null>(null)

  const favoriteRequestUserIdRef =
    useRef<string | null>(null)

  const favoriteRequestsRef =
    useRef<
      Map<string, Promise<string[]>>
    >(new Map())

  const favoriteStateMatchesUser =
    Boolean(userId) &&
    favoriteUsersState?.userId ===
      userId

  const favoriteUserIds =
    favoriteStateMatchesUser &&
    favoriteUsersState
      ? favoriteUsersState.ids
      : []

  const favoriteLoaded =
    !userId ||
    favoriteStateMatchesUser

  const favoriteLoading =
    Boolean(userId) &&
    !favoriteLoaded

  // =============================
  // 雅
  // =============================

  const [
    likeRows,
    setLikeRows,
  ] = useState<LikeRow[]>([])

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
  // 投稿
  // =============================

  const [
    isModalOpen,
    setIsModalOpen,
  ] = useState(false)

  const [nowMs, setNowMs] =
    useState<number | null>(null)

  useEffect(() => {
    let intervalId:
      | number
      | null = null

    const frameId =
      window.requestAnimationFrame(
        () => {
          setNowMs(Date.now())

          intervalId =
            window.setInterval(
              () => {
                setNowMs(Date.now())
              },
              60 * 1000
            )
        }
      )

    return () => {
      window.cancelAnimationFrame(
        frameId
      )

      if (intervalId !== null) {
        window.clearInterval(
          intervalId
        )
      }
    }
  }, [])

  // =============================
  // 30分固定推薦
  // =============================

  const discoverTimeBucket =
    nowMs === null
      ? null
      : Math.floor(
          nowMs /
            (
              DISCOVER_REFRESH_MINUTES *
              60 *
              1000
            )
        )

  // =============================
  // 疑似乱数
  // =============================

  const pseudoRandom = (
    value: string
  ) => {
    let hash = 0

    for (
      let i = 0;
      i < value.length;
      i++
    ) {
      hash =
        (
          hash * 31 +
          value.charCodeAt(i)
        ) >>> 0
    }

    return (
      (hash % 10000) /
      10000
    )
  }

  // =============================
  // rating → 勝負句ボーダー
  // =============================

  const getBattleBorder = (
    rating: number
  ) => {
    // 初花
    if (rating < 1100) {
      return 1
    }

    // 若葉
    if (rating < 1250) {
      return 2
    }

    // 詠士
    if (rating < 1450) {
      return 3
    }

    // 詠匠
    if (rating < 1700) {
      return 4
    }

    // 歌豪
    if (rating < 2000) {
      return 6
    }

    // 歌聖・歌仙
    return 8
  }

  // =============================
  // rating・今日の勝負句数
  // =============================

  const loadCompetitiveStatus =
    useCallback(async (
      targetUserId: string
    ): Promise<CompetitiveStatusResult> => {
      const requestId =
        ++competitiveRequestIdRef.current

      try {
        // rating

        const {
          data: profile,
          error:
            profileError,
        } = await supabase
          .from('profiles_3')
          .select('rating')
          .eq(
            'id',
            targetUserId
          )
          .maybeSingle()

        if (
          profileError
        ) {
          console.error(
            'rating取得エラー:',
            profileError
          )
        }

        const rating =
          typeof profile?.rating ===
          'number'
            ? profile.rating
            : 1000

        // 今日の勝負句数

        const {
          start,
          end,
        } = getTodayJstRange()

        const {
          data:
            todayCompetitive,
          error:
            competitiveError,
        } = await supabase
          .from('haikus_2')
          .select('id')
          .eq(
            'user_id',
            targetUserId
          )
          .eq(
            'is_competitive',
            true
          )
          .gte(
            'battle_started_at',
            start
          )
          .lt(
            'battle_started_at',
            end
          )

        if (
          competitiveError
        ) {
          console.error(
            '勝負句数取得エラー:',
            competitiveError
          )

          return {
            requestId,
            targetUserId,
            status: 'error',
            rating: 1000,
            remaining:
              MAX_COMPETITIVE_PER_DAY,
          }
        }

        const used =
          todayCompetitive?.length ??
          0

        return {
          requestId,
          targetUserId,
          status: 'success',
          rating,
          remaining:
            Math.max(
              MAX_COMPETITIVE_PER_DAY -
                used,
              0
            ),
        }
      } catch (error) {
        console.error(
          '勝負句状態取得エラー:',
          error
        )

        return {
          requestId,
          targetUserId,
          status: 'error',
          rating: 1000,
          remaining:
            MAX_COMPETITIVE_PER_DAY,
        }
      }
    }, [])

  const applyCompetitiveStatusResult =
    useCallback((
      result: CompetitiveStatusResult
    ) => {
      if (
        result.requestId !==
        competitiveRequestIdRef.current
      ) {
        return
      }

      if (
        result.status ===
        'error'
      ) {
        return
      }

      setCompetitiveStatusState({
        userId: result.targetUserId,
        rating: result.rating,
        remaining: result.remaining,
      })
    }, [])

  // =============================
  // 俳句・札・雅・プロフィール
  // =============================

  const loadHaikus = useCallback(async (
    targetUserId: string | null
  ): Promise<HaikuLoadResult> => {
    const requestId =
      ++haikuRequestIdRef.current

    try {
      // -------------------------
      // ① 俳句
      // -------------------------

      const {
        data: haikuData,
        error: haikuError,
      } = await supabase
        .from('haikus_2')
        .select('*')
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

        return {
          requestId,
          targetUserId,
          status: 'empty',
          haikus: [],
          likeRows: [],
          likeCounts: {},
          userLikes: {},
          profileCreatedAt: [],
        }
      }

      const loadedHaikus =
        (haikuData ??
          []) as Haiku[]

      // -------------------------
      // ② 札との紐付け
      // -------------------------

      const {
        data: haikuTagData,
        error:
          haikuTagError,
      } = await supabase
        .from('haiku_tags')
        .select(
          'haiku_id, tag_id'
        )

      if (
        haikuTagError
      ) {
        console.error(
          '札紐付け取得エラー:',
          haikuTagError
        )
      }

      const tagLinks =
        haikuTagData ??
        []

      const tagIds = [
        ...new Set(
          tagLinks.map(
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
        tagIds.length > 0
      ) {
        const {
          data,
          error:
            tagError,
        } = await supabase
          .from('tags')
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

      // -------------------------
      // ③ 句に札を付与
      // -------------------------

      const haikusWithTags:
        Haiku[] =
        loadedHaikus.map(
          (haiku) => {
            const links =
              tagLinks.filter(
                (link) =>
                  String(
                    link.haiku_id
                  ) ===
                  String(
                    haiku.id
                  )
              )

            const tags =
              links
                .map(
                  (link) => {
                    const tag =
                      tagData.find(
                        (item) =>
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

      // -------------------------
      // ④ 雅
      // -------------------------

      const {
        data: likesData,
        error:
          likesError,
      } = await supabase
        .from('likes_2')
        .select(
          'haiku_id, user_id, created_at'
        )

      if (
        likesError
      ) {
        console.error(
          '雅取得エラー:',
          likesError
        )
      }

      const likes =
        (likesData ??
          []) as LikeRow[]

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
            likes.filter(
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
            targetUserId
          ) {
            myLikes[
              haiku.id
            ] =
              haikuLikes.some(
                (like) =>
                  like.user_id ===
                  targetUserId
              )
          }
        }
      )

      // -------------------------
      // ⑤ 歌人登録日時
      // -------------------------

      const {
        data:
          profileData,
        error:
          profileError,
      } = await supabase
        .from('profiles_3')
        .select(
          'id, created_at'
        )

      if (
        profileError
      ) {
        console.error(
          '歌人登録日時取得エラー:',
          profileError
        )
      }

      return {
        requestId,
        targetUserId,
        status: 'success',
        haikus: haikusWithTags,
        likeRows: likes,
        likeCounts: counts,
        userLikes: myLikes,
        profileCreatedAt:
          (profileData ??
            []) as ProfileCreatedAt[],
      }
    } catch (error) {
      console.error(
        'データ取得エラー:',
        error
      )

      return {
        requestId,
        targetUserId,
        status: 'error',
        haikus: [],
        likeRows: [],
        likeCounts: {},
        userLikes: {},
        profileCreatedAt: [],
      }
    }
  }, [])

  const applyHaikuLoadResult =
    useCallback((
      result: HaikuLoadResult
    ) => {
      if (
        result.requestId !==
        haikuRequestIdRef.current
      ) {
        return
      }

      if (
        result.status ===
        'success'
      ) {
        setHaikus(result.haikus)
        setLikeRows(result.likeRows)
        setLikeCounts(result.likeCounts)
        setUserLikes(result.userLikes)
        setProfileCreatedAt(
          result.profileCreatedAt
        )
      } else if (
        result.status ===
        'empty'
      ) {
        setHaikus([])
      } else {
        setUserLikes({})
      }

      setLoadedHaikusUserId(
        result.targetUserId
      )
      setIsLoading(false)
    }, [])

  // =============================
  // 贔屓
  // =============================

  const loadFavoriteUsers =
    useCallback(async (
      targetUserId: string
    ) => {
      favoriteRequestUserIdRef.current =
        targetUserId

      const existingRequest =
        favoriteRequestsRef.current.get(
          targetUserId
        )

      if (existingRequest) {
        return existingRequest
      }

      const request = (async () => {
        const {
          data,
          error,
        } = await supabase
          .from('follows')
          .select(
            'following_id'
          )
          .eq(
            'follower_id',
            targetUserId
          )

        if (
          error
        ) {
          console.error(
            '贔屓取得エラー:',
            error
          )

          return []
        }

        return [
          ...new Set(
            (
              data ??
              []
            ).map(
              (follow) =>
                String(
                  follow.following_id
                )
            )
          ),
        ]
      })().catch((error) => {
        console.error(
          '贔屓取得処理エラー:',
          error
        )

        return []
      })

      favoriteRequestsRef.current.set(
        targetUserId,
        request
      )

      try {
        return await request
      } finally {
        if (
          favoriteRequestsRef.current.get(
            targetUserId
          ) === request
        ) {
          favoriteRequestsRef.current.delete(
            targetUserId
          )
        }
      }
    }, [])

  // =============================
  // 初回読み込み
  // =============================

  useEffect(() => {
    if (
      authLoading
    ) {
      return
    }

    void loadHaikus(
      userId
    ).then((result) => {
      applyHaikuLoadResult(result)
    })

    if (
      userId
    ) {
      void loadCompetitiveStatus(
        userId
      ).then((result) => {
        applyCompetitiveStatusResult(
          result
        )
      })

      void loadFavoriteUsers(
        userId
      ).then((ids) => {
        if (
          favoriteRequestUserIdRef.current ===
          userId
        ) {
          setFavoriteUsersState({
            userId,
            ids,
          })
        }
      })
    } else {
      ++competitiveRequestIdRef.current

      favoriteRequestUserIdRef.current =
        null
    }
  }, [
    applyCompetitiveStatusResult,
    applyHaikuLoadResult,
    authLoading,
    loadFavoriteUsers,
    loadCompetitiveStatus,
    loadHaikus,
    userId,
  ])

  // =============================
  // 贔屓タブ
  // =============================

  useEffect(() => {
    if (
      activeTab !==
      'favorite'
    ) {
      return
    }

    if (
      !userId
    ) {
      return
    }

    void loadFavoriteUsers(
      userId
    ).then((ids) => {
      if (
        favoriteRequestUserIdRef.current ===
        userId
      ) {
        setFavoriteUsersState({
          userId,
          ids,
        })
      }
    })
  }, [
    activeTab,
    loadFavoriteUsers,
    userId,
  ])

  // =============================
  // みつける用スコア
  // =============================

  const scoredHaikus =
    useMemo(() => {
      if (nowMs === null) {
        return []
      }

      const now = nowMs

      return haikus.map(
        (
          haiku
        ): ScoredHaiku => {
          const haikuLikes =
            likeRows.filter(
              (like) =>
                String(
                  like.haiku_id
                ) ===
                String(
                  haiku.id
                )
            )

          const createdTime =
            haiku.created_at
              ? new Date(
                  haiku.created_at
                ).getTime()
              : now

          const ageHours =
            Math.max(
              0,
              (
                now -
                createdTime
              ) /
                (
                  1000 *
                  60 *
                  60
                )
            )

          let recent3 = 0
          let previous3 = 0
          let recent6 = 0
          let recent24 = 0

          haikuLikes.forEach(
            (like) => {
              if (
                !like.created_at
              ) {
                return
              }

              const likeTime =
                new Date(
                  like.created_at
                ).getTime()

              const hoursAgo =
                (
                  now -
                  likeTime
                ) /
                (
                  1000 *
                  60 *
                  60
                )

              if (
                hoursAgo >=
                  0 &&
                hoursAgo <=
                  3
              ) {
                recent3++
              }

              if (
                hoursAgo >
                  3 &&
                hoursAgo <=
                  6
              ) {
                previous3++
              }

              if (
                hoursAgo >=
                  0 &&
                hoursAgo <=
                  6
              ) {
                recent6++
              }

              if (
                hoursAgo >=
                  0 &&
                hoursAgo <=
                  24
              ) {
                recent24++
              }
            }
          )

          const acceleration =
            recent3 -
            previous3

          const freshness =
            Math.max(
              0,
              24 -
                ageHours
            ) *
            0.15

          let discoveryBonus =
            0

          if (
            haikuLikes.length ===
            0
          ) {
            discoveryBonus =
              3
          } else if (
            haikuLikes.length <=
            2
          ) {
            discoveryBonus =
              1.5
          }

          const profile =
            profileCreatedAt.find(
              (item) =>
                String(
                  item.id
                ) ===
                String(
                  haiku.user_id
                )
            )

          let isNewUser =
            false

          if (
            profile?.created_at
          ) {
            const profileTime =
              new Date(
                profile.created_at
              ).getTime()

            const accountAgeDays =
              (
                now -
                profileTime
              ) /
              (
                1000 *
                60 *
                60 *
                24
              )

            isNewUser =
              accountAgeDays >=
                0 &&
              accountAgeDays <=
                NEW_USER_DAYS
          }

          const isNewPost =
            ageHours <=
            NEW_USER_POST_HOURS

          const ownPostPenalty =
            userId &&
            String(
              haiku.user_id
            ) ===
              String(
                userId
              )
              ? 2
              : 0

          const randomBonus =
            pseudoRandom(
              `${discoverTimeBucket}-${haiku.id}`
            ) *
            3

          const score =
            haikuLikes.length +
            recent6 *
              3 +
            recent24 +
            acceleration *
              4 +
            freshness +
            discoveryBonus +
            randomBonus -
            ownPostPenalty

          return {
            haiku,
            score,
            totalLikes:
              haikuLikes.length,
            recent3,
            previous3,
            recent6,
            recent24,
            acceleration,
            ageHours,
            isNewUser,
            isNewPost,
          }
        }
      )
    }, [
      haikus,
      likeRows,
      profileCreatedAt,
      userId,
      discoverTimeBucket,
      nowMs,
    ])

  // =============================
  // みつける 60/20/10/10
  // =============================

  const discoverHaikus =
    useMemo(() => {
      if (
        scoredHaikus.length ===
        0
      ) {
        return []
      }

      const targetCount =
        scoredHaikus.length

      let trendCount =
        Math.floor(
          targetCount *
            0.6
        )

      let discoveryCount =
        Math.floor(
          targetCount *
            0.2
        )

      let newcomerCount =
        Math.floor(
          targetCount *
            0.1
        )

      let randomCount =
        targetCount -
        trendCount -
        discoveryCount -
        newcomerCount

      if (
        targetCount >=
        4
      ) {
        discoveryCount =
          Math.max(
            discoveryCount,
            1
          )

        newcomerCount =
          Math.max(
            newcomerCount,
            1
          )

        randomCount =
          Math.max(
            randomCount,
            1
          )

        trendCount =
          Math.max(
            targetCount -
              discoveryCount -
              newcomerCount -
              randomCount,
            1
          )
      }

      const selected:
        ScoredHaiku[] = []

      const selectedIds =
        new Set<string>()

      const addCandidate = (
        item: ScoredHaiku
      ) => {
        const id =
          String(
            item.haiku.id
          )

        if (
          selectedIds.has(
            id
          )
        ) {
          return false
        }

        selectedIds.add(
          id
        )

        selected.push(
          item
        )

        return true
      }

      // -------------------------
      // 勢い枠
      // -------------------------

      const trendPool = [
        ...scoredHaikus,
      ].sort(
        (a, b) =>
          b.score -
          a.score
      )

      let added =
        0

      for (
        const item
        of trendPool
      ) {
        if (
          added >=
          trendCount
        ) {
          break
        }

        if (
          addCandidate(
            item
          )
        ) {
          added++
        }
      }

      // -------------------------
      // 発掘枠
      // -------------------------

      const discoveryPool =
        scoredHaikus
          .filter(
            (item) =>
              item.totalLikes <=
              2
          )
          .sort(
            (a, b) => {
              const aRandom =
                pseudoRandom(
                  `${discoverTimeBucket}-discovery-${a.haiku.id}`
                )

              const bRandom =
                pseudoRandom(
                  `${discoverTimeBucket}-discovery-${b.haiku.id}`
                )

              return (
                bRandom -
                aRandom
              )
            }
          )

      added =
        0

      for (
        const item
        of discoveryPool
      ) {
        if (
          added >=
          discoveryCount
        ) {
          break
        }

        if (
          addCandidate(
            item
          )
        ) {
          added++
        }
      }

      // -------------------------
      // 新人枠
      // -------------------------

      const newcomerPool =
        scoredHaikus
          .filter(
            (item) =>
              item.isNewUser &&
              item.isNewPost
          )
          .sort(
            (a, b) =>
              b.score -
              a.score
          )

      added =
        0

      for (
        const item
        of newcomerPool
      ) {
        if (
          added >=
          newcomerCount
        ) {
          break
        }

        if (
          addCandidate(
            item
          )
        ) {
          added++
        }
      }

      // -------------------------
      // ランダム枠
      // -------------------------

      const randomPool = [
        ...scoredHaikus,
      ].sort(
        (a, b) => {
          const aRandom =
            pseudoRandom(
              `${discoverTimeBucket}-random-${a.haiku.id}`
            )

          const bRandom =
            pseudoRandom(
              `${discoverTimeBucket}-random-${b.haiku.id}`
            )

          return (
            bRandom -
            aRandom
          )
        }
      )

      added =
        0

      for (
        const item
        of randomPool
      ) {
        if (
          added >=
          randomCount
        ) {
          break
        }

        if (
          addCandidate(
            item
          )
        ) {
          added++
        }
      }

      // -------------------------
      // 不足分補充
      // -------------------------

      if (
        selected.length <
        targetCount
      ) {
        for (
          const item
          of trendPool
        ) {
          if (
            selected.length >=
            targetCount
          ) {
            break
          }

          addCandidate(
            item
          )
        }
      }

      // -------------------------
      // 最終順序
      // -------------------------

      selected.sort(
        (a, b) => {
          const aRandom =
            pseudoRandom(
              `${discoverTimeBucket}-final-${a.haiku.id}`
            )

          const bRandom =
            pseudoRandom(
              `${discoverTimeBucket}-final-${b.haiku.id}`
            )

          return (
            bRandom -
            aRandom
          )
        }
      )

      return selected.map(
        (item) =>
          item.haiku
      )
    }, [
      scoredHaikus,
      discoverTimeBucket,
    ])

  // =============================
  // 雅
  // =============================

  const handleLike = async (
    haikuId: string
  ) => {
    if (
      !userId
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

      if (error) {
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

      setLikeRows(
        (prev) => {
          if (nowLiked) {
            return [
              ...prev,
              {
                haiku_id:
                  haikuId,
                user_id:
                  userId,
                created_at:
                  new Date()
                    .toISOString(),
              },
            ]
          }

          return prev.filter(
            (like) =>
              !(
                String(
                  like.haiku_id
                ) ===
                  String(
                    haikuId
                  ) &&
                like.user_id ===
                  userId
              )
          )
        }
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
  // 勝負句投稿準備
  // =============================

  const prepareCompetitivePost =
    async () => {
      if (
        !userId
      ) {
        throw new Error(
          'ログイン情報がありません'
        )
      }

      // -------------------------
      // ratingを最新取得
      // -------------------------

      const {
        data: profile,
        error:
          profileError,
      } = await supabase
        .from('profiles_3')
        .select('rating')
        .eq(
          'id',
          userId
        )
        .single()

      if (
        profileError
      ) {
        throw profileError
      }

      const rating =
        typeof profile.rating ===
        'number'
          ? profile.rating
          : 1000

      // -------------------------
      // 今日の勝負句数
      // -------------------------

      const {
        start,
        end,
      } = getTodayJstRange()

      const {
        data:
          todayCompetitive,
        error:
          countError,
      } = await supabase
        .from('haikus_2')
        .select('id')
        .eq(
          'user_id',
          userId
        )
        .eq(
          'is_competitive',
          true
        )
        .gte(
          'battle_started_at',
          start
        )
        .lt(
          'battle_started_at',
          end
        )

      if (
        countError
      ) {
        throw countError
      }

      const used =
        todayCompetitive?.length ??
        0

      if (
        used >=
        MAX_COMPETITIVE_PER_DAY
      ) {
        throw new Error(
          '今日の勝負句は3句すべて詠み終えています'
        )
      }

      // -------------------------
      // ボーダー決定
      // -------------------------

      const border =
        getBattleBorder(
          rating
        )

      const startedAt =
        new Date()

      const endsAt =
        new Date(
          startedAt.getTime() +
            COMPETITIVE_HOURS *
              60 *
              60 *
              1000
        )

      return {
        rating,
        border,

        startedAt:
          startedAt.toISOString(),

        endsAt:
          endsAt.toISOString(),
      }
    }

  // =============================
  // 投稿
  // =============================

  const handlePost = async (
    data: {
      firstLine: string
      secondLine: string
      thirdLine: string
      joshi: string
      description: string
      tags: string[]
      isCompetitive: boolean
    }
  ) => {
    if (
      !userId ||
      !userName
    ) {
      alert(
        '一句詠むにはログインが必要です！'
      )

      router.push(
        '/auth'
      )

      return
    }

    // =============================
    // 勝負句情報
    // =============================

    let battleInfo: {
      rating: number
      border: number
      startedAt: string
      endsAt: string
    } | null =
      null

    if (
      data.isCompetitive
    ) {
      try {
        battleInfo =
          await prepareCompetitivePost()
      } catch (error) {
        console.error(
          '勝負句準備エラー:',
          error
        )

        const message =
          error instanceof
          Error
            ? error.message
            : '勝負句を投稿できませんでした'

        alert(
          message
        )

        throw error
      }
    }

    // =============================
    // ① 句
    // =============================

    const createdAt =
      new Date()
        .toISOString()

    const {
      data:
        insertedHaiku,

      error:
        haikuError,
    } = await supabase
      .from('haikus_2')
      .insert([
        {
          first_line:
            data.firstLine,

          second_line:
            data.secondLine,

          third_line:
            data.thirdLine,

          joshi:
            data.joshi,

          description:
            data.description,

          author:
            userName,

          avatar_url:
            userAvatar ??
            '',

          user_id:
            userId,

          created_at:
            createdAt,

          // ---------------------
          // 勝負句
          // ---------------------

          is_competitive:
            data.isCompetitive,

          battle_started_at:
            battleInfo
              ?.startedAt ??
            null,

          battle_ends_at:
            battleInfo
              ?.endsAt ??
            null,

          battle_like_border:
            battleInfo
              ?.border ??
            null,

          battle_rating_before:
            battleInfo
              ?.rating ??
            null,

          battle_rating_change:
            null,

          battle_resolved:
            false,
        },
      ])
      .select('id')
      .single()

    if (
      haikuError
    ) {
      console.error(
        '投稿エラー:',
        haikuError
      )

      throw haikuError
    }

    if (
      !insertedHaiku
    ) {
      throw new Error(
        '投稿した句のIDを取得できませんでした'
      )
    }

    // =============================
    // ② 札
    // =============================

    for (
      const tagName
      of data.tags
    ) {
      const {
        data:
          existingTag,

        error:
          searchTagError,
      } = await supabase
        .from('tags')
        .select('id')
        .eq(
          'name',
          tagName
        )
        .maybeSingle()

      if (
        searchTagError
      ) {
        throw searchTagError
      }

      let tagId:
        number

      if (
        existingTag
      ) {
        tagId =
          existingTag.id
      } else {
        const {
          data:
            newTag,

          error:
            createTagError,
        } = await supabase
          .from('tags')
          .insert([
            {
              name:
                tagName,
            },
          ])
          .select('id')
          .single()

        if (
          createTagError
        ) {
          throw createTagError
        }

        if (
          !newTag
        ) {
          throw new Error(
            '札の作成に失敗しました'
          )
        }

        tagId =
          newTag.id
      }

      const {
        error:
          linkError,
      } = await supabase
        .from(
          'haiku_tags'
        )
        .insert([
          {
            haiku_id:
              String(
                insertedHaiku.id
              ),

            tag_id:
              tagId,
          },
        ])

      if (
        linkError
      ) {
        throw linkError
      }
    }

    // =============================
    // ③ 投稿後再読込
    // =============================

    setActiveTab(
      'new'
    )

    setIsLoading(true)

    const haikuReload =
      loadHaikus(userId).then(
        (result) => {
          applyHaikuLoadResult(
            result
          )
        }
      )

    const competitiveReload =
      loadCompetitiveStatus(
        userId
      ).then((result) => {
        applyCompetitiveStatusResult(
          result
        )
      })

    await Promise.all([
      haikuReload,
      competitiveReload,
    ])
  }

  // =============================
  // 投稿ボタン
  // =============================

  const handleOpenPost =
    () => {
      if (
        !userId ||
        !userName
      ) {
        alert(
          '一句詠むにはログインが必要です！'
        )

        router.push(
          '/auth'
        )

        return
      }

      setIsModalOpen(
        true
      )
    }

  // =============================
  // タブ変更
  // =============================

  const handleTabChange =
    (
      tab:
        TimelineTab
    ) => {
      if (
        tab ===
          'favorite' &&
        !userId
      ) {
        alert(
          '贔屓を見るにはログインが必要です！'
        )

        router.push(
          '/auth'
        )

        return
      }

      setActiveTab(
        tab
      )
    }

  // =============================
  // 俳句一覧
  // =============================

  const renderHaikuList =
    (
      list:
        Haiku[]
    ) => {
      return (
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
          {list.map(
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
                  userId
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
      )
    }

  // =============================
  // タイムライン
  // =============================

  const renderTimeline =
    () => {
      if (
        timelineLoading ||
        authLoading ||
        nowMs === null
      ) {
        return (
          <p
            style={{
              textAlign:
                'center',

              color:
                'var(--foreground-muted)',

              marginTop:
                '40px',
            }}
          >
            読み込み中...
          </p>
        )
      }

      // =========================
      // みつける
      // =========================

      if (
        activeTab ===
        'discover'
      ) {
        if (
          discoverHaikus.length ===
          0
        ) {
          return (
            <div
              style={{
                textAlign:
                  'center',

                padding:
                  '60px 20px',

                color:
                  'var(--foreground-muted)',
              }}
            >
              まだ見つけられる句がありません。
            </div>
          )
        }

        return renderHaikuList(
          discoverHaikus
        )
      }

      // =========================
      // 贔屓
      // =========================

      if (
        activeTab ===
        'favorite'
      ) {
        if (
          favoriteLoading ||
          !favoriteLoaded
        ) {
          return (
            <p
              style={{
                textAlign:
                  'center',

                color:
                  'var(--foreground-muted)',

                marginTop:
                  '40px',
              }}
            >
              贔屓の句を集めています...
            </p>
          )
        }

        const favoriteHaikus =
          haikus.filter(
            (haiku) =>
              haiku.user_id &&
              favoriteUserIds.includes(
                String(
                  haiku.user_id
                )
              )
          )

        if (
          favoriteUserIds.length ===
          0
        ) {
          return (
            <div
              style={{
                textAlign:
                  'center',

                padding:
                  '60px 20px',
              }}
            >
              <div
                style={{
                  fontSize:
                    '2rem',

                  marginBottom:
                    '15px',
                }}
              >
                🌸
              </div>

              <div
                style={{
                  color:
                    'var(--foreground)',

                  fontWeight:
                    'bold',

                  marginBottom:
                    '15px',
                }}
              >
                まだ贔屓の歌人はいません
              </div>

              <button
                type="button"

                onClick={() =>
                  router.push(
                    '/find'
                  )
                }

                style={{
                  backgroundColor:
                    'var(--primary)',

                  color:
                    'var(--page-background)',

                  border:
                    'none',

                  borderRadius:
                    '20px',

                  padding:
                    '9px 18px',

                  fontWeight:
                    'bold',

                  cursor:
                    'pointer',
                }}
              >
                歌人を探す
              </button>
            </div>
          )
        }

        if (
          favoriteHaikus.length ===
          0
        ) {
          return (
            <div
              style={{
                textAlign:
                  'center',

                padding:
                  '60px 20px',

                color:
                  'var(--foreground-muted)',
              }}
            >
              贔屓の歌人の句は
              <br />
              まだありません。
            </div>
          )
        }

        return renderHaikuList(
          favoriteHaikus
        )
      }

      // =========================
      // 新着
      // =========================

      if (
        haikus.length ===
        0
      ) {
        return (
          <p
            style={{
              textAlign:
                'center',

              color:
                'var(--foreground-muted)',

              marginTop:
                '40px',
            }}
          >
            まだ句は詠まれていません。
          </p>
        )
      }

      return renderHaikuList(
        haikus
      )
    }

  // =============================
  // 画面
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
        <Header
          userId={
            userId
          }

          userName={
            userName
          }

          userAvatar={
            userAvatar
          }
        />

        <TimelineTabs
          activeTab={
            activeTab
          }

          onChange={
            handleTabChange
          }
        />

        {renderTimeline()}

        <button
          type="button"

          onClick={
            handleOpenPost
          }

          aria-label="一句詠む"

          style={{
            position:
              'fixed',

            bottom:
              '90px',

            right:
              '25px',

            width:
              '60px',

            height:
              '60px',

            borderRadius:
              '50%',

            backgroundColor:
              'var(--primary)',

            color:
              'var(--page-background)',

            fontSize:
              '2rem',

            border:
              'none',

            boxShadow:
              '0 4px 15px color-mix(in srgb, var(--primary) 40%, transparent)',

            cursor:
              'pointer',

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            zIndex:
              100,
          }}
        >
          ＋
        </button>
      </main>

      <PostModal
        isOpen={
          isModalOpen
        }

        onClose={() =>
          setIsModalOpen(
            false
          )
        }

        onSubmit={
          handlePost
        }

        competitiveRemaining={
          competitiveRemaining
        }
      />

      <BottomNav
        currentUserId={
          userId
        }
      />
    </div>
  )
}
