'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  supabase,
} from '@/lib/supabase'


// =============================
// 型
// =============================

type PublicRoom = {
  room_id: string
  room_name: string | null
  host_user_id: string
  host_username: string
  current_players: number
  max_players: number
  created_at: string
}

type MyProfile = {
  username: string | null
  utaawase_tickets: number | null
}


// =============================
// 公開歌合ロビー
// =============================

export default function PublicUtaawasePage() {
  const router = useRouter()

  const [userId, setUserId] =
    useState<string | null>(null)

  const [profile, setProfile] =
    useState<MyProfile | null>(null)

  const [rooms, setRooms] =
    useState<PublicRoom[]>([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [creating, setCreating] =
    useState(false)

  const [roomName, setRoomName] =
    useState('')

  const [theme, setTheme] =
    useState('')

  const [joiningRoomId, setJoiningRoomId] =
    useState<string | null>(null)

  const [startingRoomId, setStartingRoomId] =
    useState<string | null>(null)

  const [error, setError] =
    useState<string | null>(null)


  // =============================
  // ログインユーザー取得
  // =============================

  const loadUser = useCallback(
    async () => {
      const {
        data,
        error,
      } =
        await supabase.auth.getUser()

      if (error) {
        throw error
      }

      if (!data.user) {
        router.push('/login')
        return null
      }

      setUserId(
        data.user.id
      )

      return data.user.id
    },
    [router]
  )


  // =============================
  // プロフィール取得
  // =============================

  const loadProfile =
    useCallback(
      async (
        currentUserId: string
      ) => {
        const {
          data,
          error,
        } =
          await supabase
            .from('profiles_3')
            .select(
              `
                username,
                utaawase_tickets
              `
            )
            .eq(
              'id',
              currentUserId
            )
            .single()

        if (error) {
          throw error
        }

        setProfile(
          data as MyProfile
        )
      },
      []
    )


  // =============================
  // 放置された公開歌合を掃除
  // =============================

  const cleanupExpiredRooms =
    useCallback(
      async () => {
        const { error } =
          await supabase.rpc(
            'cleanup_expired_public_utaawase_rooms'
          )

        if (error) {
          throw error
        }
      },
      []
    )


  // =============================
  // 公開ルーム一覧
  // =============================

  const loadRooms =
    useCallback(
      async (
        showRefreshing = false
      ) => {
        if (showRefreshing) {
          setRefreshing(true)
        }

        try {
          const {
            data,
            error,
          } =
            await supabase.rpc(
              'get_public_utaawase_rooms'
            )

          if (error) {
            throw error
          }

          setRooms(
            (data || []) as PublicRoom[]
          )
        } finally {
          if (showRefreshing) {
            setRefreshing(false)
          }
        }
      },
      []
    )


  // =============================
  // 初期読み込み
  // =============================

  useEffect(() => {
    let cancelled = false

    const initialize =
      async () => {
        try {
          setLoading(true)
          setError(null)

          const currentUserId =
            await loadUser()

          if (
            !currentUserId ||
            cancelled
          ) {
            return
          }

          // 10分以上放置されたwaitingルームを
          // 先に閉じてチケットを返却
          await cleanupExpiredRooms()

          await Promise.all([
            loadProfile(
              currentUserId
            ),

            loadRooms(),
          ])
        } catch (err) {
          console.error(err)

          if (!cancelled) {
            setError(
              getErrorMessage(
                err
              )
            )
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }

    initialize()

    return () => {
      cancelled = true
    }
  }, [
    loadUser,
    loadProfile,
    loadRooms,
    cleanupExpiredRooms,
  ])


  // =============================
  // 一覧を定期更新
  //
  // 募集人数の変化を反映
  // =============================

  useEffect(() => {
    if (loading) {
      return
    }

    const interval =
      window.setInterval(
        () => {
          loadRooms().catch(
            (err) => {
              console.error(
                err
              )
            }
          )
        },
        3000
      )

    return () => {
      window.clearInterval(
        interval
      )
    }
  }, [
    loading,
    loadRooms,
  ])


  // =============================
  // 手動更新
  // 放置ルームも同時に掃除
  // =============================

  const handleRefresh =
    async () => {
      try {
        setRefreshing(true)
        setError(null)

        await cleanupExpiredRooms()
        await loadRooms()

        if (userId) {
          await loadProfile(userId)
        }
      } catch (err) {
        console.error(err)
        setError(
          getErrorMessage(err)
        )
      } finally {
        setRefreshing(false)
      }
    }


  // =============================
  // 公開歌合を作る
  //
  // DB側で
  // チケット1枚消費
  // =============================

  const handleCreateRoom =
    async () => {
      if (creating) {
        return
      }

      const trimmedRoomName =
        roomName.trim()

      if (!trimmedRoomName) {
        setError(
          '歌合の名前を入力してください'
        )
        return
      }

      if (trimmedRoomName.length > 30) {
        setError(
          '歌合の名前は30文字以内で入力してください'
        )
        return
      }

      if (theme.trim().length > 30) {
        setError(
          'お題は30文字以内で入力してください'
        )
        return
      }

      try {
        setCreating(true)
        setError(null)

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'create_public_utaawase_room',
            {
              p_room_name:
                roomName.trim(),

              p_theme:
                theme.trim() || null,
            }
          )

        if (error) {
          throw error
        }

        const roomId =
          data as string | null

        if (!roomId) {
          throw new Error(
            '歌合の作成に失敗しました'
          )
        }

        // チケット表示更新
        if (userId) {
          await loadProfile(
            userId
          )
        }

        // 作った本人は
        // すでにmembersに入っている
        router.push(
          `/utaawase/public/${roomId}`
        )
      } catch (err) {
        console.error(err)

        setError(
          getErrorMessage(
            err
          )
        )
      } finally {
        setCreating(false)
      }
    }


  // =============================
  // 公開歌合へ参加
  // =============================

  const handleJoinRoom =
    async (
      roomId: string
    ) => {
      if (joiningRoomId) {
        return
      }

      try {
        setJoiningRoomId(
          roomId
        )

        setError(null)

        const {
          error,
        } =
          await supabase.rpc(
            'join_public_utaawase_room',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          throw error
        }

        router.push(
          `/utaawase/public/${roomId}`
        )
      } catch (err) {
        console.error(err)

        setError(
          getErrorMessage(
            err
          )
        )

        await loadRooms()
      } finally {
        setJoiningRoomId(
          null
        )
      }
    }


  // =============================
  // ホスト
  // 第1戦開始
  // =============================

  const handleStartRoom =
    async (
      roomId: string
    ) => {
      if (startingRoomId) {
        return
      }

      try {
        setStartingRoomId(
          roomId
        )

        setError(null)

        const {
          error,
        } =
          await supabase.rpc(
            'start_public_utaawase_room',
            {
              p_room_id:
                roomId,
            }
          )

        if (error) {
          throw error
        }

        // 実際の歌合画面へ
        router.push(
          `/utaawase/${roomId}`
        )
      } catch (err) {
        console.error(err)

        setError(
          getErrorMessage(
            err
          )
        )

        await loadRooms()
      } finally {
        setStartingRoomId(
          null
        )
      }
    }


  // =============================
  // ロード中
  // =============================

  if (loading) {
    return (
      <FullScreenMessage
        text="公開歌合を読み込んでいます…"
      />
    )
  }


  // =============================
  // 本体
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

        <header
          style={{
            marginBottom:
              '24px',
          }}
        >
          <button
            type="button"
            onClick={() =>
              router.push(
                '/utaawase'
              )
            }
            style={
              backButtonStyle
            }
          >
            ← 歌合へ戻る
          </button>

          <div
            style={{
              marginTop:
                '18px',

              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'flex-end',

              gap:
                '12px',
            }}
          >
            <div>
              <div
                style={{
                  color:
                    '#a99e7f',

                  fontSize:
                    '0.75rem',

                  marginBottom:
                    '5px',
                }}
              >
                一般公開
              </div>

              <h1
                style={{
                  margin: 0,

                  fontSize:
                    '1.7rem',

                  letterSpacing:
                    '0.08em',
                }}
              >
                ⚔️ 公開歌合
              </h1>
            </div>

            <div
              style={{
                textAlign:
                  'right',
              }}
            >
              <div
                style={{
                  color:
                    '#777',

                  fontSize:
                    '0.68rem',
                }}
              >
                歌合チケット
              </div>

              <div
                style={{
                  color:
                    '#ffda79',

                  fontWeight:
                    'bold',

                  fontSize:
                    '1.1rem',
                }}
              >
                🎟️{' '}
                {
                  profile
                    ?.utaawase_tickets ??
                  0
                }
              </div>
            </div>
          </div>
        </header>


        {/* =====================
            説明
        ===================== */}

        <section
          style={{
            ...cardStyle,

            marginBottom:
              '16px',
          }}
        >
          <div
            style={{
              fontWeight:
                'bold',

              marginBottom:
                '8px',
            }}
          >
            🌸 公開歌合とは
          </div>

          <div
            style={{
              color:
                '#999',

              fontSize:
                '0.78rem',

              lineHeight:
                '1.8',
            }}
          >
            3〜6人で集まり、
            最大30分間、
            何戦も歌合を楽しめます。
            <br />

            歌合を催すには
            チケットを1枚使用します。
            参加するだけなら
            チケットは必要ありません。
          </div>
        </section>


        {/* =====================
            エラー
        ===================== */}

        {error && (
          <div
            style={
              errorStyle
            }
          >
            {error}
          </div>
        )}


        {/* =====================
            部屋を作る
        ===================== */}

        <section
          style={{
            ...cardStyle,
            marginBottom:
              '8px',
          }}
        >
          <div
            style={{
              fontWeight:
                'bold',
              marginBottom:
                '14px',
            }}
          >
            ⚔️ 公開歌合を催す
          </div>

          <label
            style={
              labelStyle
            }
          >
            歌合の名前
            <span
              style={{
                color:
                  '#d8b95f',
                marginLeft:
                  '5px',
                fontSize:
                  '0.65rem',
              }}
            >
              必須
            </span>
          </label>

          <input
            type="text"
            value={roomName}
            onChange={(event) =>
              setRoomName(
                event.target.value
              )
            }
            maxLength={30}
            placeholder="例：月夜の歌合"
            disabled={creating}
            style={
              inputStyle
            }
          />

          <div
            style={
              countStyle
            }
          >
            {roomName.length} / 30
          </div>

          <label
            style={{
              ...labelStyle,
              marginTop:
                '14px',
            }}
          >
            お題
            <span
              style={{
                color:
                  '#777',
                marginLeft:
                  '5px',
                fontSize:
                  '0.65rem',
              }}
            >
              任意
            </span>
          </label>

          <input
            type="text"
            value={theme}
            onChange={(event) =>
              setTheme(
                event.target.value
              )
            }
            maxLength={30}
            placeholder="空欄ならランダムで決まります"
            disabled={creating}
            style={
              inputStyle
            }
          />

          <div
            style={
              countStyle
            }
          >
            {theme.length} / 30
          </div>

          <button
            type="button"
            onClick={
              handleCreateRoom
            }
            disabled={
              creating ||
              roomName.trim().length ===
                0 ||
              (
                profile
                  ?.utaawase_tickets ??
                0
              ) < 1
            }
            style={{
              ...primaryButtonStyle,
              marginTop:
                '18px',

              opacity:
                creating ||
                roomName.trim().length ===
                  0 ||
                (
                  profile
                    ?.utaawase_tickets ??
                  0
                ) < 1
                  ? 0.5
                  : 1,

              cursor:
                creating ||
                roomName.trim().length ===
                  0 ||
                (
                  profile
                    ?.utaawase_tickets ??
                  0
                ) < 1
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {creating
              ? '歌合を準備しています…'
              : '⚔️ この歌合を催す'}
          </button>

          {(
            profile
              ?.utaawase_tickets ??
            0
          ) < 1 && (
            <div
              style={{
                color:
                  '#777',

                textAlign:
                  'center',

                fontSize:
                  '0.72rem',

                marginTop:
                  '8px',
              }}
            >
              歌合チケットがありません
            </div>
          )}

          <div
            style={{
              color:
                '#666',
              textAlign:
                'center',
              fontSize:
                '0.68rem',
              lineHeight:
                '1.7',
              marginTop:
                '10px',
            }}
          >
            お題を空欄にすると、
            登録済みのお題から
            ランダムで選ばれます。
          </div>
        </section>


        {/* =====================
            募集中
        ===================== */}

        <div
          style={{
            display:
              'flex',

            justifyContent:
              'space-between',

            alignItems:
              'center',

            marginTop:
              '32px',

            marginBottom:
              '12px',
          }}
        >
          <div>
            <div
              style={{
                fontWeight:
                  'bold',

                fontSize:
                  '1rem',
              }}
            >
              募集中の歌合
            </div>

            <div
              style={{
                color:
                  '#666',

                fontSize:
                  '0.68rem',

                marginTop:
                  '3px',
              }}
            >
              3人集まると開始できます
            </div>
          </div>

          <button
            type="button"

            onClick={() => {
              void handleRefresh()
            }}

            disabled={
              refreshing
            }

            style={
              refreshButtonStyle
            }
          >
            {refreshing
              ? '更新中…'
              : '↻ 更新'}
          </button>
        </div>


        {/* =====================
            部屋なし
        ===================== */}

        {rooms.length ===
        0 ? (
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
                  '12px',
              }}
            >
              🌙
            </div>

            <div
              style={{
                fontWeight:
                  'bold',

                marginBottom:
                  '8px',
              }}
            >
              募集中の歌合はありません
            </div>

            <div
              style={{
                color:
                  '#777',

                fontSize:
                  '0.75rem',

                lineHeight:
                  '1.7',
              }}
            >
              あなたが最初の
              歌合を催してみましょう。
            </div>
          </section>
        ) : (
          <div
            style={{
              display:
                'grid',

              gap:
                '12px',
            }}
          >
            {rooms.map(
              (
                room
              ) => {
                const isHost =
                  room.host_user_id ===
                  userId

                const canStart =
                  isHost &&
                  room.current_players >=
                    3

                const isFull =
                  room.current_players >=
                  room.max_players

                return (
                  <section
                    key={
                      room.room_id
                    }
                    style={
                      cardStyle
                    }
                  >
                    {/* 上部 */}

                    <div
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        alignItems:
                          'flex-start',

                        gap:
                          '12px',
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight:
                              'bold',

                            fontSize:
                              '1.05rem',

                            lineHeight:
                              '1.5',
                          }}
                        >
                          {room.room_name ||
                            `${room.host_username}さんの歌合`}
                        </div>

                        <div
                          style={{
                            color:
                              '#777',

                            fontSize:
                              '0.68rem',

                            marginTop:
                              '6px',
                          }}
                        >
                          主催：
                          {
                            room.host_username
                          }
                          さん
                        </div>

                        {isHost && (
                          <div
                            style={{
                              display:
                                'inline-block',

                              marginTop:
                                '6px',

                              padding:
                                '3px 7px',

                              borderRadius:
                                '999px',

                              backgroundColor:
                                '#302a18',

                              color:
                                '#ffda79',

                              fontSize:
                                '0.62rem',

                              fontWeight:
                                'bold',
                            }}
                          >
                            あなたが主催者
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          textAlign:
                            'right',
                        }}
                      >
                        <div
                          style={{
                            color:
                              room.current_players >=
                              3
                                ? '#9ed89e'
                                : '#aaa',

                            fontWeight:
                              'bold',

                            fontSize:
                              '1.05rem',
                          }}
                        >
                          {
                            room.current_players
                          }
                          {' / '}
                          {
                            room.max_players
                          }
                          人
                        </div>

                        <div
                          style={{
                            color:
                              '#666',

                            fontSize:
                              '0.65rem',

                            marginTop:
                              '3px',
                          }}
                        >
                          {room.current_players >=
                          3
                            ? '開始できます'
                            : `あと ${
                                3 -
                                room.current_players
                              } 人`}
                        </div>
                      </div>
                    </div>


                    {/* 人数ゲージ */}

                    <div
                      style={{
                        height:
                          '5px',

                        backgroundColor:
                          '#2a2a2a',

                        borderRadius:
                          '999px',

                        overflow:
                          'hidden',

                        margin:
                          '18px 0',
                      }}
                    >
                      <div
                        style={{
                          height:
                            '100%',

                          width:
                            `${
                              (
                                room.current_players /
                                room.max_players
                              ) *
                              100
                            }%`,

                          backgroundColor:
                            '#ffda79',

                          transition:
                            'width 0.25s ease',
                        }}
                      />
                    </div>


                    {/* ホスト */}

                    {isHost ? (
                      <>
                        <button
                          type="button"

                          onClick={() =>
                            handleStartRoom(
                              room.room_id
                            )
                          }

                          disabled={
                            !canStart ||
                            startingRoomId !==
                              null
                          }

                          style={{
                            ...primaryButtonStyle,

                            marginTop:
                              0,

                            opacity:
                              canStart &&
                              startingRoomId ===
                                null
                                ? 1
                                : 0.45,

                            cursor:
                              canStart &&
                              startingRoomId ===
                                null
                                ? 'pointer'
                                : 'not-allowed',
                          }}
                        >
                          {startingRoomId ===
                          room.room_id
                            ? '歌合を始めています…'
                            : canStart
                              ? '⚔️ 歌合を始める'
                              : '3人集まるまで待つ'}
                        </button>

                        <div
                          style={{
                            color:
                              '#666',

                            textAlign:
                              'center',

                            fontSize:
                              '0.68rem',

                            marginTop:
                              '8px',
                          }}
                        >
                          主催者が開始すると
                          30分の開催時間が始まります
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"

                        onClick={() =>
                          handleJoinRoom(
                            room.room_id
                          )
                        }

                        disabled={
                          isFull ||
                          joiningRoomId !==
                            null
                        }

                        style={{
                          ...secondaryButtonStyle,

                          opacity:
                            isFull ||
                            joiningRoomId !==
                              null
                              ? 0.45
                              : 1,

                          cursor:
                            isFull ||
                            joiningRoomId !==
                              null
                              ? 'not-allowed'
                              : 'pointer',
                        }}
                      >
                        {joiningRoomId ===
                        room.room_id
                          ? '参加しています…'
                          : isFull
                            ? '満員です'
                            : 'この歌合に参加する'}
                      </button>
                    )}
                  </section>
                )
              }
            )}
          </div>
        )}


        {/* =====================
            補足
        ===================== */}

        <div
          style={{
            color:
              '#555',

            fontSize:
              '0.68rem',

            lineHeight:
              '1.8',

            textAlign:
              'center',

            marginTop:
              '28px',
          }}
        >
          公開歌合では
          Ratingは変動しません。
          <br />

          一戦ごとに結果を発表し、
          主催者が次戦または閉幕を選びます。
        </div>
      </main>
    </div>
  )
}


// =============================
// エラーメッセージ
// =============================

function getErrorMessage(
  err: unknown
) {
  if (
    typeof err ===
      'object' &&
    err !== null &&
    'message' in err
  ) {
    const message =
      (
        err as {
          message?: unknown
        }
      ).message

    if (
      typeof message ===
      'string'
    ) {
      return message
    }
  }

  return 'エラーが発生しました'
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
          '#121212',

        color:
          '#888',

        display:
          'flex',

        justifyContent:
          'center',

        alignItems:
          'center',

        padding:
          '20px',

        boxSizing:
          'border-box',
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
    '#121212',

  color:
    '#fff',

  paddingBottom:
    '80px',
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
    '#1c1c1c',

  border:
    '1px solid #303030',

  borderRadius:
    '16px',

  padding:
    '18px',
}

const primaryButtonStyle = {
  width:
    '100%',

  marginTop:
    '4px',

  padding:
    '14px 16px',

  border:
    'none',

  borderRadius:
    '11px',

  backgroundColor:
    '#ffda79',

  color:
    '#121212',

  fontWeight:
    'bold',

  fontSize:
    '0.9rem',

  cursor:
    'pointer',
}

const secondaryButtonStyle = {
  width:
    '100%',

  padding:
    '12px 16px',

  borderRadius:
    '10px',

  border:
    '1px solid #494949',

  backgroundColor:
    '#242424',

  color:
    '#eee',

  fontWeight:
    'bold',

  cursor:
    'pointer',
}

const backButtonStyle = {
  border:
    'none',

  background:
    'none',

  color:
    '#888',

  padding: 0,

  cursor:
    'pointer',

  fontSize:
    '0.78rem',
}

const refreshButtonStyle = {
  border:
    '1px solid #333',

  borderRadius:
    '8px',

  backgroundColor:
    '#1b1b1b',

  color:
    '#aaa',

  padding:
    '7px 10px',

  cursor:
    'pointer',

  fontSize:
    '0.7rem',
}


const labelStyle = {
  display:
    'block',

  color:
    '#aaa',

  fontSize:
    '0.75rem',

  fontWeight:
    'bold',
}

const inputStyle = {
  width:
    '100%',

  marginTop:
    '7px',

  padding:
    '12px 13px',

  border:
    '1px solid #3a3a3a',

  borderRadius:
    '10px',

  backgroundColor:
    '#151515',

  color:
    '#fff',

  fontSize:
    '0.86rem',

  outline:
    'none',

  boxSizing:
    'border-box' as const,
}

const countStyle = {
  color:
    '#555',

  textAlign:
    'right' as const,

  fontSize:
    '0.62rem',

  marginTop:
    '4px',
}

const errorStyle = {
  backgroundColor:
    '#2c1818',

  border:
    '1px solid #633',

  color:
    '#ffaaaa',

  padding:
    '12px',

  borderRadius:
    '10px',

  marginBottom:
    '14px',

  fontSize:
    '0.78rem',

  lineHeight:
    '1.6',
}