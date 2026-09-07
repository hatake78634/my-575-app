'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import {
  useRouter,
  useSearchParams,
} from 'next/navigation'
import Image from 'next/image'

import { supabase } from '../../lib/supabase'
import BottomNav from '../components/BottomNav'
import HaikuCard, {
  Haiku,
} from '../components/HaikuCard'
import { useAuth } from '../hooks/useAuth'

type SearchTab =
  | 'haiku'
  | 'user'
  | 'tag'

type Profile = {
  id: string
  username: string | null
  avatar_url: string | null
  bio?: string | null
}

type TagResult = {
  id: number
  name: string
  count: number
}

type LikeData = {
  likeCounts: Record<string, number>
  userLikes: Record<string, boolean>
}

type SearchTarget = {
  mode: SearchTab
  query: string
  viewerUserId: string | null
}

type TagTarget = {
  tagName: string
  viewerUserId: string | null
}

type SearchLoadResult = {
  requestId: number
  target: SearchTarget
  status: 'success' | 'error'
  haikus: Haiku[]
  users: Profile[]
  tags: TagResult[]
  likeCounts: Record<string, number>
  userLikes: Record<string, boolean>
}

type TagLoadResult = {
  requestId: number
  target: TagTarget
  status: 'success' | 'error'
  haikus: Haiku[]
  likeCounts: Record<string, number>
  userLikes: Record<string, boolean>
}

function FindPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTag = searchParams.get('tag')

  const {
    userId,
    loading: authLoading,
  } = useAuth()

  // =============================
  // 検索
  // =============================

  const [query, setQuery] =
    useState('')

  const [activeTab, setActiveTab] =
    useState<SearchTab>('haiku')

  // =============================
  // 検索結果
  // =============================

  const [haikuResults, setHaikuResults] =
    useState<Haiku[]>([])

  const [userResults, setUserResults] =
    useState<Profile[]>([])

  const [tagResults, setTagResults] =
    useState<TagResult[]>([])

  // =============================
  // 選択した札
  // =============================

  const selectedTag = urlTag

  const [
    selectedTagHaikus,
    setSelectedTagHaikus,
  ] = useState<Haiku[]>([])

  // =============================
  // 雅
  // =============================

  const [likeCounts, setLikeCounts] =
    useState<{
      [key: string]: number
    }>({})

  const [userLikes, setUserLikes] =
    useState<{
      [key: string]: boolean
    }>({})

  const [loadedSearchTarget, setLoadedSearchTarget] =
    useState<SearchTarget | null>(null)

  const [loadedTagTarget, setLoadedTagTarget] =
    useState<TagTarget | null>(null)

  const searchRequestIdRef = useRef(0)
  const tagRequestIdRef = useRef(0)

  const effectiveActiveTab: SearchTab =
    selectedTag ? 'tag' : activeTab
  const effectiveQuery = selectedTag ?? query
  const trimmedEffectiveQuery =
    effectiveQuery.trim()

  // =============================
  // URLの ?tag=春 を読む
  // =============================

  // =============================
  // 検索文字が変わったら検索
  // =============================

  // =============================
  // 検索
  // =============================

  // =============================
  // 句検索
  // =============================

  const attachTagsToHaikusData = useCallback(async (
    haikus: Haiku[]
  ): Promise<Haiku[]> => {
      if (
        haikus.length === 0
      ) {
        return []
      }

      const haikuIds =
        haikus.map(
          (haiku) =>
            String(haiku.id)
        )

      const {
        data: links,
        error: linkError,
      } = await supabase
        .from('haiku_tags')
        .select(
          'haiku_id, tag_id'
        )
        .in(
          'haiku_id',
          haikuIds
        )

      if (linkError) {
        console.error(
          '札紐付け取得エラー:',
          linkError
        )

        return haikus
      }

      const tagIds = [
        ...new Set(
          links?.map(
            (link) =>
              link.tag_id
          ) ?? []
        ),
      ]

      if (
        tagIds.length === 0
      ) {
        return haikus.map(
          (haiku) => ({
            ...haiku,
            tags: [],
          })
        )
      }

      const {
        data: tags,
        error: tagError,
      } = await supabase
        .from('tags')
        .select('id, name')
        .in(
          'id',
          tagIds
        )

      if (tagError) {
        console.error(
          '札取得エラー:',
          tagError
        )

        return haikus
      }

      return haikus.map(
        (haiku) => {
          const myLinks =
            links?.filter(
              (link) =>
                String(
                  link.haiku_id
                ) ===
                String(
                  haiku.id
                )
            ) ?? []

          const names =
            myLinks
              .map((link) => {
                const tag =
                  tags?.find(
                    (item) =>
                      item.id ===
                      link.tag_id
                  )

                return tag?.name
              })
              .filter(
                (
                  name
                ): name is string =>
                  Boolean(name)
              )

          return {
            ...haiku,
            tags: names,
          }
        }
      )
  }, [])

  // =============================
  // 雅情報
  // =============================

  const loadLikesData = useCallback(async (
    haikus: Haiku[],
    viewerUserId: string | null
  ): Promise<LikeData> => {
    const counts: Record<string, number> = {}
    const myLikes: Record<string, boolean> = {}

    if (
      haikus.length === 0
    ) {
      return {
        likeCounts: counts,
        userLikes: myLikes,
      }
    }

    const {
      data: likes,
      error,
    } = await supabase
      .from('likes_2')
      .select('*')

    if (error) {
      console.error(
        '雅取得エラー:',
        error
      )

      return {
        likeCounts: counts,
        userLikes: myLikes,
      }
    }

    haikus.forEach(
      (haiku) => {
        const haikuLikes =
          likes?.filter(
            (like) =>
              String(
                like.haiku_id
              ) ===
              String(
                haiku.id
              )
          ) ?? []

        counts[haiku.id] =
          haikuLikes.length

        if (viewerUserId) {
          myLikes[haiku.id] =
            haikuLikes.some(
              (like) =>
                like.user_id ===
                viewerUserId
            )
        }
      }
    )

    return {
      likeCounts: counts,
      userLikes: myLikes,
    }
  }, [])

  const searchHaikus = useCallback(async (
    searchText: string,
    viewerUserId: string | null
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from('haikus_2')
      .select('*')
      .or(
        `first_line.ilike.%${searchText}%,second_line.ilike.%${searchText}%,third_line.ilike.%${searchText}%,joshi.ilike.%${searchText}%,description.ilike.%${searchText}%`
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )

    if (error) {
      console.error(
        '句検索エラー:',
        error
      )

      return {
        status: 'error' as const,
        haikus: [] as Haiku[],
        likeCounts: {},
        userLikes: {},
      }
    }

    const haikus =
      (data ?? []) as Haiku[]

    const haikusWithTags =
      await attachTagsToHaikusData(
        haikus
      )

    const likes = await loadLikesData(
      haikusWithTags,
      viewerUserId
    )

    return {
      status: 'success' as const,
      haikus: haikusWithTags,
      ...likes,
    }
  }, [attachTagsToHaikusData, loadLikesData])

  // =============================
  // 歌人検索
  // =============================

  const searchUsers = useCallback(async (
    searchText: string
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from('profiles_3')
      .select(
        'id, username, avatar_url, bio'
      )
      .ilike(
        'username',
        `%${searchText}%`
      )
      .limit(30)

    if (error) {
      console.error(
        '歌人検索エラー:',
        error
      )

      return {
        status: 'error' as const,
        users: [] as Profile[],
      }
    }

    return {
      status: 'success' as const,
      users: (data ?? []) as Profile[],
    }
  }, [])

  // =============================
  // 札検索
  // =============================

  const searchTags = useCallback(async (
    searchText: string
  ) => {
    const {
      data,
      error,
    } = await supabase
      .from('tags')
      .select('id, name')
      .ilike(
        'name',
        `%${searchText}%`
      )
      .limit(30)

    if (error) {
      console.error(
        '札検索エラー:',
        error
      )

      return {
        status: 'error' as const,
        tags: [] as TagResult[],
      }
    }

    const tags =
      data ?? []

    if (
      tags.length === 0
    ) {
      return {
        status: 'success' as const,
        tags: [] as TagResult[],
      }
    }

    const tagIds =
      tags.map(
        (tag) => tag.id
      )

    // それぞれの札が
    // 何句に使われているか取得
    const {
      data: links,
      error: linkError,
    } = await supabase
      .from('haiku_tags')
      .select(
        'tag_id, haiku_id'
      )
      .in(
        'tag_id',
        tagIds
      )

    if (linkError) {
      console.error(
        '札件数取得エラー:',
        linkError
      )
    }

    const results: TagResult[] =
      tags.map((tag) => {
        const count =
          links?.filter(
            (link) =>
              link.tag_id ===
              tag.id
          ).length ?? 0

        return {
          id: tag.id,
          name: tag.name,
          count,
        }
      })

    results.sort(
      (a, b) =>
        b.count - a.count
    )

    return {
      status: linkError
        ? 'error' as const
        : 'success' as const,
      tags: results,
    }
  }, [])

  // =============================
  // 札を選ぶ
  // =============================

  const runSearch = useCallback(async (
    requestId: number,
    searchText: string,
    tab: SearchTab,
    viewerUserId: string | null
  ): Promise<SearchLoadResult> => {
    const target: SearchTarget = {
      mode: tab,
      query: searchText,
      viewerUserId,
    }
    const empty = {
      requestId,
      target,
      haikus: [] as Haiku[],
      users: [] as Profile[],
      tags: [] as TagResult[],
      likeCounts: {} as Record<string, number>,
      userLikes: {} as Record<string, boolean>,
    }

    if (tab === 'haiku') {
      const result = await searchHaikus(
        searchText,
        viewerUserId
      )
      return {
        ...empty,
        status: result.status,
        haikus: result.haikus,
        likeCounts: result.likeCounts,
        userLikes: result.userLikes,
      }
    }

    if (tab === 'user') {
      const result = await searchUsers(searchText)
      return {
        ...empty,
        status: result.status,
        users: result.users,
      }
    }

    const result = await searchTags(searchText)
    return {
      ...empty,
      status: result.status,
      tags: result.tags,
    }
  }, [searchHaikus, searchTags, searchUsers])

  const applySearchResult = useCallback(
    (result: SearchLoadResult) => {
      if (
        result.requestId !==
        searchRequestIdRef.current
      ) {
        return
      }

      setHaikuResults(result.haikus)
      setUserResults(result.users)
      setTagResults(result.tags)
      setLikeCounts(result.likeCounts)
      setUserLikes(result.userLikes)
      setLoadedSearchTarget(result.target)
    },
    []
  )

  const openTag = (
    tagName: string
  ) => {
    setActiveTab('tag')
    setQuery(tagName)
    router.replace(
      `/find?tag=${encodeURIComponent(
        tagName
      )}`
    )

  }

  // =============================
  // 札から句一覧
  // =============================

  const loadHaikusByTag = useCallback(
    async (
      requestId: number,
      tagName: string,
      viewerUserId: string | null
    ): Promise<TagLoadResult> => {
      const target: TagTarget = {
        tagName,
        viewerUserId,
      }
      const emptyResult = (
        status: 'success' | 'error'
      ): TagLoadResult => ({
        requestId,
        target,
        status,
        haikus: [],
        likeCounts: {},
        userLikes: {},
      })
        // 札ID
        const {
          data: tag,
          error: tagError,
        } = await supabase
          .from('tags')
          .select('id, name')
          .eq(
            'name',
            tagName
          )
          .maybeSingle()

        if (tagError) {
          console.error(
            '札取得エラー:',
            tagError
          )

          return emptyResult('error')
        }

        if (!tag) {
          return emptyResult('success')
        }

        // 札と句の関係
        const {
          data: links,
          error: linkError,
        } = await supabase
          .from('haiku_tags')
          .select('haiku_id')
          .eq(
            'tag_id',
            tag.id
          )

        if (linkError) {
          console.error(
            '札紐付け取得エラー:',
            linkError
          )

          return emptyResult('error')
        }

        const haikuIds =
          links?.map(
            (link) =>
              link.haiku_id
          ) ?? []

        if (
          haikuIds.length === 0
        ) {
          return emptyResult('success')
        }

        // 句本体
        const {
          data: haikuData,
          error: haikuError,
        } = await supabase
          .from('haikus_2')
          .select('*')
          .in(
            'id',
            haikuIds
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          )

        if (haikuError) {
          console.error(
            '札の句取得エラー:',
            haikuError
          )

          return emptyResult('error')
        }

        const loaded =
          (haikuData ??
            []) as Haiku[]

        const withTags =
          await attachTagsToHaikusData(
            loaded
          )

        const likes = await loadLikesData(
          withTags,
          viewerUserId
        )

        return {
          requestId,
          target,
          status: 'success',
          haikus: withTags,
          ...likes,
        }
    },
    [attachTagsToHaikusData, loadLikesData]
  )

  // =============================
  // 句に札を付加
  // =============================

  const applyTagResult = useCallback(
    (result: TagLoadResult) => {
      if (
        result.requestId !==
        tagRequestIdRef.current
      ) {
        return
      }

      setSelectedTagHaikus(result.haikus)
      setLikeCounts(result.likeCounts)
      setUserLikes(result.userLikes)
      setLoadedTagTarget(result.target)
    },
    []
  )

  useEffect(() => {
    const requestId =
      ++searchRequestIdRef.current

    if (
      authLoading ||
      selectedTag ||
      !trimmedEffectiveQuery
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void runSearch(
        requestId,
        trimmedEffectiveQuery,
        effectiveActiveTab,
        userId
      ).then(applySearchResult)
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    applySearchResult,
    authLoading,
    effectiveActiveTab,
    runSearch,
    selectedTag,
    trimmedEffectiveQuery,
    userId,
  ])

  useEffect(() => {
    const requestId =
      ++tagRequestIdRef.current

    if (authLoading || !selectedTag) {
      return
    }

    void loadHaikusByTag(
      requestId,
      selectedTag,
      userId
    ).then(applyTagResult)
  }, [
    applyTagResult,
    authLoading,
    loadHaikusByTag,
    selectedTag,
    userId,
  ])

  const searchTargetMatches =
    loadedSearchTarget?.mode ===
      effectiveActiveTab &&
    loadedSearchTarget.query ===
      trimmedEffectiveQuery &&
    loadedSearchTarget.viewerUserId === userId
  const isSearching =
    !authLoading &&
    !selectedTag &&
    Boolean(trimmedEffectiveQuery) &&
    !searchTargetMatches
  const displayedHaikuResults =
    searchTargetMatches ? haikuResults : []
  const displayedUserResults =
    searchTargetMatches ? userResults : []
  const displayedTagResults =
    searchTargetMatches ? tagResults : []

  const tagTargetMatches =
    Boolean(selectedTag) &&
    loadedTagTarget?.tagName === selectedTag &&
    loadedTagTarget.viewerUserId === userId
  const selectedTagLoading =
    Boolean(selectedTag) &&
    (!tagTargetMatches || authLoading)
  const displayedSelectedTagHaikus =
    tagTargetMatches ? selectedTagHaikus : []

  // =============================
  // 雅を贈る
  // =============================

  const handleLike = async (
    haikuId: string
  ) => {
    if (!userId) {
      alert(
        '雅を贈るにはログインが必要です！'
      )

      router.push('/auth')
      return
    }

    const isLiked =
      userLikes[haikuId] ??
      false

    if (isLiked) {
      const { error } =
        await supabase
          .from('likes_2')
          .delete()
          .eq(
            'haiku_id',
            String(haikuId)
          )
          .eq(
            'user_id',
            userId
          )

      if (error) {
        console.error(
          '雅取り消しエラー:',
          error
        )

        return
      }

      setUserLikes(
        (prev) => ({
          ...prev,
          [haikuId]: false,
        })
      )

      setLikeCounts(
        (prev) => ({
          ...prev,
          [haikuId]:
            Math.max(
              (prev[
                haikuId
              ] ?? 1) - 1,
              0
            ),
        })
      )

      return
    }

    const { error } =
      await supabase
        .from('likes_2')
        .insert([
          {
            haiku_id:
              String(haikuId),
            user_id:
              userId,
          },
        ])

    if (error) {
      console.error(
        '雅エラー:',
        error
      )

      return
    }

    setUserLikes(
      (prev) => ({
        ...prev,
        [haikuId]: true,
      })
    )

    setLikeCounts(
      (prev) => ({
        ...prev,
        [haikuId]:
          (prev[
            haikuId
          ] ?? 0) + 1,
      })
    )
  }

  // =============================
  // タブ変更
  // =============================

  const changeTab = (
    tab: SearchTab
  ) => {
    if (selectedTag) {
      setQuery(effectiveQuery)
    }
    setActiveTab(tab)
    router.replace('/find')
  }

  // =============================
  // 検索内容を消す
  // =============================

  const clearSearch = () => {
    setQuery('')
    searchRequestIdRef.current += 1
    tagRequestIdRef.current += 1

    setHaikuResults([])
    setUserResults([])
    setTagResults([])
    setSelectedTagHaikus([])

    router.replace('/find')
  }

  // =============================
  // 表示
  // =============================

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor:
          '#121212',
        color: '#fff',
        paddingBottom:
          '100px',
      }}
    >
      <main
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px',
        }}
      >
        {/* タイトル */}

        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'space-between',
            marginBottom:
              '20px',
          }}
        >
          <h1
            style={{
              fontSize:
                '1.4rem',
              margin: 0,
            }}
          >
            探す
          </h1>

          <button
            type="button"
            onClick={() =>
              router.push('/')
            }
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
            }}
          >
            ホームへ
          </button>
        </div>

        {/* =====================
            検索欄
        ===================== */}

        <div
          style={{
            display: 'flex',
            alignItems:
              'center',
            backgroundColor:
              '#1e1e1e',
            border:
              '1px solid #333',
            borderRadius:
              '14px',
            padding:
              '0 14px',
            marginBottom:
              '20px',
          }}
        >
          <span
            style={{
              marginRight:
                '8px',
              color: '#888',
            }}
          >
            🔎
          </span>

          <input
            type="text"
            value={effectiveQuery}
            onChange={(e) => {
              setQuery(
                e.target.value
              )

              if (
                selectedTag
              ) {
                router.replace('/find')
              }
            }}
            placeholder={
              effectiveActiveTab ===
              'haiku'
                ? '句を探す'
                : effectiveActiveTab ===
                    'user'
                  ? '歌人を探す'
                  : '札を探す'
            }
            style={{
              flex: 1,
              background:
                'none',
              border: 'none',
              outline: 'none',
              color: '#fff',
              padding:
                '13px 0',
              fontSize:
                '1rem',
            }}
          />

          {effectiveQuery && (
            <button
              type="button"
              onClick={
                clearSearch
              }
              style={{
                background:
                  'none',
                border: 'none',
                color: '#777',
                cursor:
                  'pointer',
                fontSize:
                  '1rem',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* =====================
            タブ
        ===================== */}

        <div
          style={{
            display: 'flex',
            borderBottom:
              '1px solid #2a2a2a',
            marginBottom:
              '25px',
          }}
        >
          <TabButton
            label="句"
            active={
              effectiveActiveTab ===
              'haiku'
            }
            onClick={() =>
              changeTab(
                'haiku'
              )
            }
          />

          <TabButton
            label="歌人"
            active={
              effectiveActiveTab ===
              'user'
            }
            onClick={() =>
              changeTab(
                'user'
              )
            }
          />

          <TabButton
            label="札"
            active={
              effectiveActiveTab ===
              'tag'
            }
            onClick={() =>
              changeTab(
                'tag'
              )
            }
          />
        </div>

        {/* =====================
            検索前
        ===================== */}

        {!trimmedEffectiveQuery &&
          !selectedTag && (
            <EmptySearch
              tab={effectiveActiveTab}
            />
          )}

        {/* =====================
            読み込み
        ===================== */}

        {isSearching && (
          <p
            style={{
              textAlign:
                'center',
              color: '#777',
              padding:
                '30px',
            }}
          >
            探しています...
          </p>
        )}

        {/* =====================
            句検索
        ===================== */}

        {!isSearching &&
          effectiveActiveTab ===
            'haiku' &&
          trimmedEffectiveQuery && (
            <HaikuResults
              haikus={
                displayedHaikuResults
              }
              likeCounts={
                likeCounts
              }
              userLikes={
                userLikes
              }
              onLike={
                handleLike
              }
            />
          )}

        {/* =====================
            歌人検索
        ===================== */}

        {!isSearching &&
          effectiveActiveTab ===
            'user' &&
          trimmedEffectiveQuery && (
            <UserResults
              users={
                displayedUserResults
              }
              onOpen={(
                id
              ) =>
                router.push(
                  `/user/${id}`
                )
              }
            />
          )}

        {/* =====================
            札検索
        ===================== */}

        {!selectedTag &&
          !isSearching &&
          effectiveActiveTab ===
            'tag' &&
          trimmedEffectiveQuery && (
            <TagResults
              tags={
                displayedTagResults
              }
              onOpen={
                openTag
              }
            />
          )}

        {/* =====================
            札詳細
        ===================== */}

        {effectiveActiveTab ===
          'tag' &&
          selectedTag && (
            <div>
              <div
                style={{
                  marginBottom:
                    '20px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setQuery(selectedTag)
                    setActiveTab('tag')
                    router.replace('/find')
                  }}
                  style={{
                    background:
                      'none',
                    border:
                      'none',
                    color:
                      '#888',
                    cursor:
                      'pointer',
                    padding: 0,
                    marginBottom:
                      '12px',
                  }}
                >
                  ← 札検索へ
                </button>

                <h2
                  style={{
                    margin: 0,
                    fontSize:
                      '1.35rem',
                  }}
                >
                  「
                  {selectedTag}
                  」の札
                </h2>

                <div
                  style={{
                    color:
                      '#888',
                    marginTop:
                      '6px',
                    fontSize:
                      '0.8rem',
                  }}
                >
                  {
                    displayedSelectedTagHaikus.length
                  }
                  句
                </div>
              </div>

              {selectedTagLoading ? (
                <p
                  style={{
                    textAlign:
                      'center',
                    color:
                      '#777',
                  }}
                >
                  読み込み中...
                </p>
              ) : (
                <HaikuResults
                  haikus={
                    displayedSelectedTagHaikus
                  }
                  likeCounts={
                    likeCounts
                  }
                  userLikes={
                    userLikes
                  }
                  onLike={
                    handleLike
                  }
                />
              )}
            </div>
          )}
      </main>

      <BottomNav
        currentUserId={
          userId
        }
      />
    </div>
  )
}

// =============================
// 句一覧
// =============================

export default function FindPage() {
  return (
    <Suspense fallback={null}>
      <FindPageContent />
    </Suspense>
  )
}

type HaikuResultsProps = {
  haikus: Haiku[]
  likeCounts: {
    [key: string]: number
  }
  userLikes: {
    [key: string]: boolean
  }
  onLike: (
    haikuId: string
  ) => void
}

function HaikuResults({
  haikus,
  likeCounts,
  userLikes,
  onLike,
}: HaikuResultsProps) {
  if (
    haikus.length === 0
  ) {
    return (
      <EmptyResult text="該当する句はありません。" />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection:
          'column',
        gap: '15px',
      }}
    >
      {haikus.map(
        (haiku) => (
          <HaikuCard
            key={haiku.id}
            haiku={haiku}
            isLiked={
              userLikes[
                haiku.id
              ] ?? false
            }
            likeCount={
              likeCounts[
                haiku.id
              ] ?? 0
            }
            onLike={
              onLike
            }
          />
        )
      )}
    </div>
  )
}

// =============================
// 歌人一覧
// =============================

type UserResultsProps = {
  users: Profile[]
  onOpen: (
    id: string
  ) => void
}

function UserResults({
  users,
  onOpen,
}: UserResultsProps) {
  if (
    users.length === 0
  ) {
    return (
      <EmptyResult text="該当する歌人はいません。" />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection:
          'column',
        gap: '10px',
      }}
    >
      {users.map(
        (user) => (
          <button
            key={user.id}
            type="button"
            onClick={() =>
              onOpen(
                user.id
              )
            }
            style={{
              display:
                'flex',
              alignItems:
                'center',
              gap: '12px',
              width: '100%',
              backgroundColor:
                '#1e1e1e',
              border:
                '1px solid #2a2a2a',
              borderRadius:
                '14px',
              padding:
                '14px',
              cursor:
                'pointer',
              color: '#fff',
              textAlign:
                'left',
            }}
          >
            {user.avatar_url ? (
              <Image
                src={
                  user.avatar_url
                }
                alt=""
                width={46}
                height={46}
                unoptimized
                style={{
                  width:
                    '46px',
                  height:
                    '46px',
                  borderRadius:
                    '50%',
                  objectFit:
                    'cover',
                }}
              />
            ) : (
              <div
                style={{
                  width:
                    '46px',
                  height:
                    '46px',
                  borderRadius:
                    '50%',
                  backgroundColor:
                    '#444',
                  flexShrink: 0,
                }}
              />
            )}

            <div>
              <div
                style={{
                  fontWeight:
                    'bold',
                }}
              >
                {user.username ??
                  '名無し'}
              </div>

              {user.bio && (
                <div
                  style={{
                    color:
                      '#888',
                    fontSize:
                      '0.78rem',
                    marginTop:
                      '4px',
                    maxWidth:
                      '350px',
                    overflow:
                      'hidden',
                    textOverflow:
                      'ellipsis',
                    whiteSpace:
                      'nowrap',
                  }}
                >
                  {user.bio}
                </div>
              )}
            </div>
          </button>
        )
      )}
    </div>
  )
}

// =============================
// 札一覧
// =============================

type TagResultsProps = {
  tags: TagResult[]
  onOpen: (
    name: string
  ) => void
}

function TagResults({
  tags,
  onOpen,
}: TagResultsProps) {
  if (
    tags.length === 0
  ) {
    return (
      <EmptyResult text="該当する札はありません。" />
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection:
          'column',
        gap: '8px',
      }}
    >
      {tags.map(
        (tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() =>
              onOpen(
                tag.name
              )
            }
            style={{
              display:
                'flex',
              justifyContent:
                'space-between',
              alignItems:
                'center',
              backgroundColor:
                '#1e1e1e',
              border:
                '1px solid #2a2a2a',
              borderRadius:
                '12px',
              padding:
                '14px 16px',
              color: '#fff',
              cursor:
                'pointer',
              textAlign:
                'left',
            }}
          >
            <span
              style={{
                color:
                  '#ffda79',
                fontWeight:
                  'bold',
              }}
            >
              {tag.name}
            </span>

            <span
              style={{
                color:
                  '#777',
                fontSize:
                  '0.8rem',
              }}
            >
              {tag.count}句
            </span>
          </button>
        )
      )}
    </div>
  )
}

// =============================
// 検索前
// =============================

function EmptySearch({
  tab,
}: {
  tab: SearchTab
}) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding:
          '60px 20px',
        color: '#777',
      }}
    >
      <div
        style={{
          fontSize: '2rem',
          marginBottom:
            '15px',
        }}
      >
        {tab === 'haiku'
          ? '📜'
          : tab === 'user'
            ? '👤'
            : '🎴'}
      </div>

      <p
        style={{
          lineHeight: '1.8',
        }}
      >
        {tab === 'haiku' &&
          '言葉から句を探してみましょう。'}

        {tab === 'user' &&
          '気になる歌人を探してみましょう。'}

        {tab === 'tag' &&
          '気になる札を探してみましょう。'}
      </p>
    </div>
  )
}

// =============================
// 0件
// =============================

function EmptyResult({
  text,
}: {
  text: string
}) {
  return (
    <div
      style={{
        textAlign:
          'center',
        color: '#777',
        padding:
          '50px 20px',
      }}
    >
      {text}
    </div>
  )
}

// =============================
// タブボタン
// =============================

type TabButtonProps = {
  label: string
  active: boolean
  onClick: () => void
}

function TabButton({
  label,
  active,
  onClick,
}: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        position:
          'relative',
        background:
          'none',
        border: 'none',
        color: active
          ? '#fff'
          : '#777',
        padding: '12px',
        cursor:
          'pointer',
        fontSize:
          '0.9rem',
        fontWeight:
          active
            ? 'bold'
            : 'normal',
      }}
    >
      {label}

      {active && (
        <span
          style={{
            position:
              'absolute',
            left: '25%',
            bottom: '-1px',
            width: '50%',
            height: '2px',
            backgroundColor:
              '#ffda79',
            borderRadius:
              '2px',
          }}
        />
      )}
    </button>
  )
}
