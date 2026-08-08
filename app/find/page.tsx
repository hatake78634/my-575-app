'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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

export default function SearchPage() {
  const router = useRouter()

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

  const [isSearching, setIsSearching] =
    useState(false)

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

  const [selectedTag, setSelectedTag] =
    useState<string | null>(null)

  const [
    selectedTagHaikus,
    setSelectedTagHaikus,
  ] = useState<Haiku[]>([])

  const [
    selectedTagLoading,
    setSelectedTagLoading,
  ] = useState(false)

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

  // =============================
  // URLの ?tag=春 を読む
  // =============================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      )

    const tag =
      params.get('tag')

    if (!tag) {
      return
    }

    setActiveTab('tag')
    setQuery(tag)
    setSelectedTag(tag)

    void loadHaikusByTag(tag)
  }, [])

  // =============================
  // 検索文字が変わったら検索
  // =============================

  useEffect(() => {
    const trimmed =
      query.trim()

    if (!trimmed) {
      setHaikuResults([])
      setUserResults([])
      setTagResults([])
      return
    }

    // 札詳細表示中は
    // 勝手に検索し直さない
    if (selectedTag) {
      return
    }

    const timer =
      window.setTimeout(() => {
        void runSearch(
          trimmed,
          activeTab
        )
      }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    query,
    activeTab,
    selectedTag,
  ])

  // =============================
  // 検索
  // =============================

  const runSearch = async (
    searchText: string,
    tab: SearchTab
  ) => {
    setIsSearching(true)

    try {
      if (tab === 'haiku') {
        await searchHaikus(
          searchText
        )
      }

      if (tab === 'user') {
        await searchUsers(
          searchText
        )
      }

      if (tab === 'tag') {
        await searchTags(
          searchText
        )
      }
    } finally {
      setIsSearching(false)
    }
  }

  // =============================
  // 句検索
  // =============================

  const searchHaikus = async (
    searchText: string
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

      setHaikuResults([])
      return
    }

    const haikus =
      (data ?? []) as Haiku[]

    const haikusWithTags =
      await attachTagsToHaikus(
        haikus
      )

    setHaikuResults(
      haikusWithTags
    )

    await loadLikes(
      haikusWithTags
    )
  }

  // =============================
  // 歌人検索
  // =============================

  const searchUsers = async (
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

      setUserResults([])
      return
    }

    setUserResults(
      (data ?? []) as Profile[]
    )
  }

  // =============================
  // 札検索
  // =============================

  const searchTags = async (
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

      setTagResults([])
      return
    }

    const tags =
      data ?? []

    if (
      tags.length === 0
    ) {
      setTagResults([])
      return
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

    setTagResults(results)
  }

  // =============================
  // 札を選ぶ
  // =============================

  const openTag = async (
    tagName: string
  ) => {
    setActiveTab('tag')
    setQuery(tagName)
    setSelectedTag(tagName)

    window.history.replaceState(
      null,
      '',
      `/find?tag=${encodeURIComponent(
        tagName
      )}`
    )

    await loadHaikusByTag(
      tagName
    )
  }

  // =============================
  // 札から句一覧
  // =============================

  const loadHaikusByTag =
    async (
      tagName: string
    ) => {
      setSelectedTagLoading(
        true
      )

      try {
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

          setSelectedTagHaikus(
            []
          )
          return
        }

        if (!tag) {
          setSelectedTagHaikus(
            []
          )
          return
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

          setSelectedTagHaikus(
            []
          )
          return
        }

        const haikuIds =
          links?.map(
            (link) =>
              link.haiku_id
          ) ?? []

        if (
          haikuIds.length === 0
        ) {
          setSelectedTagHaikus(
            []
          )
          return
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

          setSelectedTagHaikus(
            []
          )
          return
        }

        const loaded =
          (haikuData ??
            []) as Haiku[]

        const withTags =
          await attachTagsToHaikus(
            loaded
          )

        setSelectedTagHaikus(
          withTags
        )

        await loadLikes(
          withTags
        )
      } finally {
        setSelectedTagLoading(
          false
        )
      }
    }

  // =============================
  // 句に札を付加
  // =============================

  const attachTagsToHaikus =
    async (
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
    }

  // =============================
  // 雅情報
  // =============================

  const loadLikes = async (
    haikus: Haiku[]
  ) => {
    if (
      haikus.length === 0
    ) {
      return
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

      return
    }

    const counts: {
      [key: string]: number
    } = {}

    const myLikes: {
      [key: string]: boolean
    } = {}

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

        if (userId) {
          myLikes[haiku.id] =
            haikuLikes.some(
              (like) =>
                like.user_id ===
                userId
            )
        }
      }
    )

    setLikeCounts(
      (prev) => ({
        ...prev,
        ...counts,
      })
    )

    setUserLikes(
      (prev) => ({
        ...prev,
        ...myLikes,
      })
    )
  }

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
    setActiveTab(tab)
    setSelectedTag(null)
    setSelectedTagHaikus([])

    window.history.replaceState(
      null,
      '',
      '/find'
    )

    if (
      query.trim()
    ) {
      void runSearch(
        query.trim(),
        tab
      )
    }
  }

  // =============================
  // 検索内容を消す
  // =============================

  const clearSearch = () => {
    setQuery('')
    setSelectedTag(null)

    setHaikuResults([])
    setUserResults([])
    setTagResults([])
    setSelectedTagHaikus([])

    window.history.replaceState(
      null,
      '',
      '/find'
    )
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
            value={query}
            onChange={(e) => {
              setQuery(
                e.target.value
              )

              if (
                selectedTag
              ) {
                setSelectedTag(
                  null
                )

                setSelectedTagHaikus(
                  []
                )

                window.history.replaceState(
                  null,
                  '',
                  '/find'
                )
              }
            }}
            placeholder={
              activeTab ===
              'haiku'
                ? '句を探す'
                : activeTab ===
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

          {query && (
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
              activeTab ===
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
              activeTab ===
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
              activeTab ===
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

        {!query.trim() &&
          !selectedTag && (
            <EmptySearch
              tab={activeTab}
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
          activeTab ===
            'haiku' &&
          query.trim() && (
            <HaikuResults
              haikus={
                haikuResults
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
          activeTab ===
            'user' &&
          query.trim() && (
            <UserResults
              users={
                userResults
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
          activeTab ===
            'tag' &&
          query.trim() && (
            <TagResults
              tags={
                tagResults
              }
              onOpen={
                openTag
              }
            />
          )}

        {/* =====================
            札詳細
        ===================== */}

        {activeTab ===
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
                    setSelectedTag(
                      null
                    )

                    setSelectedTagHaikus(
                      []
                    )

                    window.history.replaceState(
                      null,
                      '',
                      '/find'
                    )

                    void searchTags(
                      query
                    )
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
                    selectedTagHaikus.length
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
                    selectedTagHaikus
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
              <img
                src={
                  user.avatar_url
                }
                alt=""
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