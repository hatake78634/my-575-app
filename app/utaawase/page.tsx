'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  supabase,
} from '../../lib/supabase'

import BottomNav from '../components/BottomNav'
import { useAuth } from '../hooks/useAuth'

// =============================
// 設定
// =============================

const MAX_COMPETITIVE_MATCHES_PER_DAY = 5

type CompetitiveRemainingState = {
  userId: string
  remaining: number
}

type CompetitiveRemainingResult = {
  requestId: number
  targetUserId: string
  status: 'success' | 'error'
  remaining: number
}

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

export default function UtaawasePage() {
  const router = useRouter()

  const {
    userId,
    loading: authLoading,
  } = useAuth()

  // =============================
  // 勝負モード
  // =============================

  const [
    isCompetitive,
    setIsCompetitive,
  ] = useState(false)

  const [
    competitiveRemainingState,
    setCompetitiveRemainingState,
  ] = useState<
    CompetitiveRemainingState | null
  >(null)

  const competitiveRequestIdRef =
    useRef(0)

  const competitiveRemaining =
    userId &&
    competitiveRemainingState?.userId ===
      userId
      ? competitiveRemainingState.remaining
      : MAX_COMPETITIVE_MATCHES_PER_DAY

  // =============================
  // マッチング状態
  // =============================

  const [
    isMatching,
    setIsMatching,
  ] = useState(false)

  const [
    matchingMessage,
    setMatchingMessage,
  ] = useState('')

  // =============================
  // 今日の勝負モード残数
  // =============================

  const loadCompetitiveRemaining =
    useCallback(async (
      targetUserId: string
    ): Promise<CompetitiveRemainingResult> => {
      const requestId =
        ++competitiveRequestIdRef.current

      try {
        const {
          start,
          end,
        } = getTodayJstRange()

        const {
          data,
          error,
        } = await supabase
          .from('utaawase_members')
          .select(`
            id,
            joined_at,
            is_competitive,
            utaawase_rooms!inner(
              room_type
            )
          `)
          .eq(
            'user_id',
            targetUserId
          )
          .eq(
            'is_competitive',
            true
          )
          .eq(
            'utaawase_rooms.room_type',
            'random'
          )
          .gte(
            'joined_at',
            start
          )
          .lt(
            'joined_at',
            end
          )

        if (error) {
          console.error(
            '勝負モード残数取得エラー:',
            error
          )

          return {
            requestId,
            targetUserId,
            status: 'error',
            remaining:
              MAX_COMPETITIVE_MATCHES_PER_DAY,
          }
        }

        const used =
          data?.length ?? 0

        return {
          requestId,
          targetUserId,
          status: 'success',
          remaining:
            Math.max(
              MAX_COMPETITIVE_MATCHES_PER_DAY -
                used,
              0
            ),
        }
      } catch (error) {
        console.error(
          '勝負モード状態取得エラー:',
          error
        )

        return {
          requestId,
          targetUserId,
          status: 'error',
          remaining:
            MAX_COMPETITIVE_MATCHES_PER_DAY,
        }
      }
    }, [])

  const applyCompetitiveRemainingResult =
    useCallback((
      result: CompetitiveRemainingResult
    ) => {
      if (
        result.requestId !==
        competitiveRequestIdRef.current
      ) {
        return
      }

      if (result.status === 'error') {
        return
      }

      setCompetitiveRemainingState({
        userId: result.targetUserId,
        remaining: result.remaining,
      })
    }, [])

  // =============================
  // 初回
  // =============================

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!userId) {
      ++competitiveRequestIdRef.current
      return
    }

    void loadCompetitiveRemaining(
      userId
    ).then((result) => {
      applyCompetitiveRemainingResult(
        result
      )
    })
  }, [
    applyCompetitiveRemainingResult,
    authLoading,
    loadCompetitiveRemaining,
    userId,
  ])

  // =============================
  // ログイン確認
  // =============================

  const requireLogin = () => {
    if (userId) {
      return true
    }

    alert(
      '歌合に参加するにはログインが必要です！'
    )

    router.push('/auth')

    return false
  }

  // =============================
  // 勝負モード切替
  // =============================

  const toggleCompetitive =
    () => {
      if (
        competitiveRemaining <=
        0
      ) {
        alert(
          '今日の勝負モードは5試合すべて使い切っています。'
        )

        return
      }

      setIsCompetitive(
        (prev) => !prev
      )
    }

  // =============================
  // ランダム歌合
  // =============================

  const handleRandomMatch =
    async () => {
      if (!requireLogin()) {
        return
      }

      if (isMatching) {
        return
      }

      if (
        isCompetitive &&
        competitiveRemaining <=
          0
      ) {
        alert(
          '今日の勝負モードは5試合すべて使い切っています。'
        )

        setIsCompetitive(false)

        return
      }

      setIsMatching(true)

      setMatchingMessage(
        '歌人を探しています...'
      )

      try {
        const {
          data,
          error,
        } = await supabase.rpc(
          'join_random_utaawase',
          {
            p_is_competitive:
              isCompetitive,
          }
        )

        if (error) {
          console.error(
            'ランダム歌合参加エラー:',
            error
          )

          alert(
            error.message ||
              '歌合への参加に失敗しました'
          )

          setMatchingMessage('')

          return
        }

        // =========================
        // 6人揃って即開始
        // =========================

        if (data) {
          router.push(
            `/utaawase/${data}`
          )

          return
        }

        // =========================
        // まだ待機中
        // =========================

        setMatchingMessage(
          '参加者を待っています…'
        )

        // まず一度開始判定
        const {
          data:
            roomData,
          error:
            roomError,
        } = await supabase.rpc(
          'try_start_random_utaawase'
        )

        if (roomError) {
          console.error(
            '歌合開始判定エラー:',
            roomError
          )
        }

        if (roomData) {
          router.push(
            `/utaawase/${roomData}`
          )

          return
        }

        // =========================
        // 待機画面へ
        //
        // 次のページで数秒ごとに
        // 状態確認する
        // =========================

        router.push(
          `/utaawase/waiting`
        )
      } catch (error) {
        console.error(
          'ランダム歌合処理エラー:',
          error
        )

        alert(
          '歌合への参加中にエラーが発生しました'
        )

        setMatchingMessage('')
      } finally {
        setIsMatching(false)
      }
    }

  // =============================
// 一般公開
// =============================

const handlePublicRoom =
  () => {
    if (!requireLogin()) {
      return
    }

    router.push(
      '/utaawase/public'
    )
  }

  // =============================
  // フレンド限定
  // =============================

  const handleFriendRoom =
    () => {
      if (!requireLogin()) {
        return
      }

      alert(
        'フレンド限定ルームは次に実装します！'
      )
    }

  // =============================
  // ローディング
  // =============================

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--page-background)',
          color: 'var(--foreground-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        歌合を開いています...
      </div>
    )
  }

  // =============================
  // 表示
  // =============================

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--page-background)',
        color: 'var(--foreground)',
        paddingBottom: '100px',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        {/* =====================
            タイトル
        ===================== */}

        <div
          style={{
            marginBottom: '25px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.5rem',
              marginBottom: '6px',
            }}
          >
            ⚔️ 歌合
          </h1>

          <p
            style={{
              margin: 0,
              color: 'var(--foreground-muted)',
              fontSize: '0.82rem',
              lineHeight: '1.8',
            }}
          >
            同じお題をもとに一句詠み、
            <br />
            歌人たちと腕を競います。
          </p>
        </div>

        {/* =====================
            ランダム歌合
        ===================== */}

        <section
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '15px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '15px',
              marginBottom: '14px',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 'bold',
                  marginBottom: '5px',
                }}
              >
                🎲 ランダム歌合
              </div>

              <div
                style={{
                  color: 'var(--foreground-muted)',
                  fontSize: '0.78rem',
                  lineHeight: '1.7',
                }}
              >
                4〜6人で行う、
                <br />
                気軽なランダム対戦。
              </div>
            </div>

            <div
              style={{
                color: 'var(--foreground-muted)',
                fontSize: '0.7rem',
                textAlign: 'right',
              }}
            >
              待機 1分
              <br />
              作句 4分
              <br />
              評価 5分
            </div>
          </div>

          {/* =====================
              勝負モード
          ===================== */}

          <div
            style={{
              backgroundColor:
                isCompetitive
                  ? 'var(--surface-elevated)'
                  : 'var(--surface-subtle)',

              border:
                isCompetitive
                  ? '1px solid var(--border)'
                  : '1px solid var(--border)',

              borderRadius: '12px',

              padding: '13px',

              marginBottom: '14px',
            }}
          >
            <button
              type="button"

              onClick={
                toggleCompetitive
              }

              disabled={
                competitiveRemaining <=
                0
              }

              style={{
                width: '100%',

                background: 'none',

                border: 'none',

                padding: 0,

                color: 'var(--foreground)',

                display: 'flex',

                justifyContent:
                  'space-between',

                alignItems: 'center',

                cursor:
                  competitiveRemaining >
                  0
                    ? 'pointer'
                    : 'not-allowed',

                textAlign: 'left',
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 'bold',

                    color:
                      isCompetitive
                        ? 'var(--primary)'
                        : 'var(--foreground)',

                    fontSize:
                      '0.88rem',
                  }}
                >
                  ⚔️ 勝負モード
                </div>

                <div
                  style={{
                    color: 'var(--foreground-muted)',
                    fontSize: '0.72rem',
                    marginTop: '4px',
                  }}
                >
                  今日あと
                  {' '}
                  {
                    competitiveRemaining
                  }
                  {' '}
                  試合
                </div>
              </div>

              {/* スイッチ */}

              <div
                style={{
                  position: 'relative',

                  width: '44px',

                  height: '24px',

                  borderRadius: '20px',

                  backgroundColor:
                    isCompetitive
                      ? 'var(--primary)'
                      : 'var(--surface-elevated)',

                  transition: '0.2s',

                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    position:
                      'absolute',

                    top: '3px',

                    left:
                      isCompetitive
                        ? '23px'
                        : '3px',

                    width: '18px',

                    height: '18px',

                    borderRadius:
                      '50%',

                    backgroundColor:
                      isCompetitive
                        ? 'var(--primary-foreground)'
                        : 'var(--foreground-muted)',

                    transition:
                      '0.2s',
                  }}
                />
              </div>
            </button>

            {isCompetitive && (
              <div
                style={{
                  marginTop: '11px',

                  paddingTop: '10px',

                  borderTop:
                    '1px solid var(--border)',

                  color: 'var(--foreground-muted)',

                  fontSize: '0.73rem',

                  lineHeight: '1.7',
                }}
              >
                この歌合の成績を番付Ratingに反映します。
                <br />
                勝負モードを使っていることは、
                他の参加者には公開されません。
              </div>
            )}

            {competitiveRemaining <=
              0 && (
              <div
                style={{
                  marginTop: '9px',
                  color: 'var(--foreground-muted)',
                  fontSize: '0.72rem',
                }}
              >
                今日の勝負モード5試合を
                すべて使い切っています。
              </div>
            )}
          </div>

          <button
            type="button"

            onClick={
              handleRandomMatch
            }

            disabled={
              isMatching
            }

            style={{
              width: '100%',

              padding: '12px',

              borderRadius: '10px',

              border: 'none',

              backgroundColor:
                'var(--primary)',

              color: 'var(--primary-foreground)',

              fontWeight: 'bold',

              cursor:
                isMatching
                  ? 'not-allowed'
                  : 'pointer',

              opacity:
                isMatching
                  ? 0.6
                  : 1,
            }}
          >
            {isMatching
              ? matchingMessage ||
                'マッチング中...'
              : isCompetitive
                ? '勝負モードで参加する'
                : 'ランダム歌合に参加する'}
          </button>
        </section>

        {/* =====================
            一般公開
        ===================== */}

        <section
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '18px',
            marginBottom: '15px',
          }}
        >
          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 'bold',
              marginBottom: '6px',
            }}
          >
            🌐 一般公開ルーム
          </div>

          <div
            style={{
              color: 'var(--foreground-muted)',
              fontSize: '0.78rem',
              lineHeight: '1.7',
              marginBottom: '14px',
            }}
          >
            ShiKaの歌人なら誰でも参加できる
            公開歌合です。
            <br />
            参加、または新しく開催できます。
          </div>

          <button
            type="button"

            onClick={
              handlePublicRoom
            }

            style={
              secondaryButton
            }
          >
            🌐 公開歌合に参加・開催する
          </button>
        </section>

        {/* =====================
            フレンド
        ===================== */}

        <section
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            padding: '18px',
          }}
        >
          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 'bold',
              marginBottom: '6px',
            }}
          >
            👥 フレンド限定ルーム
          </div>

          <div
            style={{
              color: 'var(--foreground-muted)',
              fontSize: '0.78rem',
              lineHeight: '1.7',
              marginBottom: '14px',
            }}
          >
            歌友たちと気軽に歌合を楽しめます。
            <br />
            番付Ratingは変動しません。
          </div>

          <button
            type="button"

            onClick={
              handleFriendRoom
            }

            style={
              secondaryButton
            }
          >
            フレンド歌合を開く
          </button>
        </section>

        {/* =====================
            ルール
        ===================== */}

        <div
          style={{
            marginTop: '22px',

            padding: '14px',

            borderTop:
              '1px solid var(--border)',

            color: 'var(--foreground-muted)',

            fontSize: '0.72rem',

            lineHeight: '1.8',
          }}
        >
          評価時は作者名や勝負モードの有無は公開されません。
          <br />
          各句を
          「あし・わろし・なか・よろし・よし」
          の五段階で評価します。
        </div>
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
// 共通ボタン
// =============================

const secondaryButton = {
  width: '100%',

  padding: '11px',

  borderRadius: '10px',

  border: '1px solid var(--border)',

  backgroundColor:
    'var(--input-background)',

  color: 'var(--foreground)',

  fontWeight: 'bold',

  cursor: 'pointer',

  fontSize: '0.85rem',
}
