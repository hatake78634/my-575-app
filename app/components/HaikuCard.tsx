'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'

export type Haiku = {
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

  // この句についている札
  tags?: string[]
}

type HaikuCardProps = {
  haiku: Haiku
  isLiked: boolean
  likeCount: number
  onLike: (haikuId: string) => void
}

export default function HaikuCard({
  haiku,
  isLiked,
  likeCount,
  onLike,
}: HaikuCardProps) {
  const router = useRouter()

  // =============================
  // 投稿日時
  // =============================

  const formatDate = (dateString?: string) => {
    if (!dateString) {
      return ''
    }

    const date = new Date(dateString)

    if (Number.isNaN(date.getTime())) {
      return ''
    }

    const now = new Date()

    const diffMin = Math.floor(
      (now.getTime() - date.getTime()) /
        (1000 * 60)
    )

    if (diffMin < 1) {
      return 'たった今'
    }

    if (diffMin < 60) {
      return `${diffMin}分前`
    }

    const diffHour = Math.floor(
      diffMin / 60
    )

    if (diffHour < 24) {
      return `${diffHour}時間前`
    }

    const month = date.getMonth() + 1
    const day = date.getDate()

    return `${month}月${day}日`
  }

  // =============================
  // 歌人録へ
  // =============================

  const openUser = () => {
    if (!haiku.user_id) {
      return
    }

    router.push(`/user/${haiku.user_id}`)
  }

  // =============================
  // 句の詳細へ
  // =============================

  const openHaiku = () => {
    router.push(`/haiku/${haiku.id}`)
  }

  // =============================
  // 札へ
  // =============================

  const openTag = (tag: string) => {
    router.push(
      `/find?tag=${encodeURIComponent(tag)}`
    )
  }

  // =============================
  // 表示
  // =============================

  return (
    <div
      style={{
        backgroundColor: '#1e1e1e',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #2a2a2a',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* =====================
          歌人情報
      ===================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '15px',
        }}
      >
        {/* アイコン */}

        {haiku.avatar_url ? (
          <Image
            src={haiku.avatar_url}
            alt={`${haiku.author || '歌人'}のアイコン`}
            width={40}
            height={40}
            onClick={openUser}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              objectFit: 'cover',
              cursor: haiku.user_id
                ? 'pointer'
                : 'default',
            }}
            unoptimized
          />
        ) : (
          <div
            onClick={openUser}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#444',
              cursor: haiku.user_id
                ? 'pointer'
                : 'default',
            }}
          />
        )}

        {/* 名前・日時 */}

        <div>
          <div
            onClick={openUser}
            style={{
              fontWeight: 'bold',
              fontSize: '0.95rem',
              cursor: haiku.user_id
                ? 'pointer'
                : 'default',
              color: '#fff',
            }}
          >
            {haiku.author || '名無し'}
          </div>

          <div
            style={{
              fontSize: '0.75rem',
              color: '#888',
            }}
          >
            {formatDate(haiku.created_at)}
          </div>
        </div>
      </div>

      {/* =====================
          俳句本文
      ===================== */}

      <div
        onClick={openHaiku}
        style={{
          cursor: 'pointer',
          marginBottom: '18px',
          color: '#f0f0f0',
          textAlign: 'center',
        }}
      >
        {/* 序詞 */}

        {haiku.joshi && (
          <div
            style={{
              fontSize: '0.9rem',
              color: '#b0a892',
              marginBottom: '10px',
              fontStyle: 'italic',
            }}
          >
            {haiku.joshi}
          </div>
        )}

        {/* 三行 */}

        <div
          style={{
            display: 'inline-block',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              lineHeight: '1.8',
              letterSpacing: '2px',
            }}
          >
            {haiku.first_line}
          </div>

          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              lineHeight: '1.8',
              letterSpacing: '2px',
              marginLeft: '30px',
            }}
          >
            {haiku.second_line}
          </div>

          <div
            style={{
              fontSize: '1.2rem',
              fontWeight: 'bold',
              lineHeight: '1.8',
              letterSpacing: '2px',
              marginLeft: '60px',
            }}
          >
            {haiku.third_line}
          </div>
        </div>
      </div>

      {/* =====================
          札
      ===================== */}

      {haiku.tags && haiku.tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '7px',
            marginBottom: '14px',
          }}
        >
          {haiku.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => openTag(tag)}
              title={`${tag}の札を見る`}
              style={{
                backgroundColor: '#302d24',
                color: '#ffda79',
                border: '1px solid #554d35',
                borderRadius: '18px',
                padding: '5px 10px',
                fontSize: '0.78rem',
                cursor: 'pointer',
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* =====================
          雅・返歌
      ===================== */}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          borderTop: '1px solid #2a2a2a',
          paddingTop: '12px',
        }}
      >
        {/* 雅 */}

        <button
          type="button"
          onClick={() => onLike(haiku.id)}
          title="雅を贈る"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: isLiked
              ? '#ffb7c5'
              : '#aaa',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.95rem',
          }}
        >
          <span
            style={{
              fontSize: '1.2rem',
            }}
          >
            {isLiked ? '🌸' : '✿'}
          </span>

          <span>{likeCount}</span>

          <span>雅</span>
        </button>

        {/* 詳細・返歌 */}

        <button
          type="button"
          onClick={openHaiku}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#aaa',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.95rem',
          }}
        >
          💬 詳細・返歌
        </button>
      </div>
    </div>
  )
}