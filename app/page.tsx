'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

import Header from './components/Header'
import HaikuCard, { Haiku } from './components/HaikuCard'
import PostModal from './components/PostModal'
import BottomNav from './components/BottomNav'
import TimelineTabs, {
  TimelineTab,
} from './components/TimelineTabs'

import { useAuth } from './hooks/useAuth'

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

  const [activeTab, setActiveTab] =
    useState<TimelineTab>('new')

  // =============================
  // 俳句
  // =============================

  const [haikus, setHaikus] = useState<Haiku[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // =============================
  // 雅
  // =============================

  const [likeCounts, setLikeCounts] = useState<{
    [key: string]: number
  }>({})

  const [userLikes, setUserLikes] = useState<{
    [key: string]: boolean
  }>({})

  // =============================
  // 投稿モーダル
  // =============================

  const [isModalOpen, setIsModalOpen] = useState(false)

  // =============================
  // 俳句・雅を読み込む
  // =============================

const loadHaikus = async () => {
  setIsLoading(true)

  try {
    // =============================
    // ① 俳句を取得
    // =============================

    const {
      data: haikuData,
      error: haikuError,
    } = await supabase
      .from('haikus_2')
      .select('*')
      .order('created_at', {
        ascending: false,
      })

    if (haikuError) {
      console.error(
        '俳句取得エラー:',
        haikuError
      )

      setHaikus([])
      return
    }

    const loadedHaikus =
      (haikuData ?? []) as Haiku[]

    // =============================
    // ② 句と札の紐付けを取得
    // =============================

    const {
      data: haikuTagData,
      error: haikuTagError,
    } = await supabase
      .from('haiku_tags')
      .select('haiku_id, tag_id')

    if (haikuTagError) {
      console.error(
        '札紐付け取得エラー:',
        haikuTagError
      )
    }

    const tagLinks =
      haikuTagData ?? []

    // =============================
    // ③ 必要な札IDを集める
    // =============================

    const tagIds = [
      ...new Set(
        tagLinks.map(
          (link) => link.tag_id
        )
      ),
    ]

    // =============================
    // ④ 札の名前を取得
    // =============================

    let tagData: {
      id: number
      name: string
    }[] = []

    if (tagIds.length > 0) {
      const {
        data,
        error: tagError,
      } = await supabase
        .from('tags')
        .select('id, name')
        .in('id', tagIds)

      if (tagError) {
        console.error(
          '札取得エラー:',
          tagError
        )
      }

      tagData =
        (data ?? []) as {
          id: number
          name: string
        }[]
    }

    // =============================
    // ⑤ 俳句に札を追加
    // =============================

    const haikusWithTags: Haiku[] =
      loadedHaikus.map(
        (haiku) => {
          const links =
            tagLinks.filter(
              (link) =>
                String(
                  link.haiku_id
                ) ===
                String(haiku.id)
            )

          const tags =
            links
              .map((link) => {
                const tag =
                  tagData.find(
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
            tags,
          }
        }
      )

    setHaikus(haikusWithTags)

    // =============================
    // ⑥ 雅を取得
    // =============================

    const {
      data: likesData,
      error: likesError,
    } = await supabase
      .from('likes_2')
      .select('*')

    if (likesError) {
      console.error(
        '雅取得エラー:',
        likesError
      )
    }

    const counts: {
      [key: string]: number
    } = {}

    const myLikes: {
      [key: string]: boolean
    } = {}

    haikusWithTags.forEach(
      (haiku) => {
        const haikuLikes =
          likesData?.filter(
            (like) =>
              String(
                like.haiku_id
              ) ===
              String(haiku.id)
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

    setLikeCounts(counts)
    setUserLikes(myLikes)
  } catch (error) {
    console.error(
      'データ取得エラー:',
      error
    )
  } finally {
    setIsLoading(false)
  }
}

  // =============================
  // 初回読み込み
  // =============================

  useEffect(() => {
    if (authLoading) {
      return
    }

    void loadHaikus()
  }, [authLoading, userId])

  // =============================
  // 雅
  // =============================

  const handleLike = async (haikuId: string) => {
    if (!userId) {
      alert('雅を贈るにはログインが必要です！')
      router.push('/auth')
      return
    }

    const isAlreadyLiked =
      userLikes[haikuId] ?? false

    try {
      if (isAlreadyLiked) {
        // 雅を取り消す

        const { error } = await supabase
          .from('likes_2')
          .delete()
          .eq('haiku_id', String(haikuId))
          .eq('user_id', userId)

        if (error) {
          console.error(
            '雅取り消しエラー:',
            error
          )

          alert('雅の取り消しに失敗しました')
          return
        }

        setUserLikes((prev) => ({
          ...prev,
          [haikuId]: false,
        }))

        setLikeCounts((prev) => ({
          ...prev,
          [haikuId]: Math.max(
            (prev[haikuId] ?? 1) - 1,
            0
          ),
        }))
      } else {
        // 雅を贈る

        const { error } = await supabase
          .from('likes_2')
          .insert([
            {
              haiku_id: String(haikuId),
              user_id: userId,
            },
          ])

        if (error) {
          console.error('雅エラー:', error)
          alert('雅を贈れませんでした')
          return
        }

        setUserLikes((prev) => ({
          ...prev,
          [haikuId]: true,
        }))

        setLikeCounts((prev) => ({
          ...prev,
          [haikuId]:
            (prev[haikuId] ?? 0) + 1,
        }))
      }
    } catch (error) {
      console.error('雅処理エラー:', error)
    }
  }

  // =============================
  // 投稿
  // =============================

  const handlePost = async (data: {
  firstLine: string
  secondLine: string
  thirdLine: string
  joshi: string
  description: string
  tags: string[]
}) => {
  if (!userId || !userName) {
    alert('一句詠むにはログインが必要です！')
    router.push('/auth')
    return
  }

  // =============================
  // ① まず句を投稿
  // =============================

  const {
    data: insertedHaiku,
    error: haikuError,
  } = await supabase
    .from('haikus_2')
    .insert([
      {
        first_line: data.firstLine,
        second_line: data.secondLine,
        third_line: data.thirdLine,
        joshi: data.joshi,
        description: data.description,
        author: userName,
        avatar_url: userAvatar ?? '',
        user_id: userId,
        created_at: new Date().toISOString(),
      },
    ])
    .select('id')
    .single()

  if (haikuError) {
    console.error('投稿エラー:', haikuError)
    throw haikuError
  }

  if (!insertedHaiku) {
    throw new Error('投稿した句のIDを取得できませんでした')
  }

  // =============================
  // ② 札を登録
  // =============================

  for (const tagName of data.tags) {
    // -----------------------------
    // 同名の札がすでにあるか確認
    // -----------------------------

    const {
      data: existingTag,
      error: searchTagError,
    } = await supabase
      .from('tags')
      .select('id')
      .eq('name', tagName)
      .maybeSingle()

    if (searchTagError) {
      console.error(
        '札検索エラー:',
        searchTagError
      )

      throw searchTagError
    }

    let tagId: number

    // -----------------------------
    // あれば既存の札を使用
    // -----------------------------

    if (existingTag) {
      tagId = existingTag.id
    } else {
      // ---------------------------
      // なければ新しい札を作成
      // ---------------------------

      const {
        data: newTag,
        error: createTagError,
      } = await supabase
        .from('tags')
        .insert([
          {
            name: tagName,
          },
        ])
        .select('id')
        .single()

      if (createTagError) {
        console.error(
          '札作成エラー:',
          createTagError
        )

        throw createTagError
      }

      if (!newTag) {
        throw new Error(
          '作成した札のIDを取得できませんでした'
        )
      }

      tagId = newTag.id
    }

    // =============================
    // ③ 句と札を結びつける
    // =============================

    const { error: linkError } =
      await supabase
        .from('haiku_tags')
        .insert([
          {
            haiku_id: String(
              insertedHaiku.id
            ),
            tag_id: tagId,
          },
        ])

    if (linkError) {
      console.error(
        '札紐付けエラー:',
        linkError
      )

      throw linkError
    }
  }

  // =============================
  // ④ 投稿完了
  // =============================

  setActiveTab('new')

  await loadHaikus()
}

  // =============================
  // ＋ボタン
  // =============================

  const handleOpenPost = () => {
    if (!userId || !userName) {
      alert('一句詠むにはログインが必要です！')
      router.push('/auth')
      return
    }

    setIsModalOpen(true)
  }

  // =============================
  // タブ変更
  // =============================

  const handleTabChange = (tab: TimelineTab) => {
    // 贔屓はログイン必須
    if (tab === 'favorite' && !userId) {
      alert('贔屓を見るにはログインが必要です！')
      router.push('/auth')
      return
    }

    setActiveTab(tab)
  }

  // =============================
  // タイムライン内容
  // =============================

  const renderTimeline = () => {
    if (isLoading || authLoading) {
      return (
        <p
          style={{
            textAlign: 'center',
            color: '#777',
            marginTop: '40px',
          }}
        >
          読み込み中...
        </p>
      )
    }

    // -------------------------
    // みつける
    // -------------------------

    if (activeTab === 'discover') {
      return (
        <div
          style={{
            textAlign: 'center',
            padding: '70px 20px',
            color: '#888',
          }}
        >
          <div
            style={{
              fontSize: '2rem',
              marginBottom: '15px',
            }}
          >
            🔎
          </div>

          <div
            style={{
              color: '#ddd',
              fontWeight: 'bold',
              marginBottom: '8px',
            }}
          >
            みつける
          </div>

          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              lineHeight: '1.8',
            }}
          >
            あなたがまだ知らない一句との
            <br />
            出会いを準備しています。
          </p>
        </div>
      )
    }

    // -------------------------
    // 贔屓
    // -------------------------

    if (activeTab === 'favorite') {
      return (
        <div
          style={{
            textAlign: 'center',
            padding: '70px 20px',
            color: '#888',
          }}
        >
          <div
            style={{
              fontSize: '2rem',
              marginBottom: '15px',
            }}
          >
            🌸
          </div>

          <div
            style={{
              color: '#ddd',
              fontWeight: 'bold',
              marginBottom: '8px',
            }}
          >
            贔屓
          </div>

          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              lineHeight: '1.8',
            }}
          >
            贔屓にしている歌人の句を
            <br />
            ここで楽しめるようになります。
          </p>
        </div>
      )
    }

    // -------------------------
    // 新着
    // -------------------------

    if (haikus.length === 0) {
      return (
        <p
          style={{
            textAlign: 'center',
            color: '#777',
            marginTop: '40px',
          }}
        >
          まだ句は詠まれていません。
        </p>
      )
    }

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '15px',
        }}
      >
        {haikus.map((haiku) => (
          <HaikuCard
            key={haiku.id}
            haiku={haiku}
            isLiked={
              userLikes[haiku.id] ?? false
            }
            likeCount={
              likeCounts[haiku.id] ?? 0
            }
            onLike={handleLike}
          />
        ))}
      </div>
    )
  }

  // =============================
  // 画面
  // =============================

  return (
    <div
      style={{
        backgroundColor: '#121212',
        color: '#fff',
        minHeight: '100vh',
        paddingBottom: '100px',
      }}
    >
      <main
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px',
        }}
      >
        {/* ヘッダー */}

        <Header
          userId={userId}
          userName={userName}
          userAvatar={userAvatar}
        />

        {/* 新着 / みつける / 贔屓 */}

        <TimelineTabs
          activeTab={activeTab}
          onChange={handleTabChange}
        />

        {/* タイムライン */}

        {renderTimeline()}

        {/* 一句詠む */}

        <button
          type="button"
          onClick={handleOpenPost}
          aria-label="一句詠む"
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
            boxShadow:
              '0 4px 15px rgba(255, 218, 121, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          ＋
        </button>
      </main>

      <PostModal
        isOpen={isModalOpen}
        onClose={() =>
          setIsModalOpen(false)
        }
        onSubmit={handlePost}
      />

      <BottomNav
        currentUserId={userId}
      />
    </div>
  )
}