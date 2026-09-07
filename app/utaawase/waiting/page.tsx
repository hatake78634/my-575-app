'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '../../../lib/supabase'
import BottomNav from '../../components/BottomNav'
import { useAuth } from '../../hooks/useAuth'

// =============================
// 設定
// =============================

const MAX_PLAYERS = 6
const MIN_PLAYERS = 4

const WAIT_SECONDS = 60
const CHECK_INTERVAL_MS = 3000

export default function UtaawaseWaitingPage() {
  const router = useRouter()

  const {
    userId,
    loading: authLoading,
  } = useAuth()

  // =============================
  // 状態
  // =============================

  const [waitingCount, setWaitingCount] = useState(1)

  const [secondsLeft, setSecondsLeft] =
    useState(WAIT_SECONDS)

  const [joinedAt, setJoinedAt] =
    useState<string | null>(null)

  const [isLeaving, setIsLeaving] =
    useState(false)

  const [statusText, setStatusText] =
    useState('歌人を待っています…')

  const [errorText, setErrorText] =
    useState('')

  // 画面遷移の二重実行防止
  const movingRef = useRef(false)
  const queueRequestIdRef = useRef(0)
  const checkMatchInFlightRef = useRef(false)

  // =============================
  // 自分の待機開始時刻を取得
  // =============================

  const loadMyQueue = useCallback(async (
    targetUserId: string
  ) => {
    const requestId = ++queueRequestIdRef.current

    const { data, error } = await supabase
      .from('utaawase_queue')
      .select('joined_at')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (error) {
      console.error(
        '待機状態取得エラー:',
        error
      )

      return {
        requestId,
        targetUserId,
        joinedAt: null,
      }
    }

    return {
      requestId,
      targetUserId,
      joinedAt: data?.joined_at ?? null,
    }
  }, [])

  const applyMyQueueResult = useCallback((result: {
    requestId: number
    targetUserId: string
    joinedAt: string | null
  }) => {
    if (
      result.requestId !== queueRequestIdRef.current
    ) {
      return
    }

    setJoinedAt(result.joinedAt)
  }, [])

  // =============================
  // 現在の待機人数
  // =============================

  const loadWaitingCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('utaawase_queue')
      .select('*', {
        count: 'exact',
        head: true,
      })

    if (error) {
      console.error(
        '待機人数取得エラー:',
        error
      )

      return
    }

    setWaitingCount(
      Math.min(
        count ?? 1,
        MAX_PLAYERS
      )
    )
  }, [])

  // =============================
  // 自分の歌合が成立したか確認
  // =============================

  const checkMyRoom = useCallback(async () => {
    if (
      !userId ||
      movingRef.current
    ) {
      return false
    }

    const { data, error } =
      await supabase.rpc(
        'get_my_active_utaawase'
      )

    if (error) {
      console.error(
        '歌合状態取得エラー:',
        error
      )

      return false
    }

    const room =
      Array.isArray(data)
        ? data[0]
        : data

    if (room?.room_id) {
      movingRef.current = true

      setStatusText(
        '歌合が始まります…'
      )

      router.replace(
        `/utaawase/${room.room_id}`
      )

      return true
    }

    return false
  }, [router, userId])

  // =============================
  // 歌合開始判定
  // =============================

  const tryStartMatch = useCallback(async () => {
    if (movingRef.current) {
      return
    }

    const { data, error } =
      await supabase.rpc(
        'try_start_random_utaawase'
      )

    if (error) {
      console.error(
        '歌合開始判定エラー:',
        error
      )

      return
    }

    if (data) {
      movingRef.current = true

      setStatusText(
        '歌合が始まります…'
      )

      router.replace(
        `/utaawase/${data}`
      )
    }
  }, [router])

  // =============================
  // マッチング状態確認
  // =============================

  const checkMatch = useCallback(async () => {
    if (
      movingRef.current ||
      checkMatchInFlightRef.current
    ) {
      return
    }

    checkMatchInFlightRef.current = true
    setErrorText('')

    try {
      // すでに歌合が成立していないか
      const moved =
        await checkMyRoom()

      if (moved) {
        return
      }

      // 待機人数更新
      await loadWaitingCount()

      // 開始条件を満たしていれば開始
      await tryStartMatch()

      // 別ユーザーが開始させた可能性もあるので再確認
      await checkMyRoom()
    } catch (error) {
      console.error(
        'マッチング確認エラー:',
        error
      )

      setErrorText(
        'マッチング状況を確認できませんでした'
      )
    } finally {
      checkMatchInFlightRef.current = false
    }
  }, [
    checkMyRoom,
    loadWaitingCount,
    tryStartMatch,
  ])

  // =============================
  // 初回処理
  // =============================

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!userId) {
      queueRequestIdRef.current += 1
      router.replace('/auth')
      return
    }

    void loadMyQueue(userId).then((result) => {
      applyMyQueueResult(result)
      void loadWaitingCount().then(() => {
        void checkMatch()
      })
    })
  }, [
    applyMyQueueResult,
    authLoading,
    checkMatch,
    loadMyQueue,
    loadWaitingCount,
    router,
    userId,
  ])

  // =============================
  // 3秒ごとに状態確認
  // =============================

  useEffect(() => {
    if (
      authLoading ||
      !userId
    ) {
      return
    }

    const interval =
      window.setInterval(
        () => {
          void checkMatch()
        },
        CHECK_INTERVAL_MS
      )

    return () => {
      window.clearInterval(interval)
    }
  }, [authLoading, checkMatch, userId])

  // =============================
  // 1分タイマー
  // =============================

  useEffect(() => {
    if (!joinedAt) {
      return
    }

    const updateTimer = () => {
      const start =
        new Date(joinedAt).getTime()

      const elapsed =
        Math.floor(
          (Date.now() - start) /
            1000
        )

      setSecondsLeft(
        Math.max(
          WAIT_SECONDS - elapsed,
          0
        )
      )
    }

    updateTimer()

    const interval =
      window.setInterval(
        updateTimer,
        1000
      )

    return () => {
      window.clearInterval(interval)
    }
  }, [joinedAt])

  // =============================
  // 待機をやめる
  // =============================

  const handleLeave = async () => {
    if (
      isLeaving ||
      movingRef.current
    ) {
      return
    }

    setIsLeaving(true)

    try {
      // キャンセル直前に成立していないか確認
      const moved =
        await checkMyRoom()

      if (moved) {
        return
      }

      const { error } =
        await supabase.rpc(
          'leave_random_utaawase_queue'
        )

      if (error) {
        console.error(
          '待機キャンセルエラー:',
          error
        )

        alert(
          '待機をやめられませんでした'
        )

        return
      }

      router.replace('/utaawase')
    } catch (error) {
      console.error(
        '待機キャンセル処理エラー:',
        error
      )

      alert(
        '待機をやめられませんでした'
      )
    } finally {
      setIsLeaving(false)
    }
  }

  // =============================
  // タイマー表示
  // =============================

  const minutes =
    Math.floor(
      secondsLeft / 60
    )

  const seconds =
    secondsLeft % 60

  const formattedTime =
    `${minutes}:${String(
      seconds
    ).padStart(2, '0')}`

  // =============================
  // 認証読み込み中
  // =============================

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#121212',
          color: '#777',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        歌合の準備中...
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
        backgroundColor: '#121212',
        color: '#fff',
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
            marginBottom: '40px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '1.4rem',
            }}
          >
            ⚔️ 歌合
          </h1>
        </div>

        {/* =====================
            待機カード
        ===================== */}

        <section
          style={{
            backgroundColor: '#1c1c1c',
            border: '1px solid #303030',
            borderRadius: '18px',
            padding: '28px 20px',
            textAlign: 'center',
            boxShadow:
              '0 6px 20px rgba(0,0,0,0.25)',
          }}
        >
          <div
            style={{
              fontSize: '2.3rem',
              marginBottom: '16px',
            }}
          >
            🎴
          </div>

          {/* 状態 */}

          <div
            style={{
              fontSize: '1.05rem',
              fontWeight: 'bold',
              marginBottom: '24px',
            }}
          >
            {statusText}
          </div>

          {/* =====================
              人数
          ===================== */}

          <div
            style={{
              marginBottom: '24px',
            }}
          >
            <div
              style={{
                color: '#888',
                fontSize: '0.75rem',
                marginBottom: '7px',
              }}
            >
              現在の参加者
            </div>

            <div
              style={{
                fontSize: '2rem',
                fontWeight: 'bold',

                color:
                  waitingCount >=
                  MIN_PLAYERS
                    ? '#ffda79'
                    : '#fff',
              }}
            >
              {waitingCount}

              <span
                style={{
                  color: '#777',
                  fontSize: '1rem',
                  marginLeft: '4px',
                }}
              >
                / {MAX_PLAYERS}
              </span>
            </div>

            {/* 人数ドット */}

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'center',
                gap: '7px',
                marginTop: '12px',
              }}
            >
              {Array.from({
                length:
                  MAX_PLAYERS,
              }).map(
                (_, index) => {
                  const active =
                    index <
                    waitingCount

                  return (
                    <div
                      key={index}
                      style={{
                        width: '10px',
                        height: '10px',
                        borderRadius:
                          '50%',

                        backgroundColor:
                          active
                            ? '#ffda79'
                            : '#333',

                        transition:
                          '0.2s',
                      }}
                    />
                  )
                }
              )}
            </div>
          </div>

          {/* =====================
              タイマー
          ===================== */}

          <div
            style={{
              borderTop:
                '1px solid #2b2b2b',

              borderBottom:
                '1px solid #2b2b2b',

              padding: '18px 0',
              marginBottom: '20px',
            }}
          >
            {secondsLeft > 0 ? (
              <>
                <div
                  style={{
                    color: '#777',
                    fontSize:
                      '0.72rem',
                    marginBottom:
                      '6px',
                  }}
                >
                  開幕判定まで
                </div>

                <div
                  style={{
                    fontSize:
                      '1.7rem',

                    fontWeight:
                      'bold',

                    fontVariantNumeric:
                      'tabular-nums',
                  }}
                >
                  {formattedTime}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    color:
                      '#ffda79',

                    fontWeight:
                      'bold',

                    marginBottom:
                      '5px',
                  }}
                >
                  開幕判定中
                </div>

                <div
                  style={{
                    color: '#888',
                    fontSize:
                      '0.75rem',
                  }}
                >
                  四人以上なら
                  歌合を始めます
                </div>
              </>
            )}
          </div>

          {/* =====================
              説明
          ===================== */}

          <div
            style={{
              color: '#888',
              fontSize: '0.76rem',
              lineHeight: '1.9',
              marginBottom: '24px',
            }}
          >
            六人集まれば、
            ただちに開幕します。
            <br />

            一分経過後、
            四人以上集まっていれば
            開幕します。
            <br />

            四人未満の場合は、
            そのまま歌人を待ちます。
          </div>

          {/* エラー */}

          {errorText && (
            <div
              style={{
                color: '#ff8f8f',
                fontSize: '0.75rem',
                marginBottom:
                  '15px',
              }}
            >
              {errorText}
            </div>
          )}

          {/* =====================
              キャンセル
          ===================== */}

          <button
            type="button"
            onClick={handleLeave}
            disabled={isLeaving}
            style={{
              width: '100%',
              padding: '11px',

              backgroundColor:
                'transparent',

              color: '#aaa',

              border:
                '1px solid #444',

              borderRadius: '10px',

              cursor:
                isLeaving
                  ? 'not-allowed'
                  : 'pointer',

              opacity:
                isLeaving
                  ? 0.5
                  : 1,

              fontSize: '0.85rem',
            }}
          >
            {isLeaving
              ? '待機を終了しています...'
              : '待機をやめる'}
          </button>
        </section>

        {/* =====================
            流れ
        ===================== */}

        <div
          style={{
            marginTop: '22px',
            padding: '15px',
            color: '#777',
            fontSize: '0.73rem',
            lineHeight: '1.9',
          }}
        >
          <strong
            style={{
              color: '#aaa',
            }}
          >
            歌合の流れ
          </strong>

          <br />

          待機 1分
          {' → '}
          作句 4分
          {' → '}
          評価 5分

          <br />

          一試合およそ10分です。
        </div>
      </main>

      <BottomNav
        currentUserId={userId}
      />
    </div>
  )
}
