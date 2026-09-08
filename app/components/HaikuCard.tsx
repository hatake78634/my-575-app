'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Avatar from './Avatar'

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

  // 札
  tags?: string[]

  // =============================
  // 勝負句
  // =============================

  is_competitive?: boolean

  battle_started_at?: string | null
  battle_ends_at?: string | null

  battle_like_border?: number | null
  battle_rating_before?: number | null
  battle_rating_change?: number | null

  battle_resolved?: boolean
}

type HaikuCardProps = {
  haiku: Haiku

  isLiked: boolean

  likeCount: number

  onLike: (
    haikuId: string
  ) => void

  // 今ログインしているユーザー
  currentUserId?: string | null
}

export default function HaikuCard({
  haiku,
  isLiked,
  likeCount,
  onLike,
  currentUserId,
}: HaikuCardProps) {
  const router = useRouter()

  const battleEndMs =
    haiku.battle_ends_at
      ? new Date(
          haiku.battle_ends_at
        ).getTime()
      : null

  const [nowMs, setNowMs] =
    useState<number | null>(null)

  useEffect(() => {
    if (
      haiku.battle_resolved ||
      battleEndMs === null ||
      !Number.isFinite(battleEndMs)
    ) {
      return
    }

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
  }, [
    battleEndMs,
    haiku.battle_resolved,
  ])

  // =============================
  // 投稿日時
  // =============================

  const formatDate = (
    dateString?: string
  ) => {
    if (!dateString) {
      return ''
    }

    const date =
      new Date(dateString)

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return ''
    }

    const now =
      new Date()

    const diffMin =
      Math.floor(
        (
          now.getTime() -
          date.getTime()
        ) /
          (
            1000 *
            60
          )
      )

    if (
      diffMin < 1
    ) {
      return 'たった今'
    }

    if (
      diffMin < 60
    ) {
      return `${diffMin}分前`
    }

    const diffHour =
      Math.floor(
        diffMin / 60
      )

    if (
      diffHour < 24
    ) {
      return `${diffHour}時間前`
    }

    const month =
      date.getMonth() + 1

    const day =
      date.getDate()

    return `${month}月${day}日`
  }

  // =============================
  // 自分の句か
  // =============================

  const isOwnHaiku =
    Boolean(
      currentUserId &&
        haiku.user_id &&
        String(
          currentUserId
        ) ===
          String(
            haiku.user_id
          )
    )

  // =============================
  // 本人だけ勝負句を認識
  // =============================

  const showBattleInfo =
    isOwnHaiku &&
    haiku.is_competitive ===
      true

  // =============================
  // 勝負句の残り時間
  // =============================

  const getBattleRemaining =
    () => {
      if (
        battleEndMs === null ||
        !Number.isFinite(
          battleEndMs
        ) ||
        nowMs === null
      ) {
        return ''
      }

      const diff =
        battleEndMs - nowMs

      if (
        diff <= 0
      ) {
        return '評価期間終了'
      }

      const totalMinutes =
        Math.floor(
          diff /
            (
              1000 *
              60
            )
        )

      const hours =
        Math.floor(
          totalMinutes /
            60
        )

      const minutes =
        totalMinutes %
        60

      if (
        hours >= 24
      ) {
        const days =
          Math.floor(
            hours / 24
          )

        const remainingHours =
          hours % 24

        return `残り ${days}日${remainingHours}時間`
      }

      if (
        hours > 0
      ) {
        return `残り ${hours}時間${minutes}分`
      }

      return `残り ${minutes}分`
    }

  // =============================
  // 歌人録へ
  // =============================

  const openUser = () => {
    if (
      !haiku.user_id
    ) {
      return
    }

    router.push(
      `/user/${haiku.user_id}`
    )
  }

  // =============================
  // 句の詳細へ
  // =============================

  const openHaiku = () => {
    router.push(
      `/haiku/${haiku.id}`
    )
  }

  // =============================
  // 札へ
  // =============================

  const openTag = (
    tag: string
  ) => {
    router.push(
      `/find?tag=${encodeURIComponent(
        tag
      )}`
    )
  }

  // =============================
  // 表示
  // =============================

  return (
    <div
      style={{
        backgroundColor:
          'var(--surface)',

        borderRadius:
          '16px',

        padding:
          '20px',

        border:
          '1px solid var(--border)',

        boxShadow:
          '0 4px 12px var(--shadow)',
      }}
    >
      {/* =====================
          歌人情報
      ===================== */}

      <div
        style={{
          display:
            'flex',

          alignItems:
            'center',

          gap:
            '10px',

          marginBottom:
            '15px',
        }}
      >
        {/* アイコン */}

        {haiku.avatar_url ? (
          <Avatar
            src={
              haiku.avatar_url
            }

            name={
              haiku.author ||
              '歌人'
            }

            size={40}

            onClick={
              openUser
            }

            style={{
              width:
                '40px',

              height:
                '40px',

              borderRadius:
                '50%',

              objectFit:
                'cover',

              cursor:
                haiku.user_id
                  ? 'pointer'
                  : 'default',
            }}
          />
        ) : (
          <div
            onClick={
              openUser
            }

            style={{
              width:
                '40px',

              height:
                '40px',

              borderRadius:
                '50%',

              backgroundColor:
                'var(--surface-elevated)',

              cursor:
                haiku.user_id
                  ? 'pointer'
                  : 'default',
            }}
          />
        )}

        {/* 名前・日時 */}

        <div>
          <div
            onClick={
              openUser
            }

            style={{
              fontWeight:
                'bold',

              fontSize:
                '0.95rem',

              cursor:
                haiku.user_id
                  ? 'pointer'
                  : 'default',

              color:
                'var(--foreground)',
            }}
          >
            {haiku.author ||
              '名無し'}
          </div>

          <div
            style={{
              fontSize:
                '0.75rem',

              color:
                'var(--foreground-muted)',
            }}
          >
            {formatDate(
              haiku.created_at
            )}
          </div>
        </div>
      </div>

      {/* =====================
          本人だけ勝負句情報
      ===================== */}

      {showBattleInfo && (
        <div
          style={{
            marginBottom:
              '16px',

            padding:
              '12px 14px',

            borderRadius:
              '12px',

            backgroundColor:
              'var(--surface-elevated)',

            border:
              '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              gap:
                '10px',

              marginBottom:
                '7px',
            }}
          >
            <div
              style={{
                color:
                  'var(--primary)',

                fontWeight:
                  'bold',

                fontSize:
                  '0.85rem',
              }}
            >
              ⚔️ 勝負の俳句
            </div>

            <div
              style={{
                color:
                  'var(--foreground-muted)',

                fontSize:
                  '0.72rem',
              }}
            >
              {getBattleRemaining()}
            </div>
          </div>

          {/* 評価中 */}

          {!haiku.battle_resolved &&
            battleEndMs !== null &&
            nowMs !== null &&
            battleEndMs >
              nowMs && (
              <>
                <div
                  style={{
                    fontSize:
                      '0.9rem',

                    color:
                      'var(--foreground)',

                    marginBottom:
                      '4px',
                  }}
                >
                  現在{' '}
                  <strong>
                    {likeCount}
                  </strong>
                  {' / '}
                  <strong>
                    {haiku.battle_like_border ??
                      '?'}
                  </strong>
                  {' '}
                  雅
                </div>

                <div
                  style={{
                    color:
                      'var(--foreground-muted)',

                    fontSize:
                      '0.72rem',
                  }}
                >
                  48時間の評価期間中です
                </div>
              </>
            )}

          {/* 48時間終了・未判定 */}

          {!haiku.battle_resolved &&
            battleEndMs !== null &&
            nowMs !== null &&
            battleEndMs <=
              nowMs && (
              <>
                <div
                  style={{
                    color:
                      'var(--foreground)',

                    fontSize:
                      '0.85rem',

                    marginBottom:
                      '4px',
                  }}
                >
                  最終結果：
                  {' '}
                  {likeCount}
                  {' / '}
                  {haiku.battle_like_border ??
                    '?'}
                  {' '}
                  雅
                </div>

                <div
                  style={{
                    color:
                      'var(--foreground-muted)',

                    fontSize:
                      '0.72rem',
                  }}
                >
                  番付の判定を待っています
                </div>
              </>
            )}

          {/* 判定済み */}

          {haiku.battle_resolved && (
            <>
              <div
                style={{
                  color:
                    'var(--foreground)',

                  fontSize:
                    '0.85rem',

                  marginBottom:
                    '4px',
                }}
              >
                最終結果：
                {' '}
                {likeCount}
                {' / '}
                {haiku.battle_like_border ??
                  '?'}
                {' '}
                雅
              </div>

              <div
                style={{
                  fontWeight:
                    'bold',

                  color:
                    (
                      haiku.battle_rating_change ??
                      0
                    ) >= 0
                      ? 'var(--primary)'
                      : 'var(--danger)',

                  fontSize:
                    '0.85rem',
                }}
              >
                rating{' '}
                {(
                  haiku.battle_rating_change ??
                  0
                ) >= 0
                  ? '+'
                  : ''}
                {haiku.battle_rating_change ??
                  0}
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================
          俳句本文
      ===================== */}

      <div
        onClick={
          openHaiku
        }

        style={{
          cursor:
            'pointer',

          marginBottom:
            '18px',

          color:
            'var(--foreground)',

          textAlign:
            'center',
        }}
      >
        {/* 序詞 */}

        {haiku.joshi && (
          <div
            style={{
              fontSize:
                '0.9rem',

              color:
                'var(--foreground-muted)',

              marginBottom:
                '10px',

              fontStyle:
                'italic',
            }}
          >
            {haiku.joshi}
          </div>
        )}

        {/* 三行 */}

        <div
          style={{
            display:
              'inline-block',

            textAlign:
              'left',
          }}
        >
          <div
            style={{
              fontSize:
                '1.2rem',

              fontWeight:
                'bold',

              lineHeight:
                '1.8',

              letterSpacing:
                '2px',
            }}
          >
            {haiku.first_line}
          </div>

          <div
            style={{
              fontSize:
                '1.2rem',

              fontWeight:
                'bold',

              lineHeight:
                '1.8',

              letterSpacing:
                '2px',

              marginLeft:
                '30px',
            }}
          >
            {haiku.second_line}
          </div>

          <div
            style={{
              fontSize:
                '1.2rem',

              fontWeight:
                'bold',

              lineHeight:
                '1.8',

              letterSpacing:
                '2px',

              marginLeft:
                '60px',
            }}
          >
            {haiku.third_line}
          </div>
        </div>
      </div>

      {/* =====================
          札
      ===================== */}

      {haiku.tags &&
        haiku.tags.length >
          0 && (
          <div
            style={{
              display:
                'flex',

              flexWrap:
                'wrap',

              gap:
                '7px',

              marginBottom:
                '14px',
            }}
          >
            {haiku.tags.map(
              (tag) => (
                <button
                  key={
                    tag
                  }

                  type="button"

                  onClick={() =>
                    openTag(
                      tag
                    )
                  }

                  title={`${tag}の札を見る`}

                  style={{
                    backgroundColor:
                      'var(--surface-subtle)',

                    color:
                      'var(--primary)',

                    border:
                      '1px solid var(--border)',

                    borderRadius:
                      '18px',

                    padding:
                      '5px 10px',

                    fontSize:
                      '0.78rem',

                    cursor:
                      'pointer',
                  }}
                >
                  {tag}
                </button>
              )
            )}
          </div>
        )}

      {/* =====================
          雅・返歌
      ===================== */}

      <div
        style={{
          display:
            'flex',

          alignItems:
            'center',

          gap:
            '20px',

          borderTop:
            '1px solid var(--border)',

          paddingTop:
            '12px',
        }}
      >
        {/* 雅 */}

        <button
          type="button"

          onClick={() =>
            onLike(
              haiku.id
            )
          }

          title="雅を贈る"

          style={{
            background:
              'none',

            border:
              'none',

            cursor:
              'pointer',

            color:
              isLiked
                ? 'var(--primary)'
                : 'var(--foreground-muted)',

            display:
              'flex',

            alignItems:
              'center',

            gap:
              '6px',

            fontSize:
              '0.95rem',
          }}
        >
          <span
            style={{
              fontSize:
                '1.2rem',
            }}
          >
            {isLiked
              ? '🌸'
              : '✿'}
          </span>

          <span>
            {likeCount}
          </span>

          <span>
            雅
          </span>
        </button>

        {/* 詳細・返歌 */}

        <button
          type="button"

          onClick={
            openHaiku
          }

          style={{
            background:
              'none',

            border:
              'none',

            cursor:
              'pointer',

            color:
              'var(--foreground-muted)',

            display:
              'flex',

            alignItems:
              'center',

            gap:
              '6px',

            fontSize:
              '0.95rem',
          }}
        >
          💬 詳細・返歌
        </button>
      </div>
    </div>
  )
}
