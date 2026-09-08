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

import {
  supabase,
} from '../../../lib/supabase'

import BottomNav from '../../components/BottomNav'

import {
  useAuth,
} from '../../hooks/useAuth'

// =============================
// 型
// =============================

type Room = {
  room_id: string

  room_status: string

  room_type: string

  theme: string | null

  writing_starts_at:
    | string
    | null

  writing_ends_at:
    | string
    | null

  rating_starts_at:
    | string
    | null

  rating_ends_at:
    | string
    | null

  created_by:
    | string
    | null

  round_number: number

  session_ends_at:
    | string
    | null
}

type RatingEntry = {
  entry_id: string

  first_line: string

  second_line: string

  third_line: string

  joshi:
    | string
    | null

  display_position: number

  total_entries: number
}

type UtaawaseResult = {
  room_theme:
    | string
    | null

  room_type: string

  user_id: string

  username: string

  avatar_url:
    | string
    | null

  submitted: boolean

  first_line:
    | string
    | null

  second_line:
    | string
    | null

  third_line:
    | string
    | null

  joshi:
    | string
    | null

  average_score:
    | number
    | null

  rating_count: number

  final_rank:
    | number
    | null

  is_me: boolean

  my_is_competitive:
    | boolean
    | null

  my_rating_before:
    | number
    | null

  my_rating_change:
    | number
    | null

  my_rating_after:
    | number
    | null
}

// =============================
// 五段階評価
// =============================

const SCORE_LABELS: {
  [key: number]:
    string
} = {
  1: 'あし',

  2: 'わろし',

  3: 'なか',

  4: 'よろし',

  5: 'よし',
}

// =============================
// ページ
// =============================

export default function UtaawaseRoomPage() {
  const params =
    useParams()

  const router =
    useRouter()

  const roomId =
    params.id as string

  const {
    userId,

    loading:
      authLoading,
  } = useAuth()

  // =============================
  // ルーム
  // =============================

  const [
    room,
    setRoom,
  ] =
    useState<Room | null>(
      null
    )

  const [
    loading,
    setLoading,
  ] =
    useState(true)

  const [
    errorText,
    setErrorText,
  ] =
    useState('')

  // 同じラウンドの結果を何度も再取得しない
  const loadedResultRoundRef =
    useRef<number | null>(null)
  const roomRequestIdRef = useRef(0)
  const submittedRequestIdRef = useRef(0)
  const nextEntryRequestIdRef = useRef(0)
  const appliedRoundRef = useRef<number | null>(null)

  const [
    roomActionLoading,
    setRoomActionLoading,
  ] =
    useState(false)

  const [
    nextTheme,
    setNextTheme,
  ] =
    useState('')

  // =============================
  // 結果
  // =============================

  const [
    results,
    setResults,
  ] =
    useState<
      UtaawaseResult[]
    >([])

  const [
    resultsLoading,
    setResultsLoading,
  ] =
    useState(false)

  const [
    resultsError,
    setResultsError,
  ] =
    useState('')

  // =============================
  // 作句
  // =============================

  const [
    firstLine,
    setFirstLine,
  ] =
    useState('')

  const [
    secondLine,
    setSecondLine,
  ] =
    useState('')

  const [
    thirdLine,
    setThirdLine,
  ] =
    useState('')

  const [
    joshi,
    setJoshi,
  ] =
    useState('')

  const [
    submitted,
    setSubmitted,
  ] =
    useState(false)

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false)

  // 同じラウンドで一度提出成功したら、
  // DB再確認の遅い応答で未提出に戻さない
  const submittedRoundRef =
    useRef<number | null>(null)

  // =============================
  // 評価
  // =============================

  const [
    ratingEntry,
    setRatingEntry,
  ] =
    useState<RatingEntry | null>(
      null
    )

  const [
    selectedScore,
    setSelectedScore,
  ] =
    useState<
      number | null
    >(null)

  const [
    ratingLoading,
    setRatingLoading,
  ] =
    useState(false)

  const [
    sendingRating,
    setSendingRating,
  ] =
    useState(false)

  const [
    ratingComplete,
    setRatingComplete,
  ] =
    useState(false)

  const [loadedNextEntryTarget, setLoadedNextEntryTarget] =
    useState<{
      roomId: string
      userId: string
    } | null>(null)

  // =============================
  // タイマー
  // =============================

  const [timerState, setTimerState] = useState<{
    endString: string
    secondsLeft: number
  } | null>(null)
  const [nowMs, setNowMs] = useState<number | null>(null)

  // =============================
  // 結果取得
  // =============================

  const loadResults =
    useCallback(
      async () => {
        if (
          !userId ||
          !roomId
        ) {
          return
        }

        setResultsLoading(
          true
        )

        setResultsError(
          ''
        )

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'get_utaawase_results',
              {
                p_room_id:
                  roomId,
              }
            )

          if (error) {
            console.error(
              '結果取得エラー:',
              error
            )

            setResultsError(
              error.message ||
                '結果を取得できませんでした'
            )

            return
          }

          setResults(
            Array.isArray(
              data
            )
              ? data
              : []
          )
        } catch (error) {
          console.error(
            '結果取得処理エラー:',
            error
          )

          setResultsError(
            '結果を取得できませんでした'
          )
        } finally {
          setResultsLoading(
            false
          )
        }
      },
      [
        userId,
        roomId,
      ]
    )

  // =============================
  // ルーム取得
  // =============================

  const fetchRoom =
    useCallback(
      async (
        targetRoomId: string,
        targetUserId: string
      ): Promise<RoomLoadResult> => {
        const requestId = ++roomRequestIdRef.current

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_my_utaawase_room',
            {
              p_room_id:
                targetRoomId,
            }
          )

        if (error) {
          console.error(
            '歌合取得エラー:',
            error
          )

          return {
            requestId,
            targetRoomId,
            targetUserId,
            status: 'error',
            room: null,
            errorText: '歌合の情報を取得できませんでした',
          }
        }

        const nextRoom =
          Array.isArray(data)
            ? data[0]
            : data

        return {
          requestId,
          targetRoomId,
          targetUserId,
          status: nextRoom ? 'success' : 'error',
          room: (nextRoom ?? null) as Room | null,
          errorText: nextRoom
            ? ''
            : '歌合を取得できませんでした',
        }
      },
      []
    )

  const applyRoomResult = useCallback(
    (result: RoomLoadResult) => {
      if (result.requestId !== roomRequestIdRef.current) {
        return
      }

      if (result.status === 'error') {
        setErrorText(result.errorText)
        setLoading(false)
        return
      }

      if (
        result.room &&
        appliedRoundRef.current !== result.room.round_number
      ) {
        appliedRoundRef.current = result.room.round_number
        setFirstLine('')
        setSecondLine('')
        setThirdLine('')
        setJoshi('')
        submittedRoundRef.current = null
        setSubmitted(false)
        setRatingEntry(null)
        setSelectedScore(null)
        setRatingComplete(false)
        setLoadedNextEntryTarget(null)
        setResults([])
        setResultsError('')
        setNextTheme('')
        loadedResultRoundRef.current = null
      }

      setRoom(result.room)
      setErrorText(result.errorText)
      setLoading(false)
    },
    []
  )

  const loadRoom = useCallback(async () => {
    if (!userId || !roomId) {
      return
    }

    const result = await fetchRoom(roomId, userId)
    applyRoomResult(result)
  }, [applyRoomResult, fetchRoom, roomId, userId])

  // =============================
  // 提出済み確認
  // =============================

  const fetchSubmitted =
    useCallback(
      async (
        targetRoomId: string,
        targetUserId: string,
        roomType: string,
        roundNumber: number
      ): Promise<SubmittedLoadResult> => {
        const requestId = ++submittedRequestIdRef.current

        let query =
          supabase
            .from(
              'utaawase_entries'
            )
            .select('id')
            .eq(
              'room_id',
              targetRoomId
            )
            .eq(
              'user_id',
              targetUserId
            )

        if (
          roomType ===
            'public'
        ) {
          query =
            query.eq(
              'round_number',
              roundNumber
            )
        }

        const {
          data,
          error,
        } =
          await query.limit(1)

        if (error) {
          console.error(
            '提出確認エラー:',
            error
          )
          return {
            requestId,
            targetRoomId,
            targetUserId,
            roundNumber,
            status: 'error',
            submitted: false,
          }
        }

        const hasSubmitted =
          Array.isArray(data) &&
          data.length > 0

        return {
          requestId,
          targetRoomId,
          targetUserId,
          roundNumber,
          status: 'success',
          submitted: hasSubmitted,
        }
      },
      []
    )

  const applySubmittedResult = useCallback(
    (result: SubmittedLoadResult) => {
      if (
        result.requestId !== submittedRequestIdRef.current ||
        result.status === 'error'
      ) {
        return
      }

      if (result.submitted) {
        submittedRoundRef.current = result.roundNumber
        setSubmitted(true)
        return
      }

      if (submittedRoundRef.current === result.roundNumber) {
        return
      }

      setSubmitted(false)
    },
    []
  )

  // =============================
  // 時間経過処理
  // =============================

  const tickRoom =
    useCallback(
      async () => {
        if (
          !userId ||
          !roomId
        ) {
          return
        }

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'tick_my_utaawase',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          console.error(
            '歌合時間処理エラー:',
            error
          )

          return
        }

        // =========================
        // 終了
        // =========================

        if (
          data ===
          'finished'
        ) {
          // 最新のroom状態だけ取得する。
          // 結果取得は下のfinished監視useEffectで
          // ラウンドごとに1回だけ行う。
          await loadRoom()
          return
        }

        // closed / writing / rating を含めて更新
        await loadRoom()
      },
      [
        userId,
        roomId,
        loadRoom,
      ]
    )

  // =============================
  // 次の匿名句
  // =============================

  const fetchNextEntry =
    useCallback(
      async (
        targetRoomId: string,
        targetUserId: string
      ): Promise<NextEntryLoadResult> => {
        const requestId = ++nextEntryRequestIdRef.current
        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'get_next_utaawase_entry',
              {
                p_room_id:
                  targetRoomId,
              }
            )

          if (error) {
            console.error(
              '評価句取得エラー:',
              error
            )

            return {
              requestId,
              targetRoomId,
              targetUserId,
              status: 'error',
              entry: null,
            }
          }

          const next =
            Array.isArray(
              data
            )
              ? data[0]
              : data

          // =========================
          // 全句評価終了
          // =========================

          return {
            requestId,
            targetRoomId,
            targetUserId,
            status: 'success',
            entry: (next ?? null) as RatingEntry | null,
          }
        } catch (error) {
          console.error(
            '評価句取得処理エラー:',
            error
          )
          return {
            requestId,
            targetRoomId,
            targetUserId,
            status: 'error',
            entry: null,
          }
        }
      },
      []
    )

  const applyNextEntryResult = useCallback(async (
    result: NextEntryLoadResult
  ) => {
    if (result.requestId !== nextEntryRequestIdRef.current) {
      return
    }

    setLoadedNextEntryTarget({
      roomId: result.targetRoomId,
      userId: result.targetUserId,
    })

    if (result.status === 'error') {
      setRatingLoading(false)
      return
    }

    setRatingEntry(result.entry)
    setSelectedScore(null)
    setRatingComplete(!result.entry)
    setRatingLoading(false)

    if (!result.entry) {
      await tickRoom()
    }
  }, [tickRoom])

  const loadNextEntry = useCallback(async () => {
    if (!userId || !roomId) {
      return
    }

    setRatingLoading(true)
    const result = await fetchNextEntry(roomId, userId)
    await applyNextEntryResult(result)
  }, [applyNextEntryResult, fetchNextEntry, roomId, userId])

  // =============================
  // 初回取得
  // =============================

  const currentRoomId = room?.room_id
  const currentRoomType = room?.room_type
  const currentRoundNumber = room?.round_number
  const currentRoomStatus = room?.room_status

  useEffect(() => {
    if (authLoading) {
      return
    }

    if (!userId) {
      roomRequestIdRef.current += 1
      submittedRequestIdRef.current += 1
      nextEntryRequestIdRef.current += 1
      return
    }

    void fetchRoom(roomId, userId).then(applyRoomResult)
  }, [
    applyRoomResult,
    authLoading,
    fetchRoom,
    roomId,
    userId,
  ])

  // =============================
  // 現在ラウンドの提出状態
  // =============================

  useEffect(() => {
    if (
      !currentRoomId ||
      !currentRoomType ||
      !userId ||
      currentRoundNumber === undefined ||
      currentRoomStatus !==
        'writing'
    ) {
      return
    }

    void fetchSubmitted(
      currentRoomId,
      userId,
      currentRoomType,
      currentRoundNumber
    ).then(applySubmittedResult)
  }, [
    applySubmittedResult,
    fetchSubmitted,
    currentRoomId,
    currentRoomType,
    currentRoundNumber,
    currentRoomStatus,
    userId,
  ])

  // =============================
  // 結果取得
  //
  // finishedになった瞬間だけ、
  // そのラウンドの結果を1回取得する。
  // =============================

  useEffect(() => {
    if (
      currentRoundNumber === undefined ||
      currentRoomStatus !==
        'finished'
    ) {
      return
    }

    if (
      loadedResultRoundRef.current ===
      currentRoundNumber
    ) {
      return
    }

    // 非同期処理を始める前に記録して、
    // 2秒ポーリングとの二重実行を防ぐ。
    loadedResultRoundRef.current =
      currentRoundNumber

    void loadResults()
  }, [
    currentRoomStatus,
    currentRoundNumber,
    loadResults,
  ])

  // =============================
  // 定期確認（1本だけ）
  //
  // finished中はtick RPCを連打せず、
  // room状態だけ監視する。
  // ホストが次戦を開始したらwritingを検知する。
  // =============================

  useEffect(() => {
    if (
      authLoading ||
      !userId ||
      room?.room_status ===
        'closed'
    ) {
      return
    }

    const interval =
      window.setInterval(
        () => {
          if (
            room?.room_status ===
              'finished'
          ) {
            void loadRoom()
            return
          }

          void tickRoom()
        },
        2000
      )

    return () => {
      window.clearInterval(
        interval
      )
    }
  }, [
    authLoading,
    userId,
    room?.room_status,
    loadRoom,
    tickRoom,
  ])

  // =============================
  // 評価開始
  // =============================

  useEffect(() => {
    if (
      room?.room_status !==
        'rating' ||
      !userId ||
      ratingEntry ||
      ratingComplete
    ) {
      return
    }

    void fetchNextEntry(roomId, userId).then(
      applyNextEntryResult
    )
  }, [
    applyNextEntryResult,
    fetchNextEntry,
    roomId,
    room?.room_status,
    ratingEntry,
    ratingComplete,
    userId,
  ])

  // =============================
  // タイマー
  // =============================

  useEffect(() => {
    if (!room) {
      return
    }

    let endString:
      | string
      | null =
      null

    // 作句
    if (
      room.room_status ===
      'writing'
    ) {
      endString =
        room.writing_ends_at
    }

    // 評価
    if (
      room.room_status ===
      'rating'
    ) {
      endString =
        room.rating_ends_at
    }

    if (
      !endString
    ) {
      return
    }

    const updateTimer =
      () => {
        const end =
          new Date(
            endString!
          ).getTime()

        const diff =
          Math.ceil(
            (
              end -
              Date.now()
            ) /
              1000
          )

        setTimerState({
          endString,
          secondsLeft: Math.max(diff, 0),
        })
      }

    updateTimer()

    const interval =
      window.setInterval(
        updateTimer,
        1000
      )

    return () => {
      window.clearInterval(
        interval
      )
    }
  }, [
    room,
  ])

  useEffect(() => {
    if (!room?.session_ends_at) {
      return
    }

    let interval: number | null = null
    const frame = window.requestAnimationFrame(() => {
      setNowMs(Date.now())
      interval = window.setInterval(() => {
        setNowMs(Date.now())
      }, 60000)
    })

    return () => {
      window.cancelAnimationFrame(frame)
      if (interval !== null) {
        window.clearInterval(interval)
      }
    }
  }, [room?.session_ends_at])

  // =============================
  // 作句提出
  // =============================

  const handleSubmit =
    async () => {
      if (
        submitting ||
        submitted
      ) {
        return
      }

      if (
        !firstLine.trim() ||
        !secondLine.trim() ||
        !thirdLine.trim()
      ) {
        alert(
          '三句すべて入力してください'
        )

        return
      }

      if (
        secondsLeft <=
        0
      ) {
        alert(
          '作句時間は終了しました'
        )

        return
      }

      setSubmitting(
        true
      )

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'submit_utaawase_entry',
            {
              p_room_id:
                roomId,

              p_first_line:
                firstLine.trim(),

              p_second_line:
                secondLine.trim(),

              p_third_line:
                thirdLine.trim(),

              p_joshi:
                joshi.trim() ||
                null,
            }
          )

        if (error) {
          console.error(
            '提出エラー:',
            error
          )

          alert(
            error.message ||
              '提出に失敗しました'
          )

          return
        }

        submittedRoundRef.current =
          room?.round_number ?? null

        setSubmitted(
          true
        )
      } catch (error) {
        console.error(
          '提出処理エラー:',
          error
        )

        alert(
          '提出中にエラーが発生しました'
        )
      } finally {
        setSubmitting(
          false
        )
      }
    }

  // =============================
  // 評価送信
  // =============================

  const handleRatingSubmit =
    async () => {
      if (
        !ratingEntry ||
        selectedScore ===
          null ||
        sendingRating
      ) {
        return
      }

      setSendingRating(
        true
      )

      try {
        const {
          error,
        } =
          await supabase.rpc(
            'submit_utaawase_rating',
            {
              p_room_id:
                roomId,

              p_entry_id:
                ratingEntry.entry_id,

              p_score:
                selectedScore,
            }
          )

        if (error) {
          console.error(
            '評価送信エラー:',
            error
          )

          alert(
            error.message ||
              '評価を送信できませんでした'
          )

          return
        }

        setRatingEntry(
          null
        )

        setSelectedScore(
          null
        )

        await loadNextEntry()
      } catch (error) {
        console.error(
          '評価処理エラー:',
          error
        )

        alert(
          '評価中にエラーが発生しました'
        )
      } finally {
        setSendingRating(
          false
        )
      }
    }

  // =============================
  // 一般公開：次の歌合へ
  // =============================

  const handleNextPublicRound =
    async () => {
      if (
        roomActionLoading ||
        !room ||
        room.room_type !==
          'public' ||
        room.created_by !==
          userId
      ) {
        return
      }

      const trimmedNextTheme =
        nextTheme.trim()

      if (
        trimmedNextTheme.length >
        30
      ) {
        alert(
          'お題は30文字以内で入力してください'
        )
        return
      }

      setRoomActionLoading(true)

      try {
        const { error } =
          await supabase.rpc(
            'start_next_public_utaawase_round',
            {
              p_room_id:
                roomId,

              p_theme:
                trimmedNextTheme ||
                null,
            }
          )

        if (error) {
          alert(
            error.message ||
              '次の歌合を開始できませんでした'
          )
          return
        }

        setNextTheme('')
        await loadRoom()
      } finally {
        setRoomActionLoading(false)
      }
    }

  // =============================
  // 一般公開：閉幕
  // =============================

  const handleClosePublicRoom =
    async () => {
      if (
        roomActionLoading ||
        !room ||
        room.room_type !==
          'public' ||
        room.created_by !==
          userId
      ) {
        return
      }

      if (
        !window.confirm(
          'この公開歌合を閉幕しますか？'
        )
      ) {
        return
      }

      setRoomActionLoading(true)

      try {
        const { error } =
          await supabase.rpc(
            'finish_public_utaawase_room',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          alert(
            error.message ||
              '歌合を閉幕できませんでした'
          )
          return
        }

        await loadRoom()
      } finally {
        setRoomActionLoading(false)
      }
    }

  // =============================
  // 時間表示
  // =============================

  const timerEndString =
    room?.room_status === 'writing'
      ? room.writing_ends_at
      : room?.room_status === 'rating'
        ? room.rating_ends_at
        : null

  const secondsLeft =
    timerEndString &&
    timerState?.endString === timerEndString
      ? timerState.secondsLeft
      : 0

  const effectiveRatingLoading =
    ratingLoading ||
    (room?.room_status === 'rating' &&
      userId !== null &&
      (loadedNextEntryTarget?.roomId !== roomId ||
        loadedNextEntryTarget.userId !== userId))

  const minutes =
    Math.floor(
      secondsLeft /
        60
    )

  const seconds =
    secondsLeft %
    60

  const formattedTime =
    `${minutes}:${String(
      seconds
    ).padStart(
      2,
      '0'
    )}`

  const isPublicRoom =
    room?.room_type ===
    'public'

  const isHost =
    Boolean(
      room &&
        userId &&
        room.created_by ===
          userId
    )

  const sessionExpired =
    Boolean(
      nowMs !== null &&
      room?.session_ends_at &&
        new Date(
          room.session_ends_at
        ).getTime() <=
          nowMs
    )

  // =============================
  // 読み込み
  // =============================

  if (
    authLoading ||
    loading
  ) {
    return (
      <FullScreenMessage
        text="歌合を開いています..."
      />
    )
  }

  // =============================
  // 公開歌合・閉幕
  // =============================

  if (
    room?.room_status ===
      'closed'
  ) {
    return (
      <div style={pageStyle}>
        <main style={mainStyle}>
          <section
            style={{
              ...cardStyle,
              textAlign: 'center',
              padding: '44px 20px',
            }}
          >
            <div
              style={{
                fontSize: '2.2rem',
                marginBottom: '16px',
              }}
            >
              🌸
            </div>

            <h1
              style={{
                fontSize: '1.35rem',
                margin: '0 0 12px',
              }}
            >
              公開歌合・閉幕
            </h1>

            <div
              style={{
                color: 'var(--foreground-muted)',
                fontSize: '0.82rem',
                lineHeight: '1.8',
              }}
            >
              此度の歌合はこれにて結びです。
              <br />
              ご参加ありがとうございました。
            </div>

            <button
              type="button"
              onClick={() =>
                router.replace(
                  '/utaawase'
                )
              }
              style={{
                ...secondaryButton,
                marginTop: '24px',
              }}
            >
              歌合へ戻る
            </button>
          </section>
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
  // 結果発表
  // =============================

  if (room?.room_status === 'finished') {
    const myResult =
      results.find(
        (result) =>
          result.is_me
      )

    const theme =
      results[0]
        ?.room_theme ??
      room?.theme ??
      '――'

    return (
      <div
        style={
          pageStyle
        }
      >
        <main
          style={
            mainStyle
          }
        >
          {/* =====================
              タイトル
          ===================== */}

          <div
            style={{
              marginBottom:
                '28px',
            }}
          >
            <h1
              style={{
                margin: 0,

                fontSize:
                  '1.4rem',
              }}
            >
              ⚔️ 歌合・結
            </h1>
          </div>

          {/* =====================
              お題
          ===================== */}

          <ThemeCard
            theme={
              theme
            }
          />

          {/* =====================
              読み込み
          ===================== */}

          {resultsLoading ? (
            <section
              style={{
                ...cardStyle,

                textAlign:
                  'center',

                color:
                  'var(--foreground-muted)',
              }}
            >
              評価を集計しています...
            </section>
          ) : resultsError ? (
            <section
              style={{
                ...cardStyle,

                textAlign:
                  'center',
              }}
            >
              <div
                style={{
                  color:
                    'var(--danger)',

                  marginBottom:
                    '15px',
                }}
              >
                {
                  resultsError
                }
              </div>

              <button
                type="button"

                onClick={() => {
                  void loadResults()
                }}

                style={
                  secondaryButton
                }
              >
                もう一度読み込む
              </button>
            </section>
          ) : (
            <>
              {/* =====================
                  結果一覧
              ===================== */}

              <div
                style={{
                  display:
                    'flex',

                  flexDirection:
                    'column',

                  gap:
                    '12px',
                }}
              >
                {results.map(
                  (
                    result
                  ) => {
                    const rank =
                      result.final_rank

                    const score =
                      result.average_score

                    let rankLabel =
                      '順位なし'

                    if (
                      rank === 1
                    ) {
                      rankLabel =
                        '第一位'
                    } else if (
                      rank === 2
                    ) {
                      rankLabel =
                        '第二位'
                    } else if (
                      rank === 3
                    ) {
                      rankLabel =
                        '第三位'
                    } else if (
                      rank
                    ) {
                      rankLabel =
                        `第${rank}位`
                    }

                    return (
                      <section
                        key={
                          result.user_id
                        }

                        style={{
                          ...cardStyle,

                          border:
                            rank ===
                            1
                              ? '1px solid var(--border)'
                              : result.is_me
                                ? '1px solid var(--border)'
                                : '1px solid var(--border)',

                          backgroundColor:
                            rank ===
                            1
                              ? 'var(--surface-elevated)'
                              : 'var(--surface)',
                        }}
                      >
                        {/* =====================
                            順位
                        ===================== */}

                        <div
                          style={{
                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            alignItems:
                              'center',

                            marginBottom:
                              '18px',
                          }}
                        >
                          <div
                            style={{
                              color:
                                rank ===
                                1
                                  ? 'var(--primary)'
                                  : 'var(--foreground-muted)',

                              fontWeight:
                                'bold',

                              fontSize:
                                rank ===
                                1
                                  ? '1.05rem'
                                  : '0.9rem',
                            }}
                          >
                            {rank ===
                              1 &&
                              '🏆 '}

                            {
                              rankLabel
                            }
                          </div>

                          {result.submitted &&
                            score !==
                              null && (
                              <div
                                style={{
                                  color:
                                    'var(--foreground-muted)',

                                  fontSize:
                                    '0.78rem',
                                }}
                              >
                                平均{' '}

                                <strong
                                  style={{
                                    color:
                                      'var(--primary)',
                                  }}
                                >
                                  {Number(
                                    score
                                  ).toFixed(
                                    2
                                  )}
                                </strong>
                              </div>
                            )}
                        </div>

                        {/* =====================
                            句
                        ===================== */}

                        {result.submitted ? (
                          <>
                            {result.joshi && (
                              <div
                                style={{
                                  textAlign:
                                    'center',

                                  color:
                                    'var(--foreground-muted)',

                                  fontSize:
                                    '0.82rem',

                                  fontStyle:
                                    'italic',

                                  marginBottom:
                                    '12px',
                                }}
                              >
                                {
                                  result.joshi
                                }
                              </div>
                            )}

                            <div
                              style={{
                                width:
                                  'fit-content',

                                margin:
                                  '0 auto',

                                fontSize:
                                  rank ===
                                  1
                                    ? '1.18rem'
                                    : '1.05rem',

                                fontWeight:
                                  'bold',

                                lineHeight:
                                  '2',

                                letterSpacing:
                                  '2px',
                              }}
                            >
                              <div>
                                {
                                  result.first_line
                                }
                              </div>

                              <div
                                style={{
                                  marginLeft:
                                    '24px',
                                }}
                              >
                                {
                                  result.second_line
                                }
                              </div>

                              <div
                                style={{
                                  marginLeft:
                                    '48px',
                                }}
                              >
                                {
                                  result.third_line
                                }
                              </div>
                            </div>
                          </>
                        ) : (
                          <div
                            style={{
                              textAlign:
                                'center',

                              color:
                                'var(--foreground-muted)',

                              padding:
                                '15px 0',
                            }}
                          >
                            未提出
                          </div>
                        )}

                        {/* =====================
                            作者
                        ===================== */}

                        <div
                          style={{
                            borderTop:
                              '1px solid var(--border)',

                            marginTop:
                              '20px',

                            paddingTop:
                              '13px',

                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            alignItems:
                              'center',
                          }}
                        >
                          <div
                            style={{
                              color:
                                'var(--foreground-muted)',

                              fontSize:
                                '0.72rem',
                            }}
                          >
                            詠み人
                          </div>

                          <div
                            style={{
                              color:
                                result.is_me
                                  ? 'var(--primary)'
                                  : 'var(--foreground)',

                              fontWeight:
                                result.is_me
                                  ? 'bold'
                                  : 'normal',

                              fontSize:
                                '0.85rem',
                            }}
                          >
                            {
                              result.username
                            }

                            {result.is_me &&
                              '（あなた）'}
                          </div>
                        </div>

                        {/* =====================
                            評価人数
                        ===================== */}

                        {result.submitted && (
                          <div
                            style={{
                              textAlign:
                                'right',

                              color:
                                'var(--foreground-muted)',

                              fontSize:
                                '0.65rem',

                              marginTop:
                                '6px',
                            }}
                          >
                            {
                              result.rating_count
                            }
                            人が評価
                          </div>
                        )}
                      </section>
                    )
                  }
                )}
              </div>

              {/* =====================
                  勝負モード
              ===================== */}

              {myResult
                ?.my_is_competitive && (
                <section
                  style={{
                    ...cardStyle,

                    marginTop:
                      '20px',

                    border:
                      '1px solid color-mix(in srgb, var(--danger) 55%, var(--border))',
                  }}
                >
                  <div
                    style={{
                      color:
                        'var(--danger)',

                      fontWeight:
                        'bold',

                      marginBottom:
                        '18px',
                    }}
                  >
                    ⚔️ 勝負モード
                  </div>

                  <div
                    style={{
                      display:
                        'flex',

                      justifyContent:
                        'space-between',

                      alignItems:
                        'center',
                    }}
                  >
                    <div
                      style={{
                        color:
                          'var(--foreground-muted)',

                        fontSize:
                          '0.8rem',
                      }}
                    >
                      Rating
                    </div>

                    <div
                      style={{
                        fontWeight:
                          'bold',

                        fontSize:
                          '1.1rem',
                      }}
                    >
                      {
                        myResult.my_rating_before ??
                        '―'
                      }

                      <span
                        style={{
                          color:
                            'var(--foreground-muted)',

                          margin:
                            '0 10px',
                        }}
                      >
                        →
                      </span>

                      {
                        myResult.my_rating_after ??
                        '―'
                      }
                    </div>
                  </div>

                  {myResult.my_rating_change !==
                    null && (
                    <div
                      style={{
                        textAlign:
                          'right',

                        marginTop:
                          '10px',

                        fontWeight:
                          'bold',

                        fontSize:
                          '1.05rem',

                        color:
                          myResult.my_rating_change >
                          0
                            ? 'var(--primary)'
                            : myResult.my_rating_change <
                                0
                              ? 'var(--danger)'
                              : 'var(--foreground-muted)',
                      }}
                    >
                      {myResult.my_rating_change >
                        0
                        ? '+'
                        : ''}

                      {
                        myResult.my_rating_change
                      }
                    </div>
                  )}
                </section>
              )}

              {/* =====================
                  公開歌合の連戦操作
              ===================== */}

              {isPublicRoom ? (
                <section
                  style={{
                    ...cardStyle,
                    marginTop: '20px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      color: 'var(--foreground-muted)',
                      fontSize: '0.8rem',
                      marginBottom: '14px',
                      lineHeight: '1.7',
                    }}
                  >
                    第{room?.round_number ?? 1}戦 終了
                  </div>

                  {isHost ? (
                    <>
                      {!sessionExpired && (
                        <>
                          <div
                            style={{
                              textAlign:
                                'left',
                              marginBottom:
                                '14px',
                            }}
                          >
                            <label
                              style={{
                                display:
                                  'block',

                                color:
                                  'var(--foreground-muted)',

                                fontSize:
                                  '0.75rem',

                                fontWeight:
                                  'bold',

                                marginBottom:
                                  '7px',
                              }}
                            >
                              次のお題
                              <span
                                style={{
                                  color:
                                    'var(--foreground-muted)',

                                  marginLeft:
                                    '6px',

                                  fontWeight:
                                    'normal',
                                }}
                              >
                                任意
                              </span>
                            </label>

                            <input
                              type="text"

                              value={
                                nextTheme
                              }

                              onChange={(
                                event
                              ) =>
                                setNextTheme(
                                  event
                                    .target
                                    .value
                                )
                              }

                              maxLength={
                                30
                              }

                              placeholder="空欄ならランダムで決まります"

                              disabled={
                                roomActionLoading
                              }

                              style={{
                                ...inputStyle,
                                marginTop:
                                  0,
                              }}
                            />

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

                                marginTop:
                                  '6px',
                              }}
                            >
                              <span
                                style={{
                                  color:
                                    'var(--foreground-muted)',

                                  fontSize:
                                    '0.68rem',

                                  lineHeight:
                                    '1.5',
                                }}
                              >
                                入力したお題は、
                                次戦開始と同時に
                                全員へ公開されます。
                              </span>

                              <span
                                style={{
                                  color:
                                    'var(--foreground-muted)',

                                  fontSize:
                                    '0.62rem',

                                  flexShrink:
                                    0,
                                }}
                              >
                                {
                                  nextTheme.length
                                }
                                /30
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void handleNextPublicRound()
                            }}
                            disabled={roomActionLoading}
                            style={{
                              width: '100%',
                              padding: '13px',
                              border: 'none',
                              borderRadius: '10px',
                              backgroundColor: 'var(--primary)',
                              color: 'var(--page-background)',
                              fontWeight: 'bold',
                              cursor: roomActionLoading
                                ? 'not-allowed'
                                : 'pointer',
                              opacity: roomActionLoading
                                ? 0.55
                                : 1,
                            }}
                          >
                            {roomActionLoading
                              ? '次の歌合を始めています…'
                              : '⚔️ 次の歌合へ'}
                          </button>
                        </>
                      )}

                      {sessionExpired && (
                        <div
                          style={{
                            color: 'var(--foreground-muted)',
                            fontSize: '0.8rem',
                            marginBottom: '14px',
                          }}
                        >
                          30分の開催時間が終了しました
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          void handleClosePublicRoom()
                        }}
                        disabled={roomActionLoading}
                        style={{
                          ...secondaryButton,
                          marginTop: '12px',
                        }}
                      >
                        🌸 この歌合を閉幕する
                      </button>
                    </>
                  ) : (
                    <div
                      style={{
                        color: 'var(--foreground-muted)',
                        fontSize: '0.82rem',
                        lineHeight: '1.8',
                      }}
                    >
                      主催者が次の歌合を準備しています…
                    </div>
                  )}
                </section>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    router.replace(
                      '/utaawase'
                    )
                  }
                  style={{
                    width: '100%',
                    marginTop: '20px',
                    padding: '13px',
                    border: 'none',
                    borderRadius: '10px',
                    backgroundColor: 'var(--primary)',
                    color: 'var(--page-background)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                  }}
                >
                  歌合へ戻る
                </button>
              )}
            </>
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
  // ルーム取得失敗
  // =============================

  if (!room) {
    return (
      <div
        style={
          pageStyle
        }
      >
        <main
          style={
            mainStyle
          }
        >
          <h2>
            ⚔️ 歌合
          </h2>

          <p
            style={{
              color:
                'var(--foreground-muted)',

              lineHeight:
                '1.7',
            }}
          >
            {errorText ||
              '歌合を取得できませんでした'}
          </p>

          <button
            type="button"

            onClick={() =>
              router.replace(
                '/utaawase'
              )
            }

            style={
              secondaryButton
            }
          >
            歌合へ戻る
          </button>
        </main>
      </div>
    )
  }

  // =============================
  // 評価フェーズ
  // =============================

  if (
    room.room_status ===
    'rating'
  ) {
    return (
      <div
        style={
          pageStyle
        }
      >
        <main
          style={
            mainStyle
          }
        >
          {/* =====================
              ヘッダー
          ===================== */}

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              marginBottom:
                '24px',
            }}
          >
            <h1
              style={{
                margin: 0,

                fontSize:
                  '1.4rem',
              }}
            >
              ⚔️ 歌合
            </h1>

            <Timer
              time={
                formattedTime
              }

              danger={
                secondsLeft <=
                30
              }
            />
          </div>

          <ThemeCard
            theme={
              room.theme
            }
          />

          {/* =====================
              評価終了
          ===================== */}

          {ratingComplete ? (
            <section
              style={{
                ...cardStyle,

                textAlign:
                  'center',

                padding:
                  '40px 20px',
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
                  fontWeight:
                    'bold',

                  marginBottom:
                    '10px',
                }}
              >
                評価を終えました
              </div>

              <div
                style={{
                  color:
                    'var(--foreground-muted)',

                  fontSize:
                    '0.8rem',

                  lineHeight:
                    '1.8',
                }}
              >
                他の歌人の評価を待っています。
                <br />

                全員が終われば、
                ただちに結果を発表します。
              </div>
            </section>
          ) : effectiveRatingLoading ? (
            <section
              style={{
                ...cardStyle,

                textAlign:
                  'center',

                color:
                  'var(--foreground-muted)',
              }}
            >
              次の句を開いています...
            </section>
          ) : ratingEntry ? (
            <section
              style={
                cardStyle
              }
            >
              {/* =====================
                  進捗
              ===================== */}

              <div
                style={{
                  display:
                    'flex',

                  justifyContent:
                    'space-between',

                  alignItems:
                    'center',

                  marginBottom:
                    '25px',
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
                  評価の刻
                </div>

                <div
                  style={{
                    color:
                      'var(--foreground-muted)',

                    fontSize:
                      '0.75rem',
                  }}
                >
                  {
                    ratingEntry.display_position
                  }

                  {' / '}

                  {
                    ratingEntry.total_entries
                  }
                </div>
              </div>

              {/* =====================
                  匿名句
              ===================== */}

              <div
                style={{
                  minHeight:
                    '190px',

                  display:
                    'flex',

                  flexDirection:
                    'column',

                  justifyContent:
                    'center',

                  textAlign:
                    'center',
                }}
              >
                {ratingEntry.joshi && (
                  <div
                    style={{
                      color:
                        'var(--foreground-muted)',

                      fontSize:
                        '0.88rem',

                      fontStyle:
                        'italic',

                      marginBottom:
                        '12px',
                    }}
                  >
                    {
                      ratingEntry.joshi
                    }
                  </div>
                )}

                <div
                  style={{
                    display:
                      'inline-block',

                    textAlign:
                      'left',

                    margin:
                      '0 auto',

                    fontWeight:
                      'bold',

                    fontSize:
                      '1.2rem',

                    lineHeight:
                      '2',

                    letterSpacing:
                      '2px',
                  }}
                >
                  <div>
                    {
                      ratingEntry.first_line
                    }
                  </div>

                  <div
                    style={{
                      marginLeft:
                        '30px',
                    }}
                  >
                    {
                      ratingEntry.second_line
                    }
                  </div>

                  <div
                    style={{
                      marginLeft:
                        '60px',
                    }}
                  >
                    {
                      ratingEntry.third_line
                    }
                  </div>
                </div>
              </div>

              {/* =====================
                  評価
              ===================== */}

              <div
                style={{
                  borderTop:
                    '1px solid var(--border)',

                  paddingTop:
                    '20px',

                  textAlign:
                    'center',
                }}
              >
                {/* 評価語 */}

                <div
                  style={{
                    minHeight:
                      '28px',

                    color:
                      selectedScore
                        ? 'var(--primary)'
                        : 'var(--foreground-muted)',

                    fontWeight:
                      'bold',

                    fontSize:
                      '1rem',

                    marginBottom:
                      '8px',
                  }}
                >
                  {selectedScore
                    ? SCORE_LABELS[
                        selectedScore
                      ]
                    : '評価を選んでください'}
                </div>

                {/* 星 */}

                <div
                  style={{
                    marginBottom:
                      '15px',
                  }}
                >
                  {[
                    1,
                    2,
                    3,
                    4,
                    5,
                  ].map(
                    (
                      score
                    ) => (
                      <button
                        key={
                          score
                        }

                        type="button"

                        onClick={() =>
                          setSelectedScore(
                            score
                          )
                        }

                        style={{
                          background:
                            'none',

                          border:
                            'none',

                          padding:
                            '2px',

                          cursor:
                            'pointer',

                          fontSize:
                            '1.75rem',

                          color:
                            'var(--primary)',
                        }}
                      >
                        {selectedScore &&
                        score <=
                          selectedScore
                          ? '★'
                          : '☆'}
                      </button>
                    )
                  )}
                </div>

                {/* =====================
                    評価語ボタン
                ===================== */}

                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      'repeat(5, 1fr)',

                    gap:
                      '5px',

                    marginBottom:
                      '20px',
                  }}
                >
                  {[
                    1,
                    2,
                    3,
                    4,
                    5,
                  ].map(
                    (
                      score
                    ) => (
                      <button
                        key={
                          score
                        }

                        type="button"

                        onClick={() =>
                          setSelectedScore(
                            score
                          )
                        }

                        style={{
                          padding:
                            '8px 2px',

                          borderRadius:
                            '8px',

                          border:
                            selectedScore ===
                            score
                              ? '1px solid var(--border)'
                              : '1px solid var(--border)',

                          backgroundColor:
                            selectedScore ===
                            score
                              ? 'var(--surface-elevated)'
                              : 'var(--surface)',

                          color:
                            selectedScore ===
                            score
                              ? 'var(--primary)'
                              : 'var(--foreground-muted)',

                          cursor:
                            'pointer',

                          fontSize:
                            '0.7rem',
                        }}
                      >
                        {
                          SCORE_LABELS[
                            score
                          ]
                        }
                      </button>
                    )
                  )}
                </div>

                {/* =====================
                    次へ
                ===================== */}

                <button
                  type="button"

                  onClick={
                    handleRatingSubmit
                  }

                  disabled={
                    selectedScore ===
                      null ||
                    sendingRating
                  }

                  style={{
                    width:
                      '100%',

                    padding:
                      '13px',

                    border:
                      'none',

                    borderRadius:
                      '10px',

                    backgroundColor:
                      selectedScore
                        ? 'var(--primary)'
                        : 'var(--foreground-muted)',

                    color:
                      selectedScore
                        ? 'var(--page-background)'
                        : 'var(--foreground-muted)',

                    fontWeight:
                      'bold',

                    cursor:
                      selectedScore &&
                      !sendingRating
                        ? 'pointer'
                        : 'not-allowed',
                  }}
                >
                  {sendingRating
                    ? '評価しています…'
                    : ratingEntry.display_position ===
                        ratingEntry.total_entries
                      ? 'この句を評価して完了'
                      : '評価して次へ'}
                </button>
              </div>

              {/* 匿名説明 */}

              <div
                style={{
                  marginTop:
                    '16px',

                  color:
                    'var(--foreground-muted)',

                  fontSize:
                    '0.7rem',

                  textAlign:
                    'center',

                  lineHeight:
                    '1.7',
                }}
              >
                作者名・勝負モードは
                評価終了まで公開されません。
              </div>
            </section>
          ) : null}
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
  // 作句フェーズ
  // =============================

  return (
    <div
      style={
        pageStyle
      }
    >
      <main
        style={
          mainStyle
        }
      >
        {/* =====================
            ヘッダー
        ===================== */}

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            alignItems:
              'center',

            marginBottom:
              '24px',
          }}
        >
          <h1
            style={{
              margin: 0,

              fontSize:
                '1.4rem',
            }}
          >
            ⚔️ 歌合
          </h1>

          <Timer
            time={
              formattedTime
            }

            danger={
              secondsLeft <=
                30
            }
          />
        </div>

        {/* =====================
            お題
        ===================== */}

        <ThemeCard
          theme={
            room.theme
          }
        />

        {/* =====================
            提出済み
        ===================== */}

        {submitted ? (
          <section
            style={{
              ...cardStyle,

              textAlign:
                'center',

              padding:
                '38px 20px',
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
                fontWeight:
                  'bold',

                marginBottom:
                  '10px',
              }}
            >
              一句、承りました
            </div>

            <div
              style={{
                color:
                  'var(--foreground-muted)',

                fontSize:
                  '0.8rem',

                lineHeight:
                  '1.8',
              }}
            >
              他の歌人の作句を待っています。
              <br />

              作句時間終了後、
              自動的に評価へ移ります。
            </div>
          </section>
        ) : (
          <section
            style={
              cardStyle
            }
          >
            {/* =====================
                序詞
            ===================== */}

            <label
              style={
                labelStyle
              }
            >
              序詞

              <span
                style={{
                  color:
                    'var(--foreground-muted)',

                  marginLeft:
                    '6px',

                  fontWeight:
                    'normal',
                }}
              >
                任意
              </span>
            </label>

            <input
              value={
                joshi
              }

              onChange={(
                e
              ) =>
                setJoshi(
                  e.target
                    .value
                )
              }

              placeholder="一句に添える言葉"

              disabled={
                secondsLeft <=
                0
              }

              style={
                inputStyle
              }
            />

            {/* =====================
                初句
            ===================== */}

            <label
              style={
                labelStyle
              }
            >
              初句
            </label>

            <input
              value={
                firstLine
              }

              onChange={(
                e
              ) =>
                setFirstLine(
                  e.target
                    .value
                )
              }

              placeholder="五音"

              maxLength={
                7
              }

              disabled={
                secondsLeft <=
                0
              }

              style={
                inputStyle
              }
            />

            {/* =====================
                二句
            ===================== */}

            <label
              style={
                labelStyle
              }
            >
              二句
            </label>

            <input
              value={
                secondLine
              }

              onChange={(
                e
              ) =>
                setSecondLine(
                  e.target
                    .value
                )
              }

              placeholder="七音"

              maxLength={
                10
              }

              disabled={
                secondsLeft <=
                0
              }

              style={
                inputStyle
              }
            />

            {/* =====================
                結句
            ===================== */}

            <label
              style={
                labelStyle
              }
            >
              結句
            </label>

            <input
              value={
                thirdLine
              }

              onChange={(
                e
              ) =>
                setThirdLine(
                  e.target
                    .value
                )
              }

              placeholder="五音"

              maxLength={
                7
              }

              disabled={
                secondsLeft <=
                0
              }

              style={
                inputStyle
              }
            />

            <div
              style={{
                color:
                  'var(--foreground-muted)',

                fontSize:
                  '0.72rem',

                lineHeight:
                  '1.7',

                marginBottom:
                  '18px',
              }}
            >
              五・七・五を基本として
              一句を詠みます。
            </div>

            {/* =====================
                提出
            ===================== */}

            <button
              type="button"

              onClick={
                handleSubmit
              }

              disabled={
                submitting ||
                secondsLeft <=
                  0
              }

              style={{
                width:
                  '100%',

                padding:
                  '13px',

                border:
                  'none',

                borderRadius:
                  '10px',

                backgroundColor:
                  'var(--primary)',

                color:
                  'var(--page-background)',

                fontWeight:
                  'bold',

                cursor:
                  submitting ||
                  secondsLeft <=
                    0
                    ? 'not-allowed'
                    : 'pointer',

                opacity:
                  submitting ||
                  secondsLeft <=
                    0
                    ? 0.5
                    : 1,
              }}
            >
              {submitting
                ? '提出しています…'
                : secondsLeft <=
                    0
                  ? '作句時間終了'
                  : 'この一句を提出する'}
            </button>
          </section>
        )}

        <div
          style={{
            marginTop:
              '16px',

            color:
              'var(--foreground-muted)',

            fontSize:
              '0.7rem',

            textAlign:
              'center',

            lineHeight:
              '1.7',
          }}
        >
          評価が終わるまで、
          作者名や勝負モードは公開されません。
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
// お題カード
// =============================

function ThemeCard({
  theme,
}: {
  theme:
    string | null
}) {
  return (
    <section
      style={{
        ...cardStyle,

        textAlign:
          'center',

        marginBottom:
          '16px',
      }}
    >
      <div
        style={{
          color:
            'var(--foreground-muted)',

          fontSize:
            '0.75rem',

          marginBottom:
            '10px',
        }}
      >
        此度のお題
      </div>

      <div
        style={{
          fontSize:
            '1.8rem',

          fontWeight:
            'bold',

          letterSpacing:
            '0.15em',

          color:
            'var(--primary)',
        }}
      >
        「
        {theme ||
          '――'}
        」
      </div>
    </section>
  )
}

// =============================
// タイマー
// =============================

function Timer({
  time,
  danger,
}: {
  time: string

  danger: boolean
}) {
  return (
    <div
      style={{
        fontSize:
          '1.25rem',

        fontWeight:
          'bold',

        fontVariantNumeric:
          'tabular-nums',

        color:
          danger
            ? 'var(--danger)'
            : 'var(--primary)',
      }}
    >
      {time}
    </div>
  )
}

// =============================
// 全画面メッセージ
// =============================

function FullScreenMessage({
  text,
}: {
  text: string
}) {
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
      {text}
    </div>
  )
}

// =============================
// スタイル
// =============================

const pageStyle = {
  minHeight:
    '100vh',

  backgroundColor:
    'var(--page-background)',

  color:
    'var(--foreground)',

  paddingBottom:
    '100px',
}

const mainStyle = {
  width:
    '100%',

  maxWidth:
    '600px',

  margin:
    '0 auto',

  padding:
    '20px',

  boxSizing:
    'border-box' as const,
}

const cardStyle = {
  backgroundColor:
    'var(--surface)',

  border:
    '1px solid var(--border)',

  borderRadius:
    '16px',

  padding:
    '20px',
}

const labelStyle = {
  display:
    'block',

  color:
    'var(--foreground-muted)',

  fontSize:
    '0.78rem',

  fontWeight:
    'bold',

  marginBottom:
    '7px',
}

const inputStyle = {
  width:
    '100%',

  boxSizing:
    'border-box' as const,

  backgroundColor:
    'var(--surface)',

  border:
    '1px solid var(--border)',

  borderRadius:
    '9px',

  color:
    'var(--foreground)',

  padding:
    '12px',

  fontSize:
    '1rem',

  marginBottom:
    '16px',

  outline:
    'none',
}

const secondaryButton = {
  width:
    '100%',

  marginTop:
    '15px',

  padding:
    '11px 16px',

  borderRadius:
    '9px',

  border:
    '1px solid var(--border)',

  backgroundColor:
    'var(--surface-elevated)',

  color:
    'var(--foreground)',

  cursor:
    'pointer',
}

type RoomLoadResult = {
  requestId: number
  targetRoomId: string
  targetUserId: string
  status: 'success' | 'error'
  room: Room | null
  errorText: string
}

type SubmittedLoadResult = {
  requestId: number
  targetRoomId: string
  targetUserId: string
  roundNumber: number
  status: 'success' | 'error'
  submitted: boolean
}

type NextEntryLoadResult = {
  requestId: number
  targetRoomId: string
  targetUserId: string
  status: 'success' | 'error'
  entry: RatingEntry | null
}
